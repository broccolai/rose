use std::cmp::Ordering;

use rustc_hash::FxHashSet;

use crate::addons::{AddonPlan, AddonProblem, AllocationCache, solve_addons, update_addon_caps};
use crate::item::Item;
use crate::model::{
    BuildOutput, CapOutput, CapRequest, EngineError, MAX_STAT, ProfileInput, ProfileSummary,
    Request, SLOT_COUNT, STAT_COUNT, SetRequirementInput, SolveOutput, SolveRequest, SortInput,
    Stats, add_in_place, clamp_targets, minimum_major_mods,
};

const SORT_WASTED: u8 = STAT_COUNT as u8;
const SORT_TOTAL: u8 = SORT_WASTED + 1;

pub struct ArmorEngine {
    items: Vec<Item>,
    by_slot: [Vec<usize>; SLOT_COUNT],
    allocation_cache: AllocationCache,
}

impl ArmorEngine {
    pub fn new(profile: ProfileInput) -> Result<Self, EngineError> {
        let mut source_indices = FxHashSet::default();
        let mut stable_ids = FxHashSet::default();
        let mut items = Vec::with_capacity(profile.items.len());
        for input in profile.items {
            if !source_indices.insert(input.source_index) {
                return Err(EngineError(format!(
                    "Duplicate source index {}.",
                    input.source_index
                )));
            }
            if !stable_ids.insert(input.stable_id.clone()) {
                return Err(EngineError(format!(
                    "Duplicate stable item id {}.",
                    input.stable_id
                )));
            }
            items.push(Item::compile(input)?);
        }

        let mut by_slot: [Vec<usize>; SLOT_COUNT] = std::array::from_fn(|_| Vec::new());
        for (index, item) in items.iter().enumerate() {
            by_slot[usize::from(item.slot)].push(index);
        }
        for slot in &mut by_slot {
            slot.sort_by(|left, right| items[*left].stable_id.cmp(&items[*right].stable_id));
        }

        Ok(Self {
            items,
            by_slot,
            allocation_cache: AllocationCache::default(),
        })
    }

    pub fn summary(&self) -> ProfileSummary {
        ProfileSummary {
            item_count: self.items.len(),
            slot_counts: self.by_slot.each_ref().map(Vec::len),
            warnings: Vec::new(),
        }
    }

    pub fn calculate_caps(&mut self, request: CapRequest) -> Result<CapOutput, EngineError> {
        let constraints = validate_request(request.constraints)?;
        let requested = requested_stats(&request.requested_stats)?;
        let Some(plan) = create_candidate_plan(&self.items, &self.by_slot, &constraints) else {
            return Ok(CapOutput {
                caps: [0; STAT_COUNT],
                searched_combinations: 0,
                rejected_combinations: 0,
            });
        };

        let items = &self.items;
        let cache = &mut self.allocation_cache;
        let mut session = CapSession {
            items,
            cache,
            request: &constraints,
            requested,
            caps: [0; STAT_COUNT],
            searched: 0,
            rejected: 0,
        };
        search_plan(items, &constraints, &plan, &mut session);
        if let Some(dump_stat) = constraints.dump_stat {
            session.caps[usize::from(dump_stat)] = 0;
        }

        Ok(CapOutput {
            caps: session.caps,
            searched_combinations: session.searched,
            rejected_combinations: session.rejected,
        })
    }

