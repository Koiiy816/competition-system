const SPORT_TYPES = Object.freeze({
  WUSHU: 'wushu',
  DIVING: 'diving',
  TRAMPOLINE: 'trampoline',
  OTHER: 'other'
});

// `type` was a free-text field in the original system.  Keep accepting its
// historic values while all new and edited competitions receive sportType.
const normalizeSportType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (['diving', '跳水'].includes(normalized) || normalized.includes('跳水')) return SPORT_TYPES.DIVING;
  if (['wushu', 'martial_arts', '武术'].includes(normalized) || normalized.includes('武术') || normalized.includes('健身气功')) return SPORT_TYPES.WUSHU;
  if (['trampoline', '蹦床'].includes(normalized) || normalized.includes('蹦床')) return SPORT_TYPES.TRAMPOLINE;
  return SPORT_TYPES.OTHER;
};

const getCompetitionSportType = (competition) => normalizeSportType(competition?.sportType) || normalizeSportType(competition?.type) || SPORT_TYPES.OTHER;

const normalizeSportTypes = (values) => [...new Set((Array.isArray(values) ? values : [values])
  .map(normalizeSportType)
  .filter((type) => [SPORT_TYPES.WUSHU, SPORT_TYPES.DIVING, SPORT_TYPES.TRAMPOLINE].includes(type)))];

// An empty or missing value is deliberately treated as a legacy account. This
// lets existing organisations keep working while their sport types are set in
// the admin console. New registrations submit an explicit selection.
const canUserAccessCompetitionType = (user, competition) => {
  if (!user?.roles?.includes('organization') || user.roles.includes('admin')) return true;
  const allowedTypes = normalizeSportTypes(user.sportTypes);
  return allowedTypes.length === 0 || allowedTypes.includes(getCompetitionSportType(competition));
};

const applyCompetitionSportType = (data) => {
  const sportType = normalizeSportType(data.sportType) || normalizeSportType(data.type);
  if (!sportType || sportType === SPORT_TYPES.OTHER) {
    const error = new Error('请选择有效的赛事类型');
    error.statusCode = 400;
    throw error;
  }
  data.sportType = sportType;
  // Preserve the existing Chinese display field and make new records readable
  // to older pages and exports.
  if (!data.type || ['wushu', 'diving', 'trampoline'].includes(String(data.type).toLowerCase())) {
    data.type = { wushu: '武术', diving: '跳水', trampoline: '蹦床' }[sportType];
  }
  return data;
};

module.exports = {
  SPORT_TYPES,
  normalizeSportType,
  normalizeSportTypes,
  getCompetitionSportType,
  canUserAccessCompetitionType,
  applyCompetitionSportType
};
