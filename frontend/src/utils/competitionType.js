export const SPORT_TYPES = Object.freeze({
  WUSHU: 'wushu',
  DIVING: 'diving',
  TRAMPOLINE: 'trampoline',
  OTHER: 'other'
});

export const PARTICIPATION_SPORT_TYPES = [
  { value: SPORT_TYPES.WUSHU, label: '武术' },
  { value: SPORT_TYPES.DIVING, label: '跳水' },
  { value: SPORT_TYPES.TRAMPOLINE, label: '蹦床（筹备中）', disabled: true }
];

export const normalizeSportType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (['diving', '跳水'].includes(normalized) || normalized.includes('跳水')) return SPORT_TYPES.DIVING;
  if (['wushu', 'martial_arts', '武术'].includes(normalized) || normalized.includes('武术') || normalized.includes('健身气功')) return SPORT_TYPES.WUSHU;
  if (['trampoline', '蹦床'].includes(normalized) || normalized.includes('蹦床')) return SPORT_TYPES.TRAMPOLINE;
  return SPORT_TYPES.OTHER;
};

export const getSportType = (competition) => normalizeSportType(competition?.sportType) || normalizeSportType(competition?.type) || SPORT_TYPES.OTHER;
export const isDivingCompetition = (competition) => getSportType(competition) === SPORT_TYPES.DIVING;
export const sportTypeLabel = (competition) => ({ wushu: '武术', diving: '跳水', trampoline: '蹦床', other: '其他' }[getSportType(competition)] || '其他');