    pub fn solve(&mut self, request: SolveRequest) -> Result<SolveOutput, EngineError> {
        let constraints = validate_request(request.constraints)?;
        if request.max_results > 100_000 {
            return Err(EngineError("maxResults cannot exceed 100000.".into()));
        }
        if let Some(sort) = request.result_sort {
            validate_sort(sort)?;
        }

        let Some(plan) = create_candidate_plan(&self.items, &self.by_slot, &constraints) else {
            return Ok(failed_solve(
                "No compatible armor found for every armor slot.",
            ));
        };

        let items = &self.items;
        let cache = &mut self.allocation_cache;
        let mut session = SolveSession {
            items,
            cache,
            request: &constraints,
            max_results: request.max_results,
            result_sort: request.result_sort,
            stop_at_limit: request.stop_when_result_limit_reached && request.result_sort.is_none(),
            retained: Vec::with_capacity(request.max_results.min(30_000)),
            valid_build_count: 0,
            searched: 0,
            rejected: 0,
            result_limit_reached: false,
        };
        search_plan(items, &constraints, &plan, &mut session);
        session
            .retained
            .sort_by(|left, right| compare_retained(left, right, session.result_sort));

        if session.valid_build_count == 0 {
            return Ok(SolveOutput {
                ok: false,
                reason: Some("No build matched the selected targets and constraints.".into()),
                builds: Vec::new(),
                valid_build_count: 0,
                returned_build_count: 0,
                result_limit_reached: false,
                searched_combinations: session.searched,
                rejected_combinations: session.rejected,
                warnings: Vec::new(),
            });
        }

        let builds = session
            .retained
            .into_iter()
            .map(|retained| retained.output)
            .collect::<Vec<_>>();
        Ok(SolveOutput {
            ok: true,
            reason: None,
            returned_build_count: builds.len(),
            result_limit_reached: session.result_limit_reached
                || session.valid_build_count > builds.len() as u64,
            builds,
            valid_build_count: session.valid_build_count,
            searched_combinations: session.searched,
            rejected_combinations: session.rejected,
            warnings: Vec::new(),
        })
    }
}

struct CandidatePlan {
    slots: [Vec<usize>; SLOT_COUNT],
    suffix_max_without_mods: [Stats; SLOT_COUNT + 1],
}

fn create_candidate_plan(
    items: &[Item],
    by_slot: &[Vec<usize>; SLOT_COUNT],
    request: &Request,
) -> Option<CandidatePlan> {
    let compatible: [Vec<usize>; SLOT_COUNT] = std::array::from_fn(|slot| {
        by_slot[slot]
            .iter()
            .copied()
            .filter(|index| items[*index].compatible_with(request.class_type))
            .collect()
    });
    let legendary: [Vec<usize>; SLOT_COUNT] = std::array::from_fn(|slot| {
        compatible[slot]
            .iter()
            .copied()
            .filter(|index| !items[*index].is_exotic)
            .collect()
    });

    let mut slots = legendary;
    if let Some(exotic_hash) = request.selected_exotic_item_hash {
        let (slot, exotics) = (0..SLOT_COUNT).find_map(|slot| {
            let exotics = compatible[slot]
                .iter()
                .copied()
                .filter(|index| items[*index].is_exotic && items[*index].item_hash == exotic_hash)
                .collect::<Vec<_>>();
            if exotics.is_empty() {
                None
            } else {
                Some((slot, exotics))
            }
        })?;
        slots[slot] = exotics;
    }

    if slots.iter().any(Vec::is_empty) {
        return None;
    }
    let dump_stat = request.dump_stat.map(usize::from);
    for candidates in &mut slots {
        candidates.sort_by(|left, right| {
            target_priority(&items[*right], request, dump_stat)
                .cmp(&target_priority(&items[*left], request, dump_stat))
                .then_with(|| items[*left].stable_id.cmp(&items[*right].stable_id))
        });
    }
    let suffix_max_without_mods = suffix_max(items, &slots, request);
    Some(CandidatePlan {
        slots,
        suffix_max_without_mods,
    })
}

fn target_priority(item: &Item, request: &Request, dump_stat: Option<usize>) -> i32 {
    let mut score = 0_i32;
    for stat in 0..STAT_COUNT {
        if dump_stat == Some(stat) {
            continue;
        }
        let target = request.targets[stat];
        let weight = if target > 0 { 8 } else { 1 };
        let potential = item.base_stats[stat]
            + item.max_tuning_gain(stat, dump_stat, request.allow_balanced_tuning);
        score += i32::from(potential.min(target.max(25))) * weight;
    }
    if item.set_id.is_some_and(|set_id| {
        request
            .set_requirements
            .iter()
            .any(|requirement| requirement.set_id == set_id)
    }) {
        score += 10_000;
    }
    score
}

fn suffix_max(
    items: &[Item],
    slots: &[Vec<usize>; SLOT_COUNT],
    request: &Request,
) -> [Stats; SLOT_COUNT + 1] {
    let mut suffix = [[0; STAT_COUNT]; SLOT_COUNT + 1];
    let dump_stat = request.dump_stat.map(usize::from);
    for slot in (0..SLOT_COUNT).rev() {
        let mut slot_max = [i16::MIN; STAT_COUNT];
        for index in &slots[slot] {
            let item = &items[*index];
            for (stat, maximum) in slot_max.iter_mut().enumerate() {
                let potential = item.base_stats[stat]
                    + item.max_tuning_gain(stat, dump_stat, request.allow_balanced_tuning);
                *maximum = (*maximum).max(potential);
            }
        }
        for stat in 0..STAT_COUNT {
            suffix[slot][stat] = suffix[slot + 1][stat] + slot_max[stat].max(0);
        }
    }
    suffix
}

