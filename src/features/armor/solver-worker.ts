import initWasm, { WasmArmorEngine } from '@/features/armor/wasm/generated/rose_armor_wasm.js';

import type {
    EngineCapOutput,
    EngineCapRequest,
    EngineProfileInput,
    EngineProfileSummary,
    EngineSolveOutput,
    EngineSolveRequest
} from '../../../packages/armor-engine/ts';

export type SolverWorkerRequest =
    | {
          id: number;
          type: 'initialize';
          profile: EngineProfileInput;
      }
    | {
          id: number;
          type: 'calculate-stat-caps';
          request: EngineCapRequest;
      }
    | {
          id: number;
          type: 'solve';
          request: EngineSolveRequest;
          progressBuildCount?: number | undefined;
      };

export type SolverWorkerResponse =
    | {
          id: number;
          type: 'progress';
          result: EngineSolveOutput;
      }
    | {
          id: number;
          type: 'result';
          ok: true;
          result: EngineProfileSummary | EngineCapOutput | EngineSolveOutput;
      }
    | {
          id: number;
          type: 'result';
          ok: false;
          error: string;
      };

let engine: WasmArmorEngine | null = null;
let wasmReady: Promise<unknown> | null = null;

const loadWasm = (): Promise<unknown> => {
    wasmReady ??= initWasm();
    return wasmReady;
};

self.onmessage = (event: MessageEvent<SolverWorkerRequest>) => {
    void handleMessage(event.data);
};

const handleMessage = async (message: SolverWorkerRequest): Promise<void> => {
    try {
        await loadWasm();
        const result = executeRequest(message);
        self.postMessage({
            id: message.id,
            type: 'result',
            ok: true,
            result
        } satisfies SolverWorkerResponse);
    } catch (error) {
        self.postMessage({
            id: message.id,
            type: 'result',
            ok: false,
            error: error instanceof Error ? error.message : String(error)
        } satisfies SolverWorkerResponse);
    }
};

const executeRequest = (message: SolverWorkerRequest): EngineProfileSummary | EngineCapOutput | EngineSolveOutput => {
    if (message.type === 'initialize') {
        engine?.free();
        engine = new WasmArmorEngine(message.profile);
        return engine.summary() as EngineProfileSummary;
    }
    if (!engine) {
        throw new Error('Armor engine has not been initialized.');
    }
    if (message.type === 'calculate-stat-caps') {
        return engine.calculate_caps(message.request) as EngineCapOutput;
    }

    const progressBuildCount = Math.max(0, Math.trunc(message.progressBuildCount ?? 0));
    if (progressBuildCount > 0 && progressBuildCount < message.request.maxResults) {
        const progress = engine.solve({
            ...message.request,
            maxResults: progressBuildCount,
            resultSort: null,
            stopWhenResultLimitReached: true
        }) as EngineSolveOutput;
        if (progress.ok) {
            self.postMessage({
                id: message.id,
                type: 'progress',
                result: progress
            } satisfies SolverWorkerResponse);
        }
    }
    return engine.solve(message.request) as EngineSolveOutput;
};
