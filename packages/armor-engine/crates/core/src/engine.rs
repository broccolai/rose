//! Public solver facade and request pipeline.

mod bounds;
mod candidates;
mod cap;
mod profile;
mod results;
mod search;
mod solve;

use crate::adjustments::AllocationCache;
use crate::error::EngineError;
use crate::model::{
    CapOutput, CapRequest, ProfileInput, ProfileSummary, SearchMetrics, SolveOutput, SolveRequest,
};
use crate::request::{CapQuery, SolveQuery};

use self::candidates::CandidatePlan;
use self::cap::CapSession;
use self::profile::CompiledProfile;
use self::results::SolveFailure;
use self::search::search_plan;
use self::solve::SolveSession;

pub struct ArmorEngine {
    profile: CompiledProfile,
    allocation_cache: AllocationCache,
}

impl ArmorEngine {
    /// Compiles and indexes a normalized armor profile.
    ///
    /// # Errors
    ///
    /// Returns an error when item identities are duplicated or an item contains
    /// unsupported slot, class, mod, or tuning data.
    pub fn new(profile: ProfileInput) -> Result<Self, EngineError> {
        Ok(Self {
            profile: profile.try_into()?,
            allocation_cache: AllocationCache::default(),
        })
    }

    #[must_use]
    pub fn summary(&self) -> ProfileSummary {
        self.profile.summary()
    }

    /// Calculates exact reachable caps for the requested stats.
    ///
    /// # Errors
    ///
    /// Returns an error when request indexes, set requirements, or sorting data
    /// fall outside the engine's compact input contract.
    pub fn calculate_caps(&mut self, request: CapRequest) -> Result<CapOutput, EngineError> {
        let query = CapQuery::try_from(request)?;
        let Some(plan) = CandidatePlan::for_constraints(&self.profile, &query.constraints) else {
            return Ok(CapOutput {
                caps: [0; crate::model::STAT_COUNT],
                search: SearchMetrics::default(),
            });
        };

        let mut session = CapSession::new(&self.profile.items, &mut self.allocation_cache, &query);
        search_plan(&self.profile.items, &query.constraints, &plan, &mut session);
        Ok(session.finish())
    }

    /// Finds armor builds matching the supplied targets and constraints.
    ///
    /// # Errors
    ///
    /// Returns an error when the request is malformed or asks the engine to
    /// retain more than its supported result limit.
    pub fn solve(&mut self, request: SolveRequest) -> Result<SolveOutput, EngineError> {
        let query = SolveQuery::try_from(request)?;

        let Some(plan) = CandidatePlan::for_constraints(&self.profile, &query.constraints) else {
            return Ok(SolveFailure::MissingArmorSlot.into_output(SearchMetrics::default()));
        };
        let mut session =
            SolveSession::new(&self.profile.items, &mut self.allocation_cache, &query);
        search_plan(&self.profile.items, &query.constraints, &plan, &mut session);
        Ok(session.finish())
    }
}
