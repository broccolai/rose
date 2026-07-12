//! Cap selection, solve result limits, and result ordering.

use std::cmp::Ordering;

use crate::domain::{Stat, StatMap};
use crate::error::EngineError;
use crate::model::{CapRequest, SolveRequest, SortInput};

use super::Constraints;

const SORT_WASTED: u8 = 6;
const SORT_TOTAL: u8 = 7;
const MAX_RESULTS: usize = 100_000;
const INITIAL_RESULT_CAPACITY: usize = 30_000;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct RequestedStats(StatMap<bool>);

impl RequestedStats {
    pub fn contains(self, stat: Stat) -> bool {
        self.0[stat]
    }
}

impl TryFrom<Vec<u8>> for RequestedStats {
    type Error = EngineError;

    fn try_from(inputs: Vec<u8>) -> Result<Self, Self::Error> {
        let mut requested = Self(StatMap::filled(inputs.is_empty()));

        for input in inputs {
            let stat =
                Stat::try_from(input).map_err(|stat| EngineError::InvalidRequestedStat { stat })?;
            requested.0[stat] = true;
        }

        Ok(requested)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum SortKey {
    Stat(Stat),
    Wasted,
    Total,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum SortDirection {
    Ascending,
    Descending,
}

impl SortDirection {
    fn apply(self, ordering: Ordering) -> Ordering {
        match self {
            Self::Ascending => ordering,
            Self::Descending => ordering.reverse(),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct SortOrder {
    key: SortKey,
    direction: SortDirection,
}

impl SortOrder {
    pub fn compare(self, left: i16, right: i16) -> Ordering {
        self.direction.apply(left.cmp(&right))
    }

    pub const fn key(self) -> SortKey {
        self.key
    }
}

impl TryFrom<SortInput> for SortOrder {
    type Error = EngineError;

    fn try_from(input: SortInput) -> Result<Self, Self::Error> {
        let key = match input.key {
            SORT_WASTED => SortKey::Wasted,
            SORT_TOTAL => SortKey::Total,
            key => SortKey::Stat(
                Stat::try_from(key).map_err(|key| EngineError::InvalidSortKey { key })?,
            ),
        };
        let direction = if input.descending {
            SortDirection::Descending
        } else {
            SortDirection::Ascending
        };

        Ok(Self { key, direction })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct ResultLimit(usize);

impl ResultLimit {
    pub fn is_zero(self) -> bool {
        self.0 == 0
    }

    pub fn value(self) -> usize {
        self.0
    }

    pub fn initial_capacity(self) -> usize {
        self.0.min(INITIAL_RESULT_CAPACITY)
    }

    pub fn reached_by(self, build_count: u64) -> bool {
        let limit = u64::try_from(self.0).unwrap_or(u64::MAX);
        build_count >= limit
    }
}

impl TryFrom<usize> for ResultLimit {
    type Error = EngineError;

    fn try_from(value: usize) -> Result<Self, Self::Error> {
        if value > MAX_RESULTS {
            return Err(EngineError::ResultLimitTooLarge {
                requested: value,
                maximum: MAX_RESULTS,
            });
        }

        Ok(Self(value))
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct CapQuery {
    pub constraints: Constraints,
    pub requested_stats: RequestedStats,
}

impl TryFrom<CapRequest> for CapQuery {
    type Error = EngineError;

    fn try_from(request: CapRequest) -> Result<Self, Self::Error> {
        Ok(Self {
            constraints: request.constraints.try_into()?,
            requested_stats: request.requested_stats.try_into()?,
        })
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct SolveQuery {
    pub constraints: Constraints,
    pub result_limit: ResultLimit,
    pub sort: Option<SortOrder>,
    pub stop_at_limit: bool,
}

impl TryFrom<SolveRequest> for SolveQuery {
    type Error = EngineError;

    fn try_from(request: SolveRequest) -> Result<Self, Self::Error> {
        let sort = request.result_sort.map(SortOrder::try_from).transpose()?;

        Ok(Self {
            constraints: request.constraints.try_into()?,
            result_limit: request.max_results.try_into()?,
            stop_at_limit: request.stop_when_result_limit_reached && sort.is_none(),
            sort,
        })
    }
}
