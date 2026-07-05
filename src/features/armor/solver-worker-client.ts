import {
    ARMOR_STATS,
    type ArmorStat,
    type ArmorStatTargetCapsInput,
    calculateArmorStatTargetCap,
    type SolveArmorInput,
    type SolveArmorResult,
    type StatVector,
    solveArmor
} from '@armor-calc';

import type { SolverWorkerRequest, SolverWorkerResponse } from '@/features/armor/solver-worker';

type PendingRequest = {
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
};

type SolverWorkerClient = {
    calculateStatCap(input: ArmorStatTargetCapsInput, stat: ArmorStat): Promise<number>;
    calculateStatCaps(
        input: ArmorStatTargetCapsInput,
        stats: readonly ArmorStat[],
        onStatCap?: (stat: ArmorStat, cap: number) => void
    ): Promise<StatVector>;
    solve(input: SolveArmorInput): Promise<SolveArmorResult>;
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
        const caps = Object.fromEntries(ARMOR_STATS.map((stat) => [stat, 0])) as StatVector;
        await Promise.all(
            stats.map(async (stat) => {
                const cap = await this.calculateStatCap(input, stat);
                caps[stat] = cap;
                onStatCap?.(stat, cap);
            })
        );

        return caps;
    }

    solve(input: SolveArmorInput) {
        return this.request<SolveArmorResult>({ id: 0, type: 'solve', input }, this.workers[0]);
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

            this.pending.delete(message.id);
            if (message.ok) {
                request.resolve(message.result);
                return;
            }

            request.reject(new Error(message.error));
        };
        worker.onerror = (event) => {
            for (const request of this.pending.values()) {
                request.reject(event.error ?? new Error(event.message || 'Armor solver worker failed.'));
            }

            this.pending.clear();
        };

        return worker;
    }

    private resetWorkers(reason: string) {
        for (const worker of this.workers) {
            worker.terminate();
        }

        for (const request of this.pending.values()) {
            request.reject(new Error(reason));
        }

        this.pending.clear();
        this.workers = Array.from({ length: this.workers.length }, () => this.createWorker());
    }

    private request<T>(request: SolverWorkerRequest, worker: Worker | undefined) {
        if (!worker) {
            return Promise.reject(new Error('No armor solver worker available.'));
        }

        const id = this.nextId++;
        return new Promise<T>((resolve, reject) => {
            this.pending.set(id, {
                resolve: (value) => resolve(value as T),
                reject
            });
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
        return calculateArmorStatTargetCap(input, stat);
    }

    async calculateStatCaps(
        input: ArmorStatTargetCapsInput,
        stats: readonly ArmorStat[],
        onStatCap?: (stat: ArmorStat, cap: number) => void
    ) {
        const caps = Object.fromEntries(ARMOR_STATS.map((stat) => [stat, 0])) as StatVector;
        for (const stat of stats) {
            const cap = calculateArmorStatTargetCap(input, stat);
            caps[stat] = cap;
            onStatCap?.(stat, cap);
        }

        return caps;
    }

    async solve(input: SolveArmorInput) {
        return solveArmor(input);
    }

    cancelPending() {}

    dispose() {}
}

function workerCount() {
    const hardwareConcurrency = typeof navigator === 'undefined' ? 2 : (navigator.hardwareConcurrency ?? 2);
    return Math.max(1, Math.min(ARMOR_STATS.length, 4, hardwareConcurrency - 1));
}

export function createArmorSolverClient(): SolverWorkerClient {
    if (typeof Worker === 'undefined') {
        return new DirectSolverWorkerClient();
    }

    return new BrowserSolverWorkerClient(workerCount());
}
