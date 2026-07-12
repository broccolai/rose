use rose_armor_engine::AdjustmentInput;

use crate::support::no_adjustment;

pub fn full_pair_tunings() -> Vec<AdjustmentInput> {
    let mut options = vec![no_adjustment(0)];
    let mut source_index = 1_u16;

    for positive in 0..6 {
        for negative in 0..6 {
            if positive == negative {
                continue;
            }

            let mut deltas = [0; 6];
            deltas[positive] = 5;
            deltas[negative] = -5;
            options.push(AdjustmentInput {
                source_index,
                deltas,
            });
            source_index += 1;
        }
    }

    options
}
