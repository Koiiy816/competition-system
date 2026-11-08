const { identityKey } = require('./athleteIdentityKey');

// 只计划三要素完整且所有引用报名均一致的档案；不猜测缺失或冲突资料。
function planReconciliation(identities, registrations) {
  const groups = new Map();
  const unresolved = [];
  for (const identity of identities) {
    if (identity.mergedInto) continue;
    const key = identityKey(identity);
    if (!key) { unresolved.push({ number: identity.number, reason: '姓名、生日或证件号不完整' }); continue; }
    const scope = JSON.stringify([String(identity.competition), key]);
    if (!groups.has(scope)) groups.set(scope, { key, competitionId: String(identity.competition), identities: [], registrations: [] });
    groups.get(scope).identities.push(identity);
  }
  const plans = [];
  for (const group of groups.values()) {
    const numbers = new Set(group.identities.map(item => item.number));
    group.registrations = registrations.filter(row => numbers.has(row.athleteNumber));
    if (group.registrations.some(row => String(row.competition) !== group.competitionId || identityKey(row) !== group.key)) {
      unresolved.push({ numbers: [...numbers], reason: '档案与关联报名的三要素存在差异' });
      continue;
    }
    const count = identity => group.registrations.filter(row => row.athleteNumber === identity.number).length;
    group.identities.sort((a, b) => Number(b.identityKey === group.key) - Number(a.identityKey === group.key) || count(b) - count(a) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0) || a.number.localeCompare(b.number));
    plans.push({ ...group, target: group.identities[0], sources: group.identities.slice(1) });
  }
  return { plans, unresolved };
}

module.exports = { planReconciliation };
