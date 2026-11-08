const normalize = value => String(value || '').trim();
const personKey = row => row.athleteNumber || `unlinked:${row._id}`;
const unitName = row => normalize(row.schoolName) || '未知单位';
const feeFor = count => count ? 300 + Math.max(0, count - 2) * 100 : 0;

// 先按个人汇总全赛事项目，再把唯一的应收金额放在最早有效报名所属单位。
// displayRows 可受账号权限限制；feeRows 只用于计算，不把其他账号报名明细返回给前端。
const buildWushuFeeGroups = (displayRows, filters = {}, feeRows = displayRows) => {
  const totals = new Map();
  for (const row of feeRows) {
    if (row.isVirtualTeam) continue;
    const key = personKey(row);
    if (!totals.has(key)) totals.set(key, []);
    totals.get(key).push(row);
  }
  const charges = new Map([...totals].map(([key, rows]) => {
    const payable = rows.filter(row => row.status !== 'rejected' && normalize(row.event));
    const events = new Set(payable.map(row => normalize(row.event)));
    const date = row => { const value = new Date(row.registrationDate || row.createdAt || 0).getTime(); return Number.isFinite(value) ? value : 0; };
    const ordered = [...(payable.length ? payable : rows)].sort((a, b) => date(a) - date(b) || String(a._id).localeCompare(String(b._id)) || unitName(a).localeCompare(unitName(b), 'zh-CN'));
    return [key, { eventCount: events.size, totalFee: rows[0].athleteNumber ? feeFor(events.size) : null,
      billingSchoolName: unitName(ordered[0]), registrationCount: rows.length, schoolCount: new Set(rows.map(unitName)).size }];
  }));
  const units = new Map();
  for (const row of displayRows) {
    if (row.isVirtualTeam) continue;
    const unit = unitName(row);
    if (!units.has(unit)) units.set(unit, new Map());
    const people = units.get(unit);
    const key = personKey(row);
    if (!people.has(key)) people.set(key, { key, athleteNumber: row.athleteNumber || '', name: normalize(row.name) || '未知参赛者', registrations: [] });
    people.get(key).registrations.push(row);
  }
  const search = normalize(filters.search).toLowerCase();
  return [...units].map(([schoolName, people]) => {
    const roster = [...people.values()].filter(person => person.registrations.some(row =>
      (!filters.status || row.status === filters.status) && (!filters.type || row.type === filters.type) &&
      (!filters.event || row.event === filters.event) &&
      (!search || [row.name, row.teamName, row.schoolName].some(value => normalize(value).toLowerCase().includes(search)))
    )).map(person => {
      const total = charges.get(person.key);
      const isFeeBillingUnit = schoolName === total.billingSchoolName;
      return { ...person, ...total, isFeeBillingUnit, fee: total.totalFee === null ? null : isFeeBillingUnit ? total.totalFee : 0 };
    });
    return { schoolName, displayName: schoolName, ageGroup: '', roster, participants: roster.flatMap(person => person.registrations) };
  }).filter(group => group.roster.length).sort((a, b) => a.schoolName.localeCompare(b.schoolName, 'zh-CN'));
};

module.exports = { buildWushuFeeGroups };
