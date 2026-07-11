use rustc_hash::FxHashMap;

use crate::item::Item;
use crate::model::{
    MAX_STAT, NO_CHOICE, SLOT_COUNT, STAT_COUNT, Stats, add_in_place, displayed,
    minimum_major_mods, total,
};

const MAX_ALLOCATION_CACHE_ENTRIES: usize = 2_048;
const NO_TUNING_CODE: i8 = -1;
const BALANCED_TUNING_CODE: i8 = -2;

#[derive(Clone, Debug)]
pub(crate) struct AddonPlan {
    pub stats: Stats,
    pub stat_mod_indices: [i16; SLOT_COUNT],
    pub tuning_indices: [i16; SLOT_COUNT],
    pub wasted_stats: i16,
    pub total_stats: i16,
    used_tunings: u8,
}

#[derive(Clone, Copy)]
pub(crate) struct AddonProblem<'a> {
    pub items: &'a [Item],
    pub selected: &'a [usize; SLOT_COUNT],
    pub base_stats: Stats,
    pub targets: Stats,
    pub dump_stat: Option<usize>,
    pub allow_balanced_tuning: bool,
}

impl AddonProblem<'_> {
    fn with_targets(self, targets: Stats) -> Self {
        Self { targets, ..self }
    }
}

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
struct AllocationKey {
    signatures: [u64; SLOT_COUNT],
    dump_stat: u8,
}

#[derive(Clone, Copy, Debug)]
struct TuningAllocation {
    deltas: Stats,
    choices: [u8; SLOT_COUNT],
    used_tunings: u8,
}

#[derive(Default)]
pub(crate) struct AllocationCache {
    entries: FxHashMap<AllocationKey, Box<[TuningAllocation]>>,
}

impl AllocationCache {
    fn restricted_allocations(
        &mut self,
        items: &[Item],
        selected: &[usize; SLOT_COUNT],
        dump_stat: usize,
    ) -> &[TuningAllocation] {
        let key = AllocationKey {
            signatures: selected.map(|index| items[index].tuning_signature),
            dump_stat: dump_stat as u8,
        };
        if !self.entries.contains_key(&key) {
            let mut current = FxHashMap::default();
            current.insert(
                [0; STAT_COUNT],
                TuningAllocation {
                    deltas: [0; STAT_COUNT],
                    choices: [0; SLOT_COUNT],
                    used_tunings: 0,
                },
            );

            for slot in 0..SLOT_COUNT {
                let item = &items[selected[slot]];
                let mut next = FxHashMap::default();
                for allocation in current.values() {
                    retain_preferred_allocation(&mut next, *allocation);
                    for (choice_index, choice) in item.pair_tunings.iter().enumerate() {
                        if usize::from(choice.negative) != dump_stat {
                            continue;
                        }

                        let mut candidate = *allocation;
                        candidate.deltas[usize::from(choice.positive)] += 5;
                        candidate.deltas[usize::from(choice.negative)] -= 5;
                        candidate.choices[slot] =
                            u8::try_from(choice_index + 1).expect("at most 30 pair choices");
                        candidate.used_tunings += 1;
                        retain_preferred_allocation(&mut next, candidate);
                    }
                }
                current = next;
            }

            let mut allocations = current.into_values().collect::<Vec<_>>();
            allocations.sort_by(|left, right| {
                left.deltas
                    .cmp(&right.deltas)
                    .then_with(|| left.choices.cmp(&right.choices))
            });
            if self.entries.len() >= MAX_ALLOCATION_CACHE_ENTRIES {
                self.entries.clear();
            }
            self.entries.insert(key, allocations.into_boxed_slice());
        }

        &self.entries[&key]
    }
}

fn retain_preferred_allocation(
    allocations: &mut FxHashMap<Stats, TuningAllocation>,
    candidate: TuningAllocation,
) {
    match allocations.get_mut(&candidate.deltas) {
        Some(current)
            if candidate.used_tunings > current.used_tunings
                || (candidate.used_tunings == current.used_tunings
                    && candidate.choices < current.choices) =>
        {
            *current = candidate;
        }
        None => {
            allocations.insert(candidate.deltas, candidate);
        }
        _ => {}
    }
}

pub(crate) fn solve_addons(
    problem: AddonProblem<'_>,
    cache: &mut AllocationCache,
) -> Option<AddonPlan> {
    if let Some(dump_stat) = problem.dump_stat
        && !problem.allow_balanced_tuning
    {
        return solve_restricted_dump(problem, dump_stat, cache);
    }

    solve_unrestricted(problem)
}

