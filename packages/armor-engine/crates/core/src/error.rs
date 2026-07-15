use std::error::Error;
use std::fmt::{Display, Formatter};

/// Invalid profile or request data rejected before search begins.
#[derive(Clone, Debug, Eq, PartialEq)]
#[non_exhaustive]
pub enum EngineError {
    DuplicateSourceIndex { source_index: u32 },
    DuplicateStableId { stable_id: String },
    InvalidItemSlot { item_id: String, slot: u8 },
    InvalidItemClass { item_id: String, class_type: u8 },
    AdjustmentIndexTooLarge { item_id: String, source_index: u16 },
    InvalidStatMod { item_id: String },
    IncompleteStatMods { item_id: String },
    InvalidTuning { item_id: String },
    MissingNoTuning { item_id: String },
    InvalidCharacterClass { class_type: u8 },
    InvalidDumpStat { stat: u8 },
    InvalidSetPieceCount { set_id: u32, required_pieces: u8 },
    DuplicateSetRequirement { set_id: u32 },
    InvalidRequestedStat { stat: u8 },
    InvalidSortKey { key: u8 },
    ResultLimitTooLarge { requested: usize, maximum: usize },
}

impl Display for EngineError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::DuplicateSourceIndex { source_index } => {
                write!(formatter, "Duplicate source index {source_index}.")
            }
            Self::DuplicateStableId { stable_id } => {
                write!(formatter, "Duplicate stable item id {stable_id}.")
            }
            Self::InvalidItemSlot { item_id, slot } => {
                write!(formatter, "Item {item_id} has invalid slot {slot}.")
            }
            Self::InvalidItemClass {
                item_id,
                class_type,
            } => write!(
                formatter,
                "Item {item_id} has invalid class type {class_type}."
            ),
            Self::AdjustmentIndexTooLarge {
                item_id,
                source_index,
            } => write!(
                formatter,
                "Item {item_id} has adjustment index {source_index}, which exceeds the compact result format."
            ),
            Self::InvalidStatMod { item_id } => {
                write!(
                    formatter,
                    "Item {item_id} contains a non-standard modern stat mod."
                )
            }
            Self::IncompleteStatMods { item_id } => write!(
                formatter,
                "Item {item_id} does not expose the complete modern +10 stat-mod set."
            ),
            Self::InvalidTuning { item_id } => {
                write!(
                    formatter,
                    "Item {item_id} contains a non-standard modern tuning option."
                )
            }
            Self::MissingNoTuning { item_id } => {
                write!(formatter, "Item {item_id} is missing the no-tuning option.")
            }
            Self::InvalidCharacterClass { class_type } => {
                write!(formatter, "Invalid selected class type {class_type}.")
            }
            Self::InvalidDumpStat { stat } => {
                write!(formatter, "Invalid dump stat index {stat}.")
            }
            Self::InvalidSetPieceCount {
                set_id,
                required_pieces,
            } => write!(
                formatter,
                "Set {set_id} has invalid required piece count {required_pieces}."
            ),
            Self::DuplicateSetRequirement { set_id } => {
                write!(formatter, "Set {set_id} is required more than once.")
            }
            Self::InvalidRequestedStat { stat } => {
                write!(formatter, "Invalid requested stat index {stat}.")
            }
            Self::InvalidSortKey { key } => {
                write!(formatter, "Invalid result sort key {key}.")
            }
            Self::ResultLimitTooLarge { requested, maximum } => write!(
                formatter,
                "Result limit {requested} exceeds the maximum of {maximum}."
            ),
        }
    }
}

impl Error for EngineError {}
