import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initSync, WasmArmorEngine, WasmArmorPlanner } from '../../../src/features/armor/wasm/generated/rose_armor_wasm.js';
import {
    ARMOR_STATS,
    type ArmorInventoryBySlot,
    type ArmorPlanStatCapsInput,
    type ArmorStat,
    type ArmorStatTargetCapsInput,
    type PlanArmorInput,
    type PlanArmorResult,
    type SolveArmorInput,
    type SolveArmorResult,
    type StatVector
} from '../../armor-domain/src';
import {
    ArmorEngineAdapter,
    ArmorPlanningAdapter,
    type EnginePlanningProfileSummary,
    type EngineProfileSummary
} from '../../armor-engine/ts';

const wasmPath = fileURLToPath(new URL('../../../src/features/armor/wasm/generated/rose_armor_wasm_bg.wasm', import.meta.url));

let wasmMemory: WebAssembly.Memory | null = null;

export interface WasmEngineMeasurements {
    initializationMs: number;
    compactProfileBytes: number;
    summary: EngineProfileSummary;
}

export interface WasmPlannerMeasurements {
    initializationMs: number;
    compactProfileBytes: number;
    summary: EnginePlanningProfileSummary;
}

export class BenchmarkArmorEngine {
    readonly measurements: WasmEngineMeasurements;

    private readonly adapter: ArmorEngineAdapter;
    private readonly engine: WasmArmorEngine;

    constructor(armor: ArmorInventoryBySlot) {
        initializeWasm();
        this.adapter = new ArmorEngineAdapter(armor);

        const startedAt = performance.now();
        this.engine = new WasmArmorEngine(this.adapter.profile);
        const initializationMs = performance.now() - startedAt;

        this.measurements = {
            initializationMs,
            compactProfileBytes: JSON.stringify(this.adapter.profile).length,
            summary: this.engine.summary() as EngineProfileSummary
        };
    }

    get wasmMemoryMiB(): number {
        return (wasmMemory?.buffer.byteLength ?? 0) / (1024 * 1024);
    }

    calculateCap(input: ArmorStatTargetCapsInput, stat: ArmorStat): number {
        return this.calculateCaps(input, [stat])[stat];
    }

    calculateCaps(input: ArmorStatTargetCapsInput, stats: readonly ArmorStat[] = ARMOR_STATS): StatVector {
        const output = this.engine.calculate_caps(this.adapter.createCapRequest(input, stats));
        return this.adapter.materializeCaps(output).caps;
    }

    solve(input: SolveArmorInput): SolveArmorResult {
        const output = this.engine.solve(this.adapter.createSolveRequest(input));
        return this.adapter.materializeSolve(output);
    }

    requestBytes(input: ArmorStatTargetCapsInput): number {
        return JSON.stringify(this.adapter.createCapRequest(input, ARMOR_STATS)).length;
    }

    dispose(): void {
        this.engine.free();
    }
}

export class BenchmarkArmorPlanner {
    readonly measurements: WasmPlannerMeasurements;

    private readonly adapter: ArmorPlanningAdapter;
    private readonly planner: WasmArmorPlanner;

    constructor() {
        initializeWasm();
        this.adapter = new ArmorPlanningAdapter();

        const startedAt = performance.now();
        this.planner = new WasmArmorPlanner(this.adapter.profile);
        const initializationMs = performance.now() - startedAt;

        this.measurements = {
            initializationMs,
            compactProfileBytes: JSON.stringify(this.adapter.profile).length,
            summary: this.planner.summary() as EnginePlanningProfileSummary
        };
    }

    calculateCap(input: ArmorPlanStatCapsInput, stat: ArmorStat): number {
        return this.calculateCaps(input, [stat])[stat];
    }

    calculateCaps(input: ArmorPlanStatCapsInput, stats: readonly ArmorStat[] = ARMOR_STATS): StatVector {
        const output = this.planner.calculate_caps(this.adapter.createCapRequest(input, stats));
        return this.adapter.materializeCaps(output).caps;
    }

    plan(input: PlanArmorInput): PlanArmorResult {
        const output = this.planner.solve(this.adapter.createSolveRequest(input));
        return this.adapter.materializePlans(output);
    }

    dispose(): void {
        this.planner.free();
    }
}

const initializeWasm = (): void => {
    if (wasmMemory) {
        return;
    }

    wasmMemory = initSync({ module: readFileSync(wasmPath) }).memory;
};