pub(crate) fn update_addon_caps(
    caps: &mut Stats,
    requested: &[bool; STAT_COUNT],
    problem: AddonProblem<'_>,
    cache: &mut AllocationCache,
) {
    if let Some(dump_stat) = problem.dump_stat
        && !problem.allow_balanced_tuning
    {
        update_restricted_caps(caps, requested, problem, dump_stat, cache);
        return;
    }

    for score_stat in 0..STAT_COUNT {
        if !requested[score_stat]
            || problem.dump_stat == Some(score_stat)
            || caps[score_stat] >= MAX_STAT
        {
            continue;
        }

        let mut low = caps[score_stat];
        let mut high = MAX_STAT;
        let mut candidate_targets = problem.targets;
        while low < high {
            let candidate = low + (high - low + 1) / 2;
            candidate_targets[score_stat] = candidate;
            if solve_unrestricted(problem.with_targets(candidate_targets)).is_some() {
                low = candidate;
            } else {
                high = candidate - 1;
            }
        }
        caps[score_stat] = low;
    }
}

fn solve_restricted_dump(
    problem: AddonProblem<'_>,
    dump_stat: usize,
    cache: &mut AllocationCache,
) -> Option<AddonPlan> {
    let allocations = cache.restricted_allocations(problem.items, problem.selected, dump_stat);
    let mut best = None;

    for allocation in allocations.iter() {
        let mut tuned_stats = problem.base_stats;
        add_in_place(&mut tuned_stats, &allocation.deltas);
        let Some((stats, stat_mod_indices)) = apply_required_mods(
            problem.items,
            problem.selected,
            tuned_stats,
            problem.targets,
            Some(dump_stat),
        ) else {
            continue;
        };
        let tuning_indices =
            materialize_restricted_tunings(problem.items, problem.selected, allocation);
        let candidate = create_plan(
            stats,
            stat_mod_indices,
            tuning_indices,
            problem.targets,
            Some(dump_stat),
            allocation.used_tunings,
        );
        if best
            .as_ref()
            .is_none_or(|current| better_plan(&candidate, current))
        {
            best = Some(candidate);
        }
    }

    best
}

fn update_restricted_caps(
    caps: &mut Stats,
    requested: &[bool; STAT_COUNT],
    problem: AddonProblem<'_>,
    dump_stat: usize,
    cache: &mut AllocationCache,
) {
    let allocations = cache.restricted_allocations(problem.items, problem.selected, dump_stat);
    for allocation in allocations.iter() {
        let mut stats = problem.base_stats;
        add_in_place(&mut stats, &allocation.deltas);

        for score_stat in 0..STAT_COUNT {
            if !requested[score_stat] || score_stat == dump_stat || caps[score_stat] >= MAX_STAT {
                continue;
            }

            let required_mods = (0..STAT_COUNT)
                .filter(|stat| *stat != dump_stat && *stat != score_stat)
                .map(|stat| minimum_major_mods(stats[stat], problem.targets[stat]))
                .sum::<usize>();
            if required_mods > SLOT_COUNT {
                continue;
            }

            let remaining_mods = SLOT_COUNT - required_mods;
            let candidate = (stats[score_stat] + i16::try_from(remaining_mods * 10).unwrap_or(50))
                .clamp(0, MAX_STAT);
            caps[score_stat] = caps[score_stat].max(candidate);
        }
    }
}

fn materialize_restricted_tunings(
    items: &[Item],
    selected: &[usize; SLOT_COUNT],
    allocation: &TuningAllocation,
) -> [i16; SLOT_COUNT] {
    let mut result = [NO_CHOICE; SLOT_COUNT];
    for slot in 0..SLOT_COUNT {
        let code = allocation.choices[slot];
        if code > 0 {
            result[slot] = items[selected[slot]].pair_tunings[usize::from(code - 1)].source_index;
        }
    }
    result
}