struct SearchState {
    selected: [usize; SLOT_COUNT],
    base_stats: Stats,
    potential_stats: Stats,
}

impl SearchState {
    fn new(stat_bonuses: Stats) -> Self {
        Self {
            selected: [usize::MAX; SLOT_COUNT],
            base_stats: stat_bonuses,
            potential_stats: stat_bonuses,
        }
    }

    fn select(&mut self, slot: usize, item_index: usize, item: &Item, maximum: &Stats) {
        self.selected[slot] = item_index;
        add_in_place(&mut self.base_stats, &item.base_stats);
        add_in_place(&mut self.potential_stats, maximum);
    }

    fn deselect(&mut self, slot: usize, item: &Item, maximum: &Stats) {
        for (stat, maximum_value) in maximum.iter().enumerate() {
            self.base_stats[stat] -= item.base_stats[stat];
            self.potential_stats[stat] -= maximum_value;
        }
        self.selected[slot] = usize::MAX;
    }
}

trait SearchVisitor {
    fn should_stop(&self) -> bool;
    fn can_continue(&self, current: &Stats, remaining: &Stats) -> bool;
    fn reject(&mut self, combinations: u64);
    fn visit_leaf(&mut self, selected: &[usize; SLOT_COUNT], base_stats: Stats);
}

fn search_plan<V: SearchVisitor>(
    items: &[Item],
    request: &Request,
    plan: &CandidatePlan,
    visitor: &mut V,
) {
    let mut state = SearchState::new(request.stat_bonuses);
    search_slot(items, request, plan, visitor, &mut state, 0);
}

fn search_slot<V: SearchVisitor>(
    items: &[Item],
    request: &Request,
    plan: &CandidatePlan,
    visitor: &mut V,
    state: &mut SearchState,
    slot: usize,
) {
    if visitor.should_stop() {
        return;
    }
    if !visitor.can_continue(&state.potential_stats, &plan.suffix_max_without_mods[slot])
        || !can_still_meet_sets(
            items,
            &state.selected,
            slot,
            &plan.slots,
            &request.set_requirements,
        )
    {
        visitor.reject(product_remaining(&plan.slots, slot));
        return;
    }
    if slot == SLOT_COUNT {
        visitor.visit_leaf(&state.selected, state.base_stats);
        return;
    }

    for item_index in &plan.slots[slot] {
        let item = &items[*item_index];
        let maximum = maximum_without_mods(item, request);
        state.select(slot, *item_index, item, &maximum);
        search_slot(items, request, plan, visitor, state, slot + 1);
        state.deselect(slot, item, &maximum);
        if visitor.should_stop() {
            return;
        }
    }
}

fn maximum_without_mods(item: &Item, request: &Request) -> Stats {
    let mut maximum = item.base_stats;
    let dump_stat = request.dump_stat.map(usize::from);
    for (stat, value) in maximum.iter_mut().enumerate() {
        *value += item.max_tuning_gain(stat, dump_stat, request.allow_balanced_tuning);
    }
    maximum
}

struct SolveSession<'a> {
    items: &'a [Item],
    cache: &'a mut AllocationCache,
    request: &'a Request,
    max_results: usize,
    result_sort: Option<SortInput>,
    stop_at_limit: bool,
    retained: Vec<RetainedBuild>,
    valid_build_count: u64,
    searched: u64,
    rejected: u64,
    result_limit_reached: bool,
}

impl SolveSession<'_> {
    fn retain(&mut self, selected: &[usize; SLOT_COUNT], addons: AddonPlan) {
        if self.max_results == 0 {
            return;
        }

        let retained = RetainedBuild {
            output: BuildOutput {
                item_indices: selected.map(|index| self.items[index].source_index),
                stat_mod_indices: addons.stat_mod_indices,
                tuning_indices: addons.tuning_indices,
                stats: addons.stats,
                wasted_stats: addons.wasted_stats,
                total_stats: addons.total_stats,
            },
            item_indexes: *selected,
        };
        if self.retained.len() < self.max_results {
            self.retained.push(retained);
            return;
        }
        let Some(sort) = self.result_sort else {
            return;
        };
        let worst = (0..self.retained.len())
            .max_by(|left, right| {
                compare_retained(&self.retained[*left], &self.retained[*right], Some(sort))
            })
            .expect("non-empty retained list");
        if compare_retained(&retained, &self.retained[worst], Some(sort)) == Ordering::Less {
            self.retained[worst] = retained;
        }
    }
}

