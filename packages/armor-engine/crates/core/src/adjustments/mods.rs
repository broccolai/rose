//! Represents one shared five-piece stat-mod budget.

use std::ops::{Index, IndexMut};

use crate::domain::Stat;
use crate::model::STAT_COUNT;

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub(super) struct ModCounts([u8; STAT_COUNT]);

impl ModCounts {
    pub const ZERO: Self = Self([0; STAT_COUNT]);

    pub fn total(self) -> usize {
        self.0.into_iter().map(usize::from).sum()
    }

    pub fn increment(&mut self, stat: Stat) {
        self[stat] += 1;
    }
}

impl Index<Stat> for ModCounts {
    type Output = u8;

    fn index(&self, stat: Stat) -> &Self::Output {
        &self.0[stat.index()]
    }
}

impl IndexMut<Stat> for ModCounts {
    fn index_mut(&mut self, stat: Stat) -> &mut Self::Output {
        &mut self.0[stat.index()]
    }
}
