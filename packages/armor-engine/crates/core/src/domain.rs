//! Validated, zero-cost value types shared by the solver.

mod index;
mod stats;

pub(crate) use self::index::{ArmorSlot, CharacterClass, ClassCompatibility, Stat};
pub(crate) use self::stats::{
    MAJOR_MOD_POINTS, MINOR_MOD_POINTS, MajorModRequirements, StatMap, StatValues, TUNING_POINTS,
    minimum_tuning_steps, remaining_major_mod_bonus,
};
