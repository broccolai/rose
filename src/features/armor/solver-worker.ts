import { type ArmorStat, type ArmorStatTargetCapsInput, calculateArmorStatTargetCap, type SolveArmorInput, solveArmor } from '@armor-calc';

export type SolverWorkerRequest =
    | {
          id: number;
          type: 'calculate-stat-cap';
          input: ArmorStatTargetCapsInput;
          stat: ArmorStat;
      }
    | {
          id: number;
          type: 'solve';
          input: SolveArmorInput;
      };

export type SolverWorkerResponse =
    | {
          id: number;
          ok: true;
          result: unknown;
      }
    | {
          id: number;
          ok: false;
          error: string;
      };

self.onmessage = (event: MessageEvent<SolverWorkerRequest>) => {
    const message = event.data;

    try {
        const result =
            message.type === 'calculate-stat-cap' ? calculateArmorStatTargetCap(message.input, message.stat) : solveArmor(message.input);

        self.postMessage({
            id: message.id,
            ok: true,
            result
        } satisfies SolverWorkerResponse);
    } catch (error) {
        self.postMessage({
            id: message.id,
            ok: false,
            error: error instanceof Error ? error.message : 'Unknown armor solver worker failure.'
        } satisfies SolverWorkerResponse);
    }
};
