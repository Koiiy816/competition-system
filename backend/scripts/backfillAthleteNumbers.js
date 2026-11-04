// 默认预览；--apply 执行。连接部署配置中的 MONGO_URI；不创建/升级业务索引。
const path = require('path');
const fs = require('fs/promises');
const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const { planLegacyNumbers, missingIdentityFields } = require('../utils/legacyAthleteNumbers');

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '../config/.env') });
  if (!process.env.MONGO_URI) throw new Error('请先配置 MONGO_URI');
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000 });
  try {
    const Participant = require('../models/Participant');
    const AthleteIdentity = require('../models/AthleteIdentity');
    const rows = await Participant.find({ isVirtualTeam: { $ne: true } }).lean();
    const identities = await AthleteIdentity.find().select('+idCard').lean();
    const unnumbered = rows.filter(row => !row.athleteNumber?.trim());
    const exceptions = unnumbered.filter(row => missingIdentityFields(row).length)
      .map(row => ({ id: String(row._id), missingFields: missingIdentityFields(row) }));
    const groups = planLegacyNumbers(unnumbered.filter(row => !missingIdentityFields(row).length), identities);
    const summary = { database: mongoose.connection.name, registrations: groups.reduce((n, g) => n + g.rows.length, 0),
      groups: groups.length, reuse: groups.filter(g => g.existing).length,
      separateWithoutDocument: groups.filter(g => !g.source.idCard?.trim()).length,
      unresolved: exceptions.length, exceptions };
    console.log(JSON.stringify(summary));
    if (!process.argv.includes('--apply') || (!groups.length && !exceptions.length)) return;
    // 先写计划，保留每条记录原编号、版本及本次目标编号，便于核查与恢复。
    const reportPath = path.resolve(process.cwd(), `athlete-number-backfill-${Date.now()}.json`);
    const report = { ...summary, changes: groups.map(g => ({
      key: g.key, identityId: String(g.existing?._id || new mongoose.Types.ObjectId()),
      number: g.existing?.number || `AT-${randomUUID()}`, reused: Boolean(g.existing),
      records: g.rows.map(row => ({ id: String(row._id), athleteNumber: row.athleteNumber, updatedAt: row.updatedAt }))
    })), completed: false };
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' });
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i], entry = report.changes[i], source = group.source;
      let identity = group.existing;
      if (!identity) {
        identity = await AthleteIdentity.findOneAndUpdate(
          { competition: source.competition, user: source.user, requestKey: group.key },
          { $setOnInsert: { _id: new mongoose.Types.ObjectId(entry.identityId), number: entry.number,
            name: source.name.trim(), schoolName: source.schoolName.trim(), gender: source.gender,
            birthDate: source.birthDate, idCard: source.idCard } },
          { upsert: true, new: true, runValidators: true }
        );
      }
      entry.number = identity.number;
      entry.identityId = String(identity._id);
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      for (const row of group.rows) {
        const result = await Participant.updateOne(
          { _id: row._id, updatedAt: row.updatedAt, athleteNumber: row.athleteNumber ?? { $in: [null, ''] } },
          { $set: { athleteNumber: identity.number, updatedAt: new Date() } }, { runValidators: true }
        );
        if (result.modifiedCount !== 1) throw new Error(`报名 ${row._id} 状态变化，停止；可重新预览后续跑。报告：${reportPath}`);
      }
    }
    const after = await Participant.find({ isVirtualTeam: { $ne: true } }).lean();
    report.remaining = after.filter(row => !row.athleteNumber?.trim()).length;
    report.actionableRemaining = after.filter(row => !row.athleteNumber?.trim() && !missingIdentityFields(row).length).length;
    report.completed = report.remaining === 0;
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ completed: report.completed, remaining: report.remaining,
      actionableRemaining: report.actionableRemaining, unresolved: exceptions.length, reportPath }));
    if (report.actionableRemaining) throw new Error('仍有可处理的未编号记录，请检查报告');
  } finally { await mongoose.disconnect(); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
