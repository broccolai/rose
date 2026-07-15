#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[repr(u8)]
pub(crate) enum Stat {
    Health,
    Melee,
    Grenade,
    Super,
    Class,
    Weapons,
}

impl Stat {
    pub const ALL: [Self; 6] = [
        Self::Health,
        Self::Melee,
        Self::Grenade,
        Self::Super,
        Self::Class,
        Self::Weapons,
    ];

    pub const fn index(self) -> usize {
        self as usize
    }
}

impl TryFrom<u8> for Stat {
    type Error = u8;

    fn try_from(index: u8) -> Result<Self, Self::Error> {
        match index {
            0 => Ok(Self::Health),
            1 => Ok(Self::Melee),
            2 => Ok(Self::Grenade),
            3 => Ok(Self::Super),
            4 => Ok(Self::Class),
            5 => Ok(Self::Weapons),
            index => Err(index),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[repr(u8)]
pub(crate) enum ArmorSlot {
    Helmet,
    Arms,
    Chest,
    Legs,
    ClassItem,
}

impl ArmorSlot {
    pub const fn index(self) -> usize {
        self as usize
    }
}

impl TryFrom<u8> for ArmorSlot {
    type Error = u8;

    fn try_from(index: u8) -> Result<Self, Self::Error> {
        match index {
            0 => Ok(Self::Helmet),
            1 => Ok(Self::Arms),
            2 => Ok(Self::Chest),
            3 => Ok(Self::Legs),
            4 => Ok(Self::ClassItem),
            index => Err(index),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[repr(u8)]
pub(crate) enum CharacterClass {
    Titan,
    Hunter,
    Warlock,
}

impl TryFrom<u8> for CharacterClass {
    type Error = u8;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(Self::Titan),
            1 => Ok(Self::Hunter),
            2 => Ok(Self::Warlock),
            value => Err(value),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub(crate) enum ClassCompatibility {
    Character(CharacterClass),
    Any,
}

impl ClassCompatibility {
    pub fn supports(self, class: CharacterClass) -> bool {
        match self {
            Self::Character(required) => required == class,
            Self::Any => true,
        }
    }
}

impl TryFrom<u8> for ClassCompatibility {
    type Error = u8;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            3 => Ok(Self::Any),
            value => CharacterClass::try_from(value)
                .map(Self::Character)
                .map_err(|_| value),
        }
    }
}