fn solve_unrestricted(problem: AddonProblem<'_>) -> Option<AddonPlan> {
    let mask_limit = if problem.allow_balanced_tuning {
        1_u8 << SLOT_COUNT
    } else {
        1
    };
    let mut best = None;

    for balanced_mask in 0..mask_limit {
        let mut balanced_stats = problem.base_stats;
        let mut tuning_codes = [NO_TUNING_CODE; SLOT_COUNT];
        let mut valid_mask = true;
        for (slot, tuning_code) in tuning_codes.iter_mut().enumerate() {
            if balanced_mask & (1 << slot) == 0 {
                continue;
            }
            let Some(balanced) = problem.items[problem.selected[slot]].balanced_tuning else {
                valid_mask = false;
                break;
            };
            add_in_place(&mut balanced_stats, &balanced.deltas);
            *tuning_code = BALANCED_TUNING_CODE;
        }
        if !valid_mask {
            continue;
        }

        let pair_slot_count = SLOT_COUNT - balanced_mask.count_ones() as usize;
        let mut mod_counts = [0_u8; STAT_COUNT];
        let transfer_search = PairTransferSearch {
            items: problem.items,
            selected: problem.selected,
            targets: problem.targets,
            dump_stat: problem.dump_stat,
            pair_slot_count,
        };
        let Some((mod_counts, tuning_codes)) =
            transfer_search.complete(balanced_stats, &mut mod_counts, tuning_codes)
        else {
            continue;
        };

        let mut tuned_stats = problem.base_stats;
        let mut tuning_indices = [NO_CHOICE; SLOT_COUNT];
        let mut used_tunings = 0_u8;
        for slot in 0..SLOT_COUNT {
            let item = &problem.items[problem.selected[slot]];
            match tuning_codes[slot] {
                BALANCED_TUNING_CODE => {
                    let balanced = item.balanced_tuning.expect("validated balanced mask");
                    add_in_place(&mut tuned_stats, &balanced.deltas);
                    tuning_indices[slot] = balanced.source_index;
                    used_tunings += 1;
                }
                code if code >= 0 => {
                    let tuning = item.pair_tunings[code as usize];
                    tuned_stats[usize::from(tuning.positive)] += 5;
                    tuned_stats[usize::from(tuning.negative)] -= 5;
                    tuning_indices[slot] = tuning.source_index;
                    used_tunings += 1;
                }
                _ => {}
            }
        }

        let Some((stats, stat_mod_indices)) = apply_mod_counts(
            problem.items,
            problem.selected,
            tuned_stats,
            mod_counts,
            problem.targets,
            problem.dump_stat,
        ) else {
            continue;
        };
        let candidate = create_plan(
            stats,
            stat_mod_indices,
            tuning_indices,
            problem.targets,
            problem.dump_stat,
            used_tunings,
        );
        if best
            .as_ref()
            .is_none_or(|current| better_plan(&candidate, current))
        {
            best = Some(candidate);
        }
    }

    best
}

struct PairTransferSearch<'a> {
    items: &'a [Item],
    selected: &'a [usize; SLOT_COUNT],
    targets: Stats,
    dump_stat: Option<usize>,
    pair_slot_count: usize,
}

