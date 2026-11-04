const { createHash } = require('crypto');

const text = value => String(value || '').trim();
const signature = row => JSON.stringify([
  String(row.competition), String(row.user), text(row.schoolName), text(row.name),
  text(row.gender), row.birthDate ? new Date(row.birthDate).toISOString().slice(0, 10) : '',
  text(row.idCard).toUpperCase()
]);

// 缺少证件时逐记录分配，不能仅凭同名或生日推断同一人。
const backfillKey = row => 'legacy-v1-' + createHash('sha256')
  .update(text(row.idCard) ? signature(row) : String(row._id)).digest('hex');

function planLegacyNumbers(rows, identities) {
  const groups = new Map();
  for (const row of rows) {
    if (row.isVirtualTeam || text(row.athleteNumber)) continue;
    if (!row.user || !row.competition || !text(row.name) || !text(row.schoolName)) {
      throw new Error(`报名 ${row._id} 缺少账号、赛事、姓名或所属单位，未执行补号`);
    }
    const key = backfillKey(row);
    if (!groups.has(key)) {
      const matches = text(row.idCard) ? identities.filter(identity => signature(identity) === signature(row)) : [];
      groups.set(key, { key, source: row, existing: matches.length === 1 ? matches[0] : null, rows: [] });
    }
    groups.get(key).rows.push(row);
  }
  return [...groups.values()];
}

module.exports = { planLegacyNumbers };
