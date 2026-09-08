export const getAutoAgeGroup = (birthDateValue, groups = [], currentYear = new Date().getFullYear()) => {
  if (!birthDateValue) return '';

  const birthDate = String(birthDateValue).slice(0, 10);
  const matchedGroup = groups.find((group) => {
    const start = group.birthDateStart ? String(group.birthDateStart).slice(0, 10) : '';
    const end = group.birthDateEnd ? String(group.birthDateEnd).slice(0, 10) : '';
    return (start || end) && (!start || birthDate >= start) && (!end || birthDate <= end);
  });
  if (matchedGroup) return matchedGroup.name;

  const year = Number(birthDate.slice(0, 4));
  if (!year) return '';
  const age = currentYear - year;
  if (groups.length) {
    const availableGroups = groups.map(group => group.name);
    if (age <= 6 && availableGroups.includes('U6组')) return 'U6组';
    if (age <= 7 && availableGroups.includes('U7组')) return 'U7组';
    if (age === 8 && availableGroups.includes('U8组')) return 'U8组';
    if (age <= 10 && availableGroups.includes('U10组')) return 'U10组';
    if (age <= 13 && availableGroups.includes('U13组')) return 'U13组';
    if (age <= 16 && availableGroups.includes('U16组')) return 'U16组';
    return availableGroups.find(group => group.includes(String(age))) || availableGroups[0] || '';
  }
  if (age <= 6) return 'U6组';
  if (age <= 9) return 'U9组';
  if (age <= 11) return 'U11组';
  if (age <= 13) return 'U13组';
  if (age <= 16) return 'U16组';
  return '成人组';
};