impl PairTransferSearch<'_> {
    fn complete(
        &self,
        base_stats: Stats,
        mod_counts: &mut [u8; STAT_COUNT],
        tuning_codes: [i8; SLOT_COUNT],
    ) -> Option<([u8; STAT_COUNT], [i8; SLOT_COUNT])> {
        let destination_capacity = self.destination_capacity(&tuning_codes);
        let mut stats = base_stats;
        let mut mandatory_mod_count = 0;
        for stat in 0..STAT_COUNT {
            if self.dump_stat == Some(stat) {
                continue;
            }
            let deficit_units = units_up(self.targets[stat] - stats[stat]);
            let tuning_capacity = self.pair_slot_count.min(destination_capacity[stat]);
            let mandatory =
                usize::from(deficit_units.saturating_sub(tuning_capacity as u8)).div_ceil(2);
            mod_counts[stat] = mandatory as u8;
            mandatory_mod_count += mandatory;
            stats[stat] += i16::try_from(mandatory * 10).unwrap_or(50);
        }
        if mandatory_mod_count > SLOT_COUNT {
            return None;
        }

        self.search_additional_mods(stats, mod_counts, tuning_codes, mandatory_mod_count, 0)
    }

    fn search_additional_mods(
        &self,
        stats: Stats,
        mod_counts: &mut [u8; STAT_COUNT],
        mut tuning_codes: [i8; SLOT_COUNT],
        mod_count: usize,
        first_mod_stat: usize,
    ) -> Option<([u8; STAT_COUNT], [i8; SLOT_COUNT])> {
        let (mut deficits, mut sources, required_transfers) = self.transfer_units(stats);
        for code in &mut tuning_codes {
            if *code >= 0 {
                *code = NO_TUNING_CODE;
            }
        }

        if required_transfers <= self.pair_slot_count
            && sources
                .iter()
                .map(|value| usize::from(*value))
                .sum::<usize>()
                >= required_transfers
            && self.assign_required_tunings(&mut deficits, &mut sources, &mut tuning_codes)
        {
            return Some((*mod_counts, tuning_codes));
        }
        if mod_count >= SLOT_COUNT {
            return None;
        }

        for stat in first_mod_stat..STAT_COUNT {
            if self.dump_stat == Some(stat) || stats[stat] >= self.targets[stat] {
                continue;
            }
            let mut next_stats = stats;
            next_stats[stat] += 10;
            mod_counts[stat] += 1;
            if let Some(result) = self.search_additional_mods(
                next_stats,
                mod_counts,
                tuning_codes,
                mod_count + 1,
                stat,
            ) {
                return Some(result);
            }
            mod_counts[stat] -= 1;
        }
        None
    }

    fn destination_capacity(&self, tuning_codes: &[i8; SLOT_COUNT]) -> [usize; STAT_COUNT] {
        let mut capacity = [0; STAT_COUNT];
        for (slot, tuning_code) in tuning_codes.iter().enumerate() {
            if *tuning_code != NO_TUNING_CODE {
                continue;
            }
            let mut mask = 0_u8;
            for choice in &self.items[self.selected[slot]].pair_tunings {
                mask |= 1 << choice.positive;
            }
            for (stat, value) in capacity.iter_mut().enumerate() {
                *value += usize::from(mask & (1 << stat) != 0);
            }
        }
        capacity
    }

    fn transfer_units(&self, stats: Stats) -> ([u8; STAT_COUNT], [u8; STAT_COUNT], usize) {
        let mut deficits = [0; STAT_COUNT];
        let mut sources = [0; STAT_COUNT];
        let mut total_deficit = 0;
        for stat in 0..STAT_COUNT {
            if self.dump_stat == Some(stat) {
                sources[stat] = SLOT_COUNT as u8;
                continue;
            }
            let difference = self.targets[stat] - stats[stat];
            if difference > 0 {
                deficits[stat] = units_up(difference);
                total_deficit += usize::from(deficits[stat]);
            } else {
                sources[stat] = u8::try_from((-difference / 5).min(SLOT_COUNT as i16))
                    .unwrap_or(SLOT_COUNT as u8);
            }
        }
        (deficits, sources, total_deficit)
    }

    fn assign_required_tunings(
        &self,
        deficits: &mut [u8; STAT_COUNT],
        sources: &mut [u8; STAT_COUNT],
        tuning_codes: &mut [i8; SLOT_COUNT],
    ) -> bool {
        let Some(destination) = self.most_constrained_destination(deficits, sources, tuning_codes)
        else {
            return true;
        };

        for slot in 0..SLOT_COUNT {
            if tuning_codes[slot] != NO_TUNING_CODE {
                continue;
            }
            for (choice_index, choice) in self.items[self.selected[slot]]
                .pair_tunings
                .iter()
                .enumerate()
            {
                if usize::from(choice.positive) != destination
                    || sources[usize::from(choice.negative)] == 0
                {
                    continue;
                }

                tuning_codes[slot] = choice_index as i8;
                deficits[destination] -= 1;
                sources[usize::from(choice.negative)] -= 1;
                if self.assign_required_tunings(deficits, sources, tuning_codes) {
                    return true;
                }
                sources[usize::from(choice.negative)] += 1;
                deficits[destination] += 1;
                tuning_codes[slot] = NO_TUNING_CODE;
            }
        }
        false
    }

    fn most_constrained_destination(
        &self,
        deficits: &[u8; STAT_COUNT],
        sources: &[u8; STAT_COUNT],
        tuning_codes: &[i8; SLOT_COUNT],
    ) -> Option<usize> {
        let mut best = None;
        let mut best_choice_count = usize::MAX;
        for (destination, deficit) in deficits.iter().enumerate() {
            if *deficit == 0 {
                continue;
            }

            let mut choices = 0;
            for (slot, tuning_code) in tuning_codes.iter().enumerate() {
                if *tuning_code != NO_TUNING_CODE {
                    continue;
                }
                choices += self.items[self.selected[slot]]
                    .pair_tunings
                    .iter()
                    .filter(|choice| {
                        usize::from(choice.positive) == destination
                            && sources[usize::from(choice.negative)] > 0
                    })
                    .count();
            }
            if choices < best_choice_count {
                best = Some(destination);
                best_choice_count = choices;
            }
        }
        best
    }
}