impl SearchVisitor for SolveSession<'_> {
    fn should_stop(&self) -> bool {
        self.result_limit_reached
    }

    fn can_continue(&self, current: &Stats, remaining: &Stats) -> bool {
        can_still_reach_targets(
            current,
            remaining,
            &self.request.targets,
            self.request.dump_stat.map(usize::from),
        )
    }

    fn reject(&mut self, combinations: u64) {
        self.rejected = self.rejected.saturating_add(combinations);
    }

    fn visit_leaf(&mut self, selected: &[usize; SLOT_COUNT], base_stats: Stats) {
        self.searched += 1;
        let problem = AddonProblem {
            items: self.items,
            selected,
            base_stats,
            targets: self.request.targets,
            dump_stat: self.request.dump_stat.map(usize::from),
            allow_balanced_tuning: self.request.allow_balanced_tuning,
        };
        let Some(addons) = solve_addons(problem, self.cache) else {
            self.rejected += 1;
            return;
        };

        self.valid_build_count += 1;
        self.retain(selected, addons);
        if self.stop_at_limit && self.valid_build_count >= self.max_results as u64 {
            self.result_limit_reached = true;
        }
    }
}

struct CapSession<'a> {
    items: &'a [Item],
    cache: &'a mut AllocationCache,
    request: &'a Request,
    requested: [bool; STAT_COUNT],
    caps: Stats,
    searched: u64,
    rejected: u64,
}

impl CapSession<'_> {
    fn complete(&self) -> bool {
        (0..STAT_COUNT).all(|stat| {
            !self.requested[stat]
                || self.request.dump_stat == Some(stat as u8)
                || self.caps[stat] >= MAX_STAT
        })
    }
}

impl SearchVisitor for CapSession<'_> {
    fn should_stop(&self) -> bool {
        self.complete()
    }

    fn can_continue(&self, current: &Stats, remaining: &Stats) -> bool {
        can_still_improve_any_cap(
            current,
            remaining,
            &self.request.targets,
            self.request.dump_stat.map(usize::from),
            &self.requested,
            &self.caps,
        )
    }

    fn reject(&mut self, combinations: u64) {
        self.rejected = self.rejected.saturating_add(combinations);
    }

    fn visit_leaf(&mut self, selected: &[usize; SLOT_COUNT], base_stats: Stats) {
        self.searched += 1;
        update_addon_caps(
            &mut self.caps,
            &self.requested,
            AddonProblem {
                items: self.items,
                selected,
                base_stats,
                targets: self.request.targets,
                dump_stat: self.request.dump_stat.map(usize::from),
                allow_balanced_tuning: self.request.allow_balanced_tuning,
            },
            self.cache,
        );
    }
}

fn can_still_reach_targets(
    current: &Stats,
    remaining: &Stats,
    targets: &Stats,
    dump_stat: Option<usize>,
) -> bool {
    let required_mods = (0..STAT_COUNT)
        .filter(|stat| dump_stat != Some(*stat))
        .map(|stat| minimum_major_mods(current[stat] + remaining[stat], targets[stat]))
        .sum::<usize>();
    required_mods <= SLOT_COUNT
}

fn can_still_improve_any_cap(
    current: &Stats,
    remaining: &Stats,
    targets: &Stats,
    dump_stat: Option<usize>,
    requested: &[bool; STAT_COUNT],
    caps: &Stats,
) -> bool {
    for score_stat in 0..STAT_COUNT {
        if !requested[score_stat] || dump_stat == Some(score_stat) || caps[score_stat] >= MAX_STAT {
            continue;
        }
        let required_other_mods = (0..STAT_COUNT)
            .filter(|stat| dump_stat != Some(*stat) && *stat != score_stat)
            .map(|stat| minimum_major_mods(current[stat] + remaining[stat], targets[stat]))
            .sum::<usize>();
        if required_other_mods > SLOT_COUNT {
            continue;
        }
        let upper = (current[score_stat]
            + remaining[score_stat]
            + i16::try_from((SLOT_COUNT - required_other_mods) * 10).unwrap_or(50))
        .clamp(0, MAX_STAT);
        if upper > caps[score_stat] {
            return true;
        }
    }
    false
}

