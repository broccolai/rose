import type {
    EngineCapOutput,
    EngineCapRequest,
    EnginePlanningProfileInput,
    EnginePlanningProfileSummary,
    EngineProfileInput,
    EngineProfileSummary,
    EngineSolveOutput,
    EngineSolveRequest
} from '@rose/armor-engine/ts';
import initWasm, { WasmArmorEngine, WasmArmorPlanner } from '@rose/armor-engine/wasm';

export type SolverWorkerRequest =
    | {
          id: number;
          type: 'initialize';
          profile: EngineProfileInput;
      }
    | {
          id: number;
          type: 'initialize-planner';
          profile: EnginePlanningProfileInput;
      }
    | {
          id: number;
          type: 'calculate-stat-caps';
          request: EngineCapRequest;
      }
    | {
          id: number;
          type: 'calculate-planning-stat-caps';
          request: EngineCapRequest;
      }
    | {
          id: number;
          type: 'solve';
          request: EngineSolveRequest;
          progressBuildCount?: number | undefined;
      }
    | {
          id: number;
          type: 'plan';
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
          result: EnginePlanningProfileSummary | EngineProfileSummary | EngineCapOutput | EngineSolveOutput;
      }
    | {
          id: number;
          type: 'result';
          ok: false;
          error: string;
      };

let engine: WasmArmorEngine | null = null;
let planner: WasmArmorPlanner | null = null;
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

const executeRequest = (
    message: SolverWorkerRequest
): EnginePlanningProfileSummary | EngineProfileSummary | EngineCapOutput | EngineSolveOutput => {
    if (message.type === 'initialize') {
        engine?.free();
        engine = new WasmArmorEngine(message.profile);
        return engine.summary() as EngineProfileSummary;
    }

    if (message.type === 'initialize-planner') {
        planner?.free();
        planner = new WasmArmorPlanner(message.profile);
        return planner.summary() as EnginePlanningProfileSummary;
    }

    if (message.type === 'calculate-stat-caps') {
        if (!engine) {
            throw new Error('Armor engine has not been initialized.');
        }

        return engine.calculate_caps(message.request) as EngineCapOutput;
    }

    if (message.type === 'calculate-planning-stat-caps') {
        if (!planner) {
            throw new Error('Armor planner has not been initialized.');
        }

        return planner.calculate_caps(message.request) as EngineCapOutput;
    }

    const solver = message.type === 'plan' ? planner : engine;
    if (!solver) {
        throw new Error(message.type === 'plan' ? 'Armor planner has not been initialized.' : 'Armor engine has not been initialized.');
    }

    return executeSolveRequest(solver, message);
};

interface WasmSolver {
    solve(request: EngineSolveRequest): unknown;
}

const executeSolveRequest = (solver: WasmSolver, message: Extract<SolverWorkerRequest, { type: 'plan' | 'solve' }>): EngineSolveOutput => {
    const progressBuildCount = Math.max(0, Math.trunc(message.progressBuildCount ?? 0));
    if (progressBuildCount > 0 && progressBuildCount < message.request.maxResults) {
        const progress = solver.solve({
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

    return solver.solve(message.request) as EngineSolveOutput;
};
