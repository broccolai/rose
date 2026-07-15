use serde::{Serialize, Serializer};

use super::{SLOT_COUNT, Stats};

/// Summary of the compiled owned-armor profile.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileSummary {
    pub item_count: usize,
    pub slot_counts: [usize; SLOT_COUNT],
}

/// Summary of the compiled planning-roll catalog.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanningProfileSummary {
    pub roll_count: usize,
}

/// Number of complete and pruned combinations visited by a calculation.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMetrics {
    pub searched_combinations: u64,
    pub rejected_combinations: u64,
}

impl SearchMetrics {
    pub(crate) fn evaluate_combination(&mut self) {
        self.searched_combinations += 1;
    }

    pub(crate) fn prune_combinations(&mut self, combinations: u64) {
        self.rejected_combinations = self.rejected_combinations.saturating_add(combinations);
    }
}

/// Exact displayed caps and their search metrics.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CapOutput {
    pub caps: Stats,
    pub search: SearchMetrics,
}

impl Serialize for CapOutput {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        CapOutputWire {
            caps: &self.caps,
            searched_combinations: self.search.searched_combinations,
            rejected_combinations: self.search.rejected_combinations,
        }
        .serialize(serializer)
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CapOutputWire<'a> {
    caps: &'a Stats,
    searched_combinations: u64,
    rejected_combinations: u64,
}

/// One compact build returned by the solver.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildOutput {
    pub item_indices: [u32; SLOT_COUNT],
    pub stat_mod_indices: [i16; SLOT_COUNT],
    pub tuning_indices: [i16; SLOT_COUNT],
    pub stats: Stats,
    pub wasted_stats: i16,
    pub total_stats: i16,
}

/// Build results and aggregate search information.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SolveOutput {
    pub ok: bool,
    pub reason: Option<String>,
    pub builds: Vec<BuildOutput>,
    pub valid_build_count: u64,
    pub returned_build_count: usize,
    pub result_limit_reached: bool,
    pub search: SearchMetrics,
}

impl SolveOutput {
    pub(crate) fn failure(reason: impl Into<String>, search: SearchMetrics) -> Self {
        Self {
            ok: false,
            reason: Some(reason.into()),
            builds: Vec::new(),
            valid_build_count: 0,
            returned_build_count: 0,
            result_limit_reached: false,
            search,
        }
    }

    pub(crate) fn success(
        builds: Vec<BuildOutput>,
        valid_build_count: u64,
        result_limit_reached: bool,
        search: SearchMetrics,
    ) -> Self {
        Self {
            ok: true,
            reason: None,
            returned_build_count: builds.len(),
            builds,
            valid_build_count,
            result_limit_reached,
            search,
        }
    }
}

impl Serialize for SolveOutput {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        SolveOutputWire {
            ok: self.ok,
            reason: &self.reason,
            builds: &self.builds,
            valid_build_count: self.valid_build_count,
            returned_build_count: self.returned_build_count,
            result_limit_reached: self.result_limit_reached,
            searched_combinations: self.search.searched_combinations,
            rejected_combinations: self.search.rejected_combinations,
        }
        .serialize(serializer)
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SolveOutputWire<'a> {
    ok: bool,
    reason: &'a Option<String>,
    builds: &'a [BuildOutput],
    valid_build_count: u64,
    returned_build_count: usize,
    result_limit_reached: bool,
    searched_combinations: u64,
    rejected_combinations: u64,
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{CapOutput, SearchMetrics, SolveOutput};

    #[test]
    fn cap_output_serializes_metrics_as_plain_top_level_fields() -> Result<(), serde_json::Error> {
        let output = CapOutput {
            caps: [5, 10, 15, 20, 25, 30],
            search: SearchMetrics {
                searched_combinations: 12,
                rejected_combinations: 34,
            },
        };

        assert_eq!(
            serde_json::to_value(output)?,
            json!({
                "caps": [5, 10, 15, 20, 25, 30],
                "searchedCombinations": 12,
                "rejectedCombinations": 34
            })
        );
        Ok(())
    }

    #[test]
    fn solve_output_serializes_metrics_as_plain_top_level_fields() -> Result<(), serde_json::Error>
    {
        let output = SolveOutput::failure(
            "No build",
            SearchMetrics {
                searched_combinations: 56,
                rejected_combinations: 78,
            },
        );

        assert_eq!(
            serde_json::to_value(output)?,
            json!({
                "ok": false,
                "reason": "No build",
                "builds": [],
                "validBuildCount": 0,
                "returnedBuildCount": 0,
                "resultLimitReached": false,
                "searchedCombinations": 56,
                "rejectedCombinations": 78
            })
        );
        Ok(())
    }
}