fn can_still_meet_sets(
    items: &[Item],
    selected: &[usize; SLOT_COUNT],
    next_slot: usize,
    slots: &[Vec<usize>; SLOT_COUNT],
    requirements: &[SetRequirementInput],
) -> bool {
    requirements.iter().all(|requirement| {
        let selected_count = selected[..next_slot]
            .iter()
            .filter(|index| items[**index].set_id == Some(requirement.set_id))
            .count();
        let possible_remaining = slots[next_slot..]
            .iter()
            .filter(|candidates| {
                candidates
                    .iter()
                    .any(|index| items[*index].set_id == Some(requirement.set_id))
            })
            .count();
        selected_count + possible_remaining >= usize::from(requirement.required_pieces)
    })
}

fn product_remaining(slots: &[Vec<usize>; SLOT_COUNT], next_slot: usize) -> u64 {
    slots[next_slot..]
        .iter()
        .fold(1_u64, |product, candidates| {
            product.saturating_mul(candidates.len() as u64)
        })
}

fn validate_request(mut request: Request) -> Result<Request, EngineError> {
    if request.class_type > 2 {
        return Err(EngineError(format!(
            "Invalid selected class type {}.",
            request.class_type
        )));
    }
    if request
        .dump_stat
        .is_some_and(|stat| usize::from(stat) >= STAT_COUNT)
    {
        return Err(EngineError("Invalid dump stat index.".into()));
    }
    request.targets = clamp_targets(request.targets);
    let mut set_ids = FxHashSet::default();
    for requirement in &request.set_requirements {
        if requirement.required_pieces == 0 || usize::from(requirement.required_pieces) > SLOT_COUNT
        {
            return Err(EngineError(format!(
                "Set {} has invalid required piece count {}.",
                requirement.set_id, requirement.required_pieces
            )));
        }
        if !set_ids.insert(requirement.set_id) {
            return Err(EngineError(format!(
                "Set {} is required more than once.",
                requirement.set_id
            )));
        }
    }
    Ok(request)
}

fn requested_stats(stats: &[u8]) -> Result<[bool; STAT_COUNT], EngineError> {
    let mut requested = [stats.is_empty(); STAT_COUNT];
    for stat in stats {
        if usize::from(*stat) >= STAT_COUNT {
            return Err(EngineError(format!("Invalid requested stat index {stat}.")));
        }
        requested[usize::from(*stat)] = true;
    }
    Ok(requested)
}

fn validate_sort(sort: SortInput) -> Result<(), EngineError> {
    if sort.key > SORT_TOTAL {
        return Err(EngineError(format!(
            "Invalid result sort key {}.",
            sort.key
        )));
    }
    Ok(())
}

#[derive(Clone)]
struct RetainedBuild {
    output: BuildOutput,
    item_indexes: [usize; SLOT_COUNT],
}

fn compare_retained(
    left: &RetainedBuild,
    right: &RetainedBuild,
    sort: Option<SortInput>,
) -> Ordering {
    let primary = if let Some(sort) = sort {
        let ordering = sort_value(&left.output, sort.key).cmp(&sort_value(&right.output, sort.key));
        if sort.descending {
            ordering.reverse()
        } else {
            ordering
        }
    } else {
        left.output.wasted_stats.cmp(&right.output.wasted_stats)
    };
    primary
        .then_with(|| left.output.wasted_stats.cmp(&right.output.wasted_stats))
        .then_with(|| right.output.total_stats.cmp(&left.output.total_stats))
        .then_with(|| left.item_indexes.cmp(&right.item_indexes))
}

fn sort_value(build: &BuildOutput, key: u8) -> i16 {
    match key {
        0..=5 => build.stats[usize::from(key)],
        SORT_WASTED => build.wasted_stats,
        SORT_TOTAL => build.total_stats,
        _ => 0,
    }
}

fn failed_solve(reason: &str) -> SolveOutput {
    SolveOutput {
        ok: false,
        reason: Some(reason.into()),
        builds: Vec::new(),
        valid_build_count: 0,
        returned_build_count: 0,
        result_limit_reached: false,
        searched_combinations: 0,
        rejected_combinations: 0,
        warnings: Vec::new(),
    }
}
