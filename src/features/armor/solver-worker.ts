import {
    type ArmorStat,
    type ArmorStatTargetCapsInput,
    calculateArmorStatTargetCap,
    calculateArmorStatTargetCaps,
    type SolveArmorInput,
    type SolveArmorProgress,
    solveArmor
} from '@armor-calc';

export type SolverWorkerRequest =
    | {
          id: number;
          type: 'calculate-stat-cap';
          input: ArmorStatTargetCapsInput;
          stat: ArmorStat;
      }
    | {
          id: number;
          type: 'calculate-stat-caps';
          input: ArmorStatTargetCapsInput;
          stats: readonly ArmorStat[];
      }
    | {
          id: number;
          type: 'solve';
          input: SolveArmorInput;
          progressBuildCount?: number | undefined;
      };

export type SolverWorkerResponse =
    | {
          id: number;
          type: 'progress';
          result: SolveArmorProgress;
      }
    | {
          id: number;
          type: 'result';
          ok: true;
          result: unknown;
      }
    | {
          id: number;
          type: 'result';
          ok: false;
          error: string;
      };

self.onmessage = (event: MessageEvent<SolverWorkerRequest>) => {
    const message = event.data;

    try {
        const result =
            message.type === 'calculate-stat-cap'
                ? calculateArmorStatTargetCap(message.input, message.stat)
                : message.type === 'calculate-stat-caps'
                  ? calculateArmorStatTargetCaps(message.input, message.stats)
                  : solveArmor(message.input, {
                        progressBuildCount: message.progressBuildCount,
                        onProgress: (progress) => {
                            self.postMessage({
                                id: message.id,
                                type: 'progress',
                                result: progress
                            } satisfies SolverWorkerResponse);
                        }
                    });

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
            error: error instanceof Error ? error.message : 'Unknown armor solver worker failure.'
        } satisfies SolverWorkerResponse);
    }
};
