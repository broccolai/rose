import {
    type ArmorInventoryBySlot,
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
import type { EngineCapOutput, EngineProfileSummary, EngineSolveOutput } from '../../../packages/armor-engine/ts';
import { ArmorEngineAdapter } from '../../../packages/armor-engine/ts';

const DEV_SOLVER_TIMING = Boolean(import.meta.env.DEV);

interface PendingRequest<T = unknown> {
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
    decode: (value: unknown) => T;
    label: string;
    startedAt: number;
    onProgress?: ((value: unknown) => void) | undefined;
}

interface SolveRequestOptions {
    progressBuildCount?: number | undefined;
    onProgress?: ((progress: SolveArmorProgress) => void) | undefined;
}

interface SolverWorkerClient {
    calculateStatCap(input: ArmorStatTargetCapsInput, stat: ArmorStat): Promise<number>;
    calculateStatCaps(
        input: ArmorStatTargetCapsInput,
        stats: readonly ArmorStat[],
        onStatCap?: (stat: ArmorStat, cap: number) => void
    ): Promise<StatVector>;
    solve(input: SolveArmorInput, options?: SolveRequestOptions): Promise<SolveArmorResult>;
    cancelPending(): void;
    dispose(): void;
}

class BrowserSolverWorkerClient implements SolverWorkerClient {
    private nextId = 1;
    private worker: Worker;
    private currentArmor: ArmorInventoryBySlot | null = null;
    private adapter: ArmorEngineAdapter | null = null;
    private initialized = false;
    private initialization: Promise<void> | null = null;
    private readonly pending = new Map<number, PendingRequest>();

    constructor() {
        this.worker = this.createWorker();
    }

    async calculateStatCap(input: ArmorStatTargetCapsInput, stat: ArmorStat): Promise<number> {
        const adapter = await this.ensureInitialized(input.armor);
        const output = await this.request(
            {
                id: 0,
                type: 'calculate-stat-caps',
                request: adapter.createCapRequest(input, [stat])
            },
            `cap:${stat}`,
            asEngineCapOutput
        );
        return adapter.materializeCaps(output).caps[stat];
    }

    async calculateStatCaps(
        input: ArmorStatTargetCapsInput,
        stats: readonly ArmorStat[],
        onStatCap?: (stat: ArmorStat, cap: number) => void
    ): Promise<StatVector> {
        const adapter = await this.ensureInitialized(input.armor);
        const output = await this.request(
            {
                id: 0,
                type: 'calculate-stat-caps',
                request: adapter.createCapRequest(input, stats)
            },
            `caps:${stats.join(',')}`,
            asEngineCapOutput
        );
        const caps = adapter.materializeCaps(output).caps;
        for (const stat of stats) {
            onStatCap?.(stat, caps[stat]);
        }
        return caps;
    }

    async solve(input: SolveArmorInput, options: SolveRequestOptions = {}): Promise<SolveArmorResult> {
        const adapter = await this.ensureInitialized(input.armor);
        const decode = (value: unknown): SolveArmorResult => adapter.materializeSolve(asEngineSolveOutput(value));
        return this.request(
            {
                id: 0,
                type: 'solve',
                request: adapter.createSolveRequest(input),
                progressBuildCount: options.progressBuildCount
            },
            'solve',
            decode,
            options.onProgress ? (value) => options.onProgress?.(decode(value) as SolveArmorProgress) : undefined
        );
    }

    cancelPending(): void {
        if (this.pending.size === 0) {
            return;
        }
        this.resetWorker('Armor solver request superseded.');
    }

    dispose(): void {
        this.rejectPending('Armor solver worker disposed.');
        this.worker.terminate();
        this.adapter = null;
        this.currentArmor = null;
        this.initialization = null;
        this.initialized = false;
    }

    private async ensureInitialized(armor: ArmorInventoryBySlot): Promise<ArmorEngineAdapter> {
        if (this.currentArmor !== armor) {
            if (this.pending.size > 0) {
                this.resetWorker('Armor solver profile changed.');
            }
            this.currentArmor = armor;
            this.adapter = new ArmorEngineAdapter(armor);
            this.initialized = false;
            this.initialization = null;
        }
        const adapter = this.adapter;
        if (!adapter) {
            throw new Error('Could not prepare the armor solver profile.');
        }
        if (!this.initialized) {
            this.initialization ??= this.request(
                {
                    id: 0,
                    type: 'initialize',
                    profile: adapter.profile
                },
                `initialize:${adapter.profile.items.length}`,
                asEngineProfileSummary
            ).then(() => {
                this.initialized = true;
            });
            await this.initialization;
        }
        return adapter;
    }

    private createWorker(): Worker {
        const worker = new Worker(new URL('./solver-worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<SolverWorkerResponse>) => {
            if (worker !== this.worker) {
                return;
            }
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
            logSolverTiming(request.label, request.startedAt, message.ok ? 'done' : 'error');
            if (message.ok) {
                request.resolve(request.decode(message.result));
                return;
            }
            request.reject(new Error(message.error));
        };
        worker.onerror = (event) => {
            if (worker !== this.worker) {
                return;
            }
            this.resetWorker(event.message || 'Armor solver worker failed.', event.error);
        };
        return worker;
    }

    private resetWorker(reason: string, error?: unknown): void {
        if (DEV_SOLVER_TIMING && this.pending.size > 0) {
            console.debug('[rose timing] solver worker reset', {
                canceledRequests: this.pending.size,
                reason
            });
        }
        this.rejectPending(reason, error);
        this.worker.terminate();
        this.worker = this.createWorker();
        this.initialized = false;
        this.initialization = null;
    }

    private rejectPending(reason: string, error?: unknown): void {
        for (const request of this.pending.values()) {
            logSolverTiming(request.label, request.startedAt, 'canceled');
            request.reject(error ?? new Error(reason));
        }
        this.pending.clear();
    }

    private request<T>(
        request: SolverWorkerRequest,
        label: string,
        decode: (value: unknown) => T,
        onProgress?: (value: unknown) => void
    ): Promise<T> {
        const id = this.nextId++;
        const timedLabel = `worker#${id} ${label}`;
        return new Promise<T>((resolve, reject) => {
            this.pending.set(id, {
                resolve: (value) => resolve(value as T),
                reject,
                decode,
                label: timedLabel,
                startedAt: performance.now(),
                onProgress
            });
            if (DEV_SOLVER_TIMING) {
                console.debug('[rose timing] solver request started', { label: timedLabel });
            }
            this.worker.postMessage({ ...request, id } satisfies SolverWorkerRequest);
        });
    }
}

class DirectSolverWorkerClient implements SolverWorkerClient {
    async calculateStatCap(input: ArmorStatTargetCapsInput, stat: ArmorStat): Promise<number> {
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
    ): Promise<StatVector> {
        const startedAt = performance.now();
        const caps = calculateArmorStatTargetCaps(input, stats);
        for (const stat of stats) {
            onStatCap?.(stat, caps[stat]);
        }
        logSolverTiming('direct caps', startedAt, 'done');
        return caps;
    }

    async solve(input: SolveArmorInput, options: SolveRequestOptions = {}): Promise<SolveArmorResult> {
        const startedAt = performance.now();
        try {
            return solveArmor(input, options);
        } finally {
            logSolverTiming('direct solve', startedAt, 'done');
        }
    }

    cancelPending(): void {}

    dispose(): void {}
}

const asEngineCapOutput = (value: unknown): EngineCapOutput => value as EngineCapOutput;
const asEngineSolveOutput = (value: unknown): EngineSolveOutput => value as EngineSolveOutput;
const asEngineProfileSummary = (value: unknown): EngineProfileSummary => value as EngineProfileSummary;

const logSolverTiming = (label: string, startedAt: number, status: 'canceled' | 'done' | 'error'): void => {
    if (!DEV_SOLVER_TIMING) {
        return;
    }
    console.debug('[rose timing] solver request finished', {
        label,
        status,
        ms: Math.round((performance.now() - startedAt) * 10) / 10
    });
};

export const createArmorSolverClient = (): SolverWorkerClient => {
    if (typeof Worker === 'undefined') {
        return new DirectSolverWorkerClient();
    }
    return new BrowserSolverWorkerClient();
};
