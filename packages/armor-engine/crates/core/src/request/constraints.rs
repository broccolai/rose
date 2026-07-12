//! Character, stat, exotic, and armor-set constraints shared by caps and solves.

use rustc_hash::FxHashSet;

use crate::domain::{CharacterClass, Stat, StatValues};
use crate::error::EngineError;
use crate::model::{ConstraintsInput, SLOT_COUNT, SetRequirementInput};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct SetRequirement {
    pub set_id: u32,
    pub required_pieces: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct Constraints {
    pub class: CharacterClass,
    pub selected_exotic_item_hash: Option<u32>,
    pub dump_stat: Option<Stat>,
    pub allow_balanced_tuning: bool,
    pub targets: StatValues,
    pub stat_bonuses: StatValues,
    pub set_requirements: Box<[SetRequirement]>,
}

impl Constraints {
    pub fn is_dump_stat(&self, stat: Stat) -> bool {
        self.dump_stat == Some(stat)
    }
}

impl TryFrom<ConstraintsInput> for Constraints {
    type Error = EngineError;

    fn try_from(input: ConstraintsInput) -> Result<Self, Self::Error> {
        let class = CharacterClass::try_from(input.class_type)
            .map_err(|class_type| EngineError::InvalidCharacterClass { class_type })?;
        let dump_stat = input
            .dump_stat
            .map(|stat| Stat::try_from(stat).map_err(|stat| EngineError::InvalidDumpStat { stat }))
            .transpose()?;

        Ok(Self {
            class,
            selected_exotic_item_hash: input.selected_exotic_item_hash,
            dump_stat,
            allow_balanced_tuning: input.allow_balanced_tuning,
            targets: StatValues::from(input.targets).clamped(),
            stat_bonuses: input.stat_bonuses.into(),
            set_requirements: validate_set_requirements(input.set_requirements)?,
        })
    }
}

fn validate_set_requirements(
    inputs: Vec<SetRequirementInput>,
) -> Result<Box<[SetRequirement]>, EngineError> {
    let mut set_ids = FxHashSet::default();
    let mut requirements = Vec::with_capacity(inputs.len());

    for input in inputs {
        let required_pieces = usize::from(input.required_pieces);
        if !(1..=SLOT_COUNT).contains(&required_pieces) {
            return Err(EngineError::InvalidSetPieceCount {
                set_id: input.set_id,
                required_pieces: input.required_pieces,
            });
        }

        if !set_ids.insert(input.set_id) {
            return Err(EngineError::DuplicateSetRequirement {
                set_id: input.set_id,
            });
        }

        requirements.push(SetRequirement {
            set_id: input.set_id,
            required_pieces,
        });
    }

    Ok(requirements.into_boxed_slice())
}
