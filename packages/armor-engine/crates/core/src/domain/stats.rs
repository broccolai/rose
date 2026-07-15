use std::ops::{AddAssign, Index, IndexMut, SubAssign};

use crate::model::{MAX_STAT, SLOT_COUNT, STAT_COUNT};

use super::Stat;

pub(crate) const MINOR_MOD_POINTS: i16 = 5;
pub(crate) const MAJOR_MOD_POINTS: i16 = 10;
pub(crate) const TUNING_POINTS: i16 = 5;

#[derive(Clone, Copy, Debug, Default, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[repr(transparent)]
pub(crate) struct StatMap<T>([T; STAT_COUNT]);

pub(crate) type StatValues = StatMap<i16>;

#[derive(Clone, Copy, Debug)]
pub(crate) struct MajorModRequirements {
    by_stat: StatMap<usize>,
    total: usize,
}

impl MajorModRequirements {
    pub fn from_stats(
        stats: &StatValues,
        targets: &StatValues,
        ignored_stat: Option<Stat>,
    ) -> Self {
        Self::calculate(targets, ignored_stat, |stat| stats[stat])
    }

    pub fn from_combined_stats(
        selected: &StatValues,
        remaining: &StatValues,
        targets: &StatValues,
        ignored_stat: Option<Stat>,
    ) -> Self {
        Self::calculate(targets, ignored_stat, |stat| {
            selected[stat].saturating_add(remaining[stat])
        })
    }

    pub fn for_stat(self, stat: Stat) -> usize {
        self.by_stat[stat]
    }

    pub const fn total(self) -> usize {
        self.total
    }

    pub fn excluding(self, stat: Stat) -> usize {
        self.total.saturating_sub(self.by_stat[stat])
    }

    fn calculate(
        targets: &StatValues,
        ignored_stat: Option<Stat>,
        mut current: impl FnMut(Stat) -> i16,
    ) -> Self {
        let mut by_stat = StatMap::filled(0);
        let mut total = 0;

        for stat in Stat::ALL {
            if ignored_stat == Some(stat) {
                continue;
            }

            by_stat[stat] = minimum_major_mods(current(stat), targets[stat]);
            total += by_stat[stat];
        }

        Self { by_stat, total }
    }
}

impl<T> StatMap<T> {
    pub fn into_array(self) -> [T; STAT_COUNT] {
        self.0
    }
}

impl<T: Copy> StatMap<T> {
    pub const fn filled(value: T) -> Self {
        Self([value; STAT_COUNT])
    }
}

impl StatValues {
    pub const ZERO: Self = Self([0; STAT_COUNT]);

    pub fn clamped(mut self) -> Self {
        for value in &mut self.0 {
            *value = (*value).clamp(0, MAX_STAT);
        }

        self
    }

    pub fn total(self) -> i16 {
        self.0.iter().sum()
    }
}

impl<T> From<[T; STAT_COUNT]> for StatMap<T> {
    fn from(values: [T; STAT_COUNT]) -> Self {
        Self(values)
    }
}

impl<T> Index<Stat> for StatMap<T> {
    type Output = T;

    fn index(&self, stat: Stat) -> &Self::Output {
        &self.0[stat.index()]
    }
}

impl<T> IndexMut<Stat> for StatMap<T> {
    fn index_mut(&mut self, stat: Stat) -> &mut Self::Output {
        &mut self.0[stat.index()]
    }
}

impl AddAssign<&Self> for StatMap<i16> {
    fn add_assign(&mut self, other: &Self) {
        for (value, addition) in self.0.iter_mut().zip(&other.0) {
            *value += addition;
        }
    }
}

impl SubAssign<&Self> for StatMap<i16> {
    fn sub_assign(&mut self, other: &Self) {
        for (value, subtraction) in self.0.iter_mut().zip(&other.0) {
            *value -= subtraction;
        }
    }
}

pub(crate) fn minimum_major_mods(current: i16, target: i16) -> usize {
    minimum_steps::<10>(current, target)
}

pub(crate) fn minimum_tuning_steps(current: i16, target: i16) -> usize {
    minimum_steps::<5>(current, target)
}

pub(crate) fn remaining_major_mod_bonus(used_mods: usize) -> Option<i16> {
    let remaining = SLOT_COUNT.checked_sub(used_mods)?;
    let remaining = i16::try_from(remaining).ok()?;
    Some(remaining * MAJOR_MOD_POINTS)
}

fn minimum_steps<const STEP: usize>(current: i16, target: i16) -> usize {
    let deficit = (i32::from(target) - i32::from(current)).max(0);
    usize::try_from(deficit).unwrap_or_default().div_ceil(STEP)
}

#[cfg(test)]
mod tests {
    use super::{MajorModRequirements, StatValues, minimum_major_mods, minimum_tuning_steps};
    use crate::domain::Stat;

    #[test]
    fn rounds_required_adjustments_up_to_whole_steps() {
        assert_eq!(minimum_tuning_steps(0, 0), 0);
        assert_eq!(minimum_tuning_steps(0, 1), 1);
        assert_eq!(minimum_tuning_steps(0, 5), 1);
        assert_eq!(minimum_tuning_steps(0, 6), 2);
        assert_eq!(minimum_major_mods(0, 11), 2);
    }

    #[test]
    fn computes_extreme_deficits_without_signed_overflow() {
        assert_eq!(minimum_tuning_steps(i16::MIN, i16::MAX), 13_107);
    }

    #[test]
    fn major_mod_requirements_can_exclude_one_scored_stat() {
        let requirements = MajorModRequirements::from_stats(
            &StatValues::from([0, 10, 20, 30, 40, 50]),
            &StatValues::from([20, 20, 20, 40, 40, 70]),
            Some(Stat::Grenade),
        );

        assert_eq!(requirements.for_stat(Stat::Health), 2);
        assert_eq!(requirements.for_stat(Stat::Grenade), 0);
        assert_eq!(requirements.total(), 6);
        assert_eq!(requirements.excluding(Stat::Weapons), 4);
    }
}
