const { createHash } = require('crypto');

const text = value => String(value || '').trim();
const missingIdentityFields = row => ['user', 'competition', 'name', 'schoolName']
  .filter(field => !text(row[field]));
const { identityKey } = require('./athleteIdentityKey');
const signature = row => { const key = identityKey(row); return key ? JSON.stringify([String(row.competition), key]) : null; };

// 三要素完整才跨单位归并；缺少生日或证件时逐记录分配。
const backfillKey = row => 'legacy-v2-' + createHash('sha256')
  .update(signature(row) || String(row._id)).digest('hex');

function planLegacyNumbers(rows, identities) {
  const groups = new Map();
  for (const row of rows) {
    if (row.isVirtualTeam || text(row.athleteNumber)) continue;
    if (missingIdentityFields(row).length) {
      throw new Error(`报名 ${row._id} 缺少账号、赛事、姓名或所属单位，未执行补号`);
    }
    const key = backfillKey(row);
    if (!groups.has(key)) {
      const matches = signature(row) ? identities.filter(identity => !identity.mergedInto && signature(identity) === signature(row)) : [];
      groups.set(key, { key, source: row, existing: matches.length === 1 ? matches[0] : null, rows: [] });
    }
    groups.get(key).rows.push(row);
  }
  return [...groups.values()];
}

module.exports = { planLegacyNumbers, missingIdentityFields };
