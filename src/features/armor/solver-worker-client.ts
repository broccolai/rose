import {
    ARMOR_STATS,
    type ArmorStat,
    type ArmorStatTargetCapsInput,
    calculateArmorStatTargetCap,
    calculateArmorStatTargetCaps,
    type SolveArmorInput,
    type SolveArmorProgress,
    type SolveArmorResult,
    type StatVector,
    solveArmor
} from '@armor-calc';

import type { SolverWorkerRequest, SolverWorkerResponse } from '@/features/armor/solver-worker';

const DEV_SOLVER_TIMING = Boolean(import.meta.env.DEV);

type PendingRequest = {
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
    label: string;
    startedAt: number;
    onProgress?: ((progress: SolveArmorProgress) => void) | undefined;
};

type SolveRequestOptions = {
    progressBuildCount?: number | undefined;
    onProgress?: ((progress: SolveArmorProgress) => void) | undefined;
};

type SolverWorkerClient = {
    calculateStatCap(input: ArmorStatTargetCapsInput, stat: ArmorStat): Promise<number>;
    calculateStatCaps(
        input: ArmorStatTargetCapsInput,
        stats: readonly ArmorStat[],
        onStatCap?: (stat: ArmorStat, cap: number) => void
    ): Promise<StatVector>;
    solve(input: SolveArmorInput, options?: SolveRequestOptions): Promise<SolveArmorResult>;
    cancelPending(): void;
    dispose(): void;
};

class BrowserSolverWorkerClient implements SolverWorkerClient {
    private nextId = 1;
    private workers: Worker[];
    private readonly pending = new Map<number, PendingRequest>();

    constructor(workerCount: number) {
        this.workers = Array.from({ length: workerCount }, () => this.createWorker());
    }

    calculateStatCap(input: ArmorStatTargetCapsInput, stat: ArmorStat) {
        return this.request<number>({ id: 0, type: 'calculate-stat-cap', input, stat }, this.workerForStat(stat));
    }

    async calculateStatCaps(
        input: ArmorStatTargetCapsInput,
        stats: readonly ArmorStat[],
        onStatCap?: (stat: ArmorStat, cap: number) => void
    ) {
        const caps = await this.request<StatVector>(
            { id: 0, type: 'calculate-stat-caps', input, stats },
            this.workerForStat(stats[0] ?? ARMOR_STATS[0])
        );

        for (const stat of stats) {
            onStatCap?.(stat, caps[stat]);
        }

        return caps;
    }

    solve(input: SolveArmorInput, options: SolveRequestOptions = {}) {
        return this.request<SolveArmorResult>(
            { id: 0, type: 'solve', input, progressBuildCount: options.progressBuildCount },
            this.workers[0],
            options.onProgress
        );
    }

    cancelPending() {
        this.resetWorkers('Armor solver request superseded.');
    }

    dispose() {
        for (const worker of this.workers) {
            worker.terminate();
        }

        for (const request of this.pending.values()) {
            request.reject(new Error('Armor solver worker disposed.'));
        }

        this.pending.clear();
    }

    private createWorker() {
        const worker = new Worker(new URL('./solver-worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<SolverWorkerResponse>) => {
            const message = event.data;
            const request = this.pending.get(message.id);
            if (!request) {
                return;
            }

            if (message.type === 'progress') {
                request.onProgress?.(message.result);
                return;
            }

            this.pending.delete(message.id);
            this.recycleWorker(worker);
            logSolverTiming(request.label, request.startedAt, message.ok ? 'done' : 'error');
            if (message.ok) {
                request.resolve(message.result);
                return;
            }

            request.reject(new Error(message.error));
        };
        worker.onerror = (event) => {
            for (const request of this.pending.values()) {
                logSolverTiming(request.label, request.startedAt, 'worker-error');
                request.reject(event.error ?? new Error(event.message || 'Armor solver worker failed.'));
            }

            this.pending.clear();
            this.recycleWorker(worker);
        };

        return worker;
    }

    private recycleWorker(worker: Worker) {
        const index = this.workers.indexOf(worker);
        if (index < 0) {
            return;
        }

        worker.terminate();
        this.workers[index] = this.createWorker();
    }

    private resetWorkers(reason: string) {
        for (const worker of this.workers) {
            worker.terminate();
        }

        if (DEV_SOLVER_TIMING && this.pending.size > 0) {
            console.debug('[rose timing] solver workers reset', {
                canceledRequests: this.pending.size,
                reason
            });
        }

        for (const request of this.pending.values()) {
            logSolverTiming(request.label, request.startedAt, 'canceled');
            request.reject(new Error(reason));
        }

        this.pending.clear();
        this.workers = Array.from({ length: this.workers.length }, () => this.createWorker());
    }

    private request<T>(request: SolverWorkerRequest, worker: Worker | undefined, onProgress?: (progress: SolveArmorProgress) => void) {
        if (!worker) {
            return Promise.reject(new Error('No armor solver worker available.'));
        }

        const id = this.nextId++;
        const label = solverRequestLabel(id, request);
        return new Promise<T>((resolve, reject) => {
            this.pending.set(id, {
                resolve: (value) => resolve(value as T),
                reject,
                label,
                startedAt: performance.now(),
                onProgress
            });
            if (DEV_SOLVER_TIMING) {
                console.debug('[rose timing] solver request started', { label });
            }
            worker.postMessage({ ...request, id } satisfies SolverWorkerRequest);
        });
    }

    private workerForStat(stat: ArmorStat) {
        const index = ARMOR_STATS.indexOf(stat) % this.workers.length;
        return this.workers[index];
    }
}

class DirectSolverWorkerClient implements SolverWorkerClient {
    async calculateStatCap(input: ArmorStatTargetCapsInput, stat: ArmorStat) {
        const startedAt = performance.now();
        try {
            return calculateArmorStatTargetCap(input, stat);
        } finally {
            logSolverTiming(`direct cap:${stat}`, startedAt, 'done');
        }
    }

    async calculateStatCaps(
        input: ArmorStatTargetCapsInput,
        stats: readonly ArmorStat[],
        onStatCap?: (stat: ArmorStat, cap: number) => void
    ) {
        const startedAt = performance.now();
        const caps = calculateArmorStatTargetCaps(input, stats);
        for (const stat of stats) {
            onStatCap?.(stat, caps[stat]);
        }

        logSolverTiming('direct caps', startedAt, 'done');
        return caps;
    }

    async solve(input: SolveArmorInput, options: SolveRequestOptions = {}) {
        const startedAt = performance.now();
        try {
            return solveArmor(input, options);
        } finally {
            logSolverTiming('direct solve', startedAt, 'done');
        }
    }

    cancelPending() {}

    dispose() {}
}

function solverRequestLabel(id: number, request: SolverWorkerRequest) {
    if (request.type === 'calculate-stat-cap') {
        return `worker#${id} cap:${request.stat}`;
    }

    if (request.type === 'calculate-stat-caps') {
        return `worker#${id} caps:${request.stats.join(',')}`;
    }

    return `worker#${id} ${request.type}`;
}

function logSolverTiming(label: string, startedAt: number, status: 'canceled' | 'done' | 'error' | 'worker-error') {
    if (!DEV_SOLVER_TIMING) {
        return;
    }

    console.debug('[rose timing] solver request finished', {
        label,
        status,
        ms: Math.round((performance.now() - startedAt) * 10) / 10
    });
}

export function createArmorSolverClient(): SolverWorkerClient {
    if (typeof Worker === 'undefined') {
        return new DirectSolverWorkerClient();
    }

    return new BrowserSolverWorkerClient(1);
}
