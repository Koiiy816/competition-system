const normalize = value => String(value || '').trim();

// 历史无编号资料保持逐条展示，必须经管理员确认后才能归并。
const buildWushuFeeGroups = (rows, filters = {}) => {
  const units = new Map();
  for (const row of rows) {
    if (row.isVirtualTeam) continue;
    const unit = normalize(row.schoolName) || '未知单位';
    if (!units.has(unit)) units.set(unit, new Map());
    const people = units.get(unit);
    const name = normalize(row.name);
    const key = row.athleteNumber || `unlinked:${row._id}`;
    if (!people.has(key)) people.set(key, { key, athleteNumber: row.athleteNumber || '', name: name || '未知参赛者', registrations: [] });
    people.get(key).registrations.push(row);
  }
  const search = normalize(filters.search).toLowerCase();
  return [...units].map(([schoolName, people]) => {
    const roster = [...people.values()].filter(person => person.registrations.some(row =>
      (!filters.status || row.status === filters.status) &&
      (!filters.type || row.type === filters.type) &&
      (!filters.event || row.event === filters.event) &&
      (!search || [row.name, row.teamName, row.schoolName].some(value => normalize(value).toLowerCase().includes(search)))
    )).map(person => {
      const events = new Set(person.registrations.filter(row => row.status !== 'rejected')
        .map(row => normalize(row.event)).filter(Boolean));
      const eventCount = events.size;
      return { ...person, eventCount, fee: person.athleteNumber ? (eventCount ? 300 + Math.max(0, eventCount - 2) * 100 : 0) : null };
    });
    return { schoolName, displayName: schoolName, ageGroup: '', roster,
      participants: roster.flatMap(person => person.registrations) };
  }).filter(group => group.roster.length).sort((a, b) => a.schoolName.localeCompare(b.schoolName, 'zh-CN'));
};

module.exports = { buildWushuFeeGroups };