fn apply_required_mods(
    items: &[Item],
    selected: &[usize; SLOT_COUNT],
    stats: Stats,
    targets: Stats,
    dump_stat: Option<usize>,
) -> Option<(Stats, [i16; SLOT_COUNT])> {
    let mut counts = [0_u8; STAT_COUNT];
    for stat in 0..STAT_COUNT {
        if dump_stat == Some(stat) {
            continue;
        }
        counts[stat] = u8::try_from(minimum_major_mods(stats[stat], targets[stat])).ok()?;
    }
    apply_mod_counts(items, selected, stats, counts, targets, dump_stat)
}

fn apply_mod_counts(
    items: &[Item],
    selected: &[usize; SLOT_COUNT],
    mut stats: Stats,
    counts: [u8; STAT_COUNT],
    targets: Stats,
    dump_stat: Option<usize>,
) -> Option<(Stats, [i16; SLOT_COUNT])> {
    let requested_mods = counts
        .iter()
        .map(|count| usize::from(*count))
        .sum::<usize>();
    if requested_mods > SLOT_COUNT {
        return None;
    }

    let mut mod_indices = [NO_CHOICE; SLOT_COUNT];
    let mut slot = 0;
    for stat in 0..STAT_COUNT {
        for _ in 0..counts[stat] {
            let item = &items[selected[slot]];
            let minor_mod = item.minor_mods[stat];
            let use_minor = stats[stat] + 10 > MAX_STAT && minor_mod.is_some();
            let value = if use_minor { 5 } else { 10 };
            mod_indices[slot] = if use_minor {
                minor_mod.expect("checked minor mod")
            } else {
                item.major_mods[stat]
            };
            stats[stat] += value;
            slot += 1;
        }
    }

    if meets_targets(&stats, &targets, dump_stat) {
        Some((stats, mod_indices))
    } else {
        None
    }
}

fn create_plan(
    stats: Stats,
    stat_mod_indices: [i16; SLOT_COUNT],
    tuning_indices: [i16; SLOT_COUNT],
    targets: Stats,
    dump_stat: Option<usize>,
    used_tunings: u8,
) -> AddonPlan {
    let stats = displayed(stats);
    let wasted_stats = stats
        .iter()
        .zip(targets)
        .enumerate()
        .filter(|(stat, _)| dump_stat != Some(*stat))
        .map(|(_, (value, target))| (*value - target).max(0))
        .sum();
    AddonPlan {
        stats,
        stat_mod_indices,
        tuning_indices,
        wasted_stats,
        total_stats: total(&stats),
        used_tunings,
    }
}

fn better_plan(candidate: &AddonPlan, current: &AddonPlan) -> bool {
    candidate.total_stats > current.total_stats
        || (candidate.total_stats == current.total_stats
            && candidate.used_tunings > current.used_tunings)
        || (candidate.total_stats == current.total_stats
            && candidate.used_tunings == current.used_tunings
            && candidate.wasted_stats < current.wasted_stats)
        || (candidate.total_stats == current.total_stats
            && candidate.used_tunings == current.used_tunings
            && candidate.wasted_stats == current.wasted_stats
            && (candidate.stat_mod_indices, candidate.tuning_indices)
                < (current.stat_mod_indices, current.tuning_indices))
}

fn units_up(value: i16) -> u8 {
    u8::try_from(value.max(0)).unwrap_or(u8::MAX).div_ceil(5)
}

fn meets_targets(stats: &Stats, targets: &Stats, dump_stat: Option<usize>) -> bool {
    (0..STAT_COUNT)
        .all(|stat| dump_stat == Some(stat) || stats[stat].clamp(0, MAX_STAT) >= targets[stat])
}

#[cfg(test)]
mod tests {
    use super::units_up;

    #[test]
    fn rounds_transfer_units_up_in_five_point_steps() {
        assert_eq!(units_up(0), 0);
        assert_eq!(units_up(1), 1);
        assert_eq!(units_up(5), 1);
        assert_eq!(units_up(6), 2);
    }
}
