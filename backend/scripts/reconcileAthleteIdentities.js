// 默认只读预览；--apply --operator=<管理员ID> 才统一武术赛事历史编号。
const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const { planReconciliation } = require('../utils/reconcileAthleteIdentities');

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '../config/.env') });
  if (!process.env.MONGO_URI) throw new Error('请配置 MONGO_URI');
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false });
  try {
    const AthleteIdentity = require('../models/AthleteIdentity');
    const Participant = require('../models/Participant');
    const Competition = require('../models/Competition');
    const { getCompetitionSportType, SPORT_TYPES } = require('../utils/competitionType');
    const competitions = (await Competition.find().lean()).filter(item => getCompetitionSportType(item) === SPORT_TYPES.WUSHU);
    const ids = competitions.map(item => item._id);
    const identities = await AthleteIdentity.find({ competition: { $in: ids } }).select('+idCard').lean();
    const rows = await Participant.find({ competition: { $in: ids }, isVirtualTeam: { $ne: true } }).lean();
    const { plans, unresolved } = planReconciliation(identities, rows);
    const duplicates = plans.filter(item => item.sources.length);
    const summary = { duplicatePeople: duplicates.length, retiringNumbers: duplicates.reduce((sum, item) => sum + item.sources.length, 0),
      registrations: duplicates.reduce((sum, item) => sum + item.registrations.length, 0), completePeople: plans.length, unresolved: unresolved.length };
    console.log(JSON.stringify({ ...summary, candidates: duplicates.map(item => ({ name: item.target.name,
      competition: competitions.find(c => String(c._id) === item.competitionId)?.name, keep: item.target.number,
      retire: item.sources.map(source => source.number), schoolCount: new Set(item.registrations.map(row => row.schoolName)).size })) }));
    if (!process.argv.includes('--apply')) return;
    const operator = process.argv.find(arg => arg.startsWith('--operator='))?.slice('--operator='.length);
    const admin = mongoose.isValidObjectId(operator) && await require('../models/User').findById(operator);
    if (!admin?.roles?.includes('admin')) throw new Error('执行历史编号统一必须指定有效管理员');
    const pending = await require('../models/AthleteIdentityMerge').countDocuments({ status: 'pending' });
    if (pending) throw new Error('存在尚未完成的手动合并，请先处理后再运行');
    const reportPath = path.resolve(process.argv.find(arg => arg.startsWith('--report='))?.slice('--report='.length) || `cross-unit-identity-${Date.now()}.json`);
    const affectedNumbers = new Set(duplicates.flatMap(item => item.identities.map(identity => identity.number)));
    const report = { summary, operator, before: { identities, registrations: rows.filter(row => affectedNumbers.has(row.athleteNumber)) }, unresolved, operations: [], completed: false };
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
    const { planMerge, mergeIdentities } = require('../utils/mergeAthleteIdentities');
    for (const plan of plans) {
      for (const source of plan.sources) {
        const preview = await planMerge(plan.competitionId, source.number, plan.target.number);
        const result = await mergeIdentities({ competitionId: plan.competitionId, sourceNumber: source.number,
          targetNumber: plan.target.number, version: preview.version, operator });
        report.operations.push({ source: source.number, target: plan.target.number, operationId: result.operationId });
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      }
      await AthleteIdentity.updateOne({ _id: plan.target._id, mergedInto: { $exists: false } }, { $set: { identityKey: plan.key } });
    }
    const after = planReconciliation(await AthleteIdentity.find({ competition: { $in: ids } }).select('+idCard').lean(),
      await Participant.find({ competition: { $in: ids }, isVirtualTeam: { $ne: true } }).lean());
    report.remainingDuplicatePeople = after.plans.filter(item => item.sources.length).length;
    report.completed = report.remainingDuplicatePeople === 0;
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ completed: report.completed, remainingDuplicatePeople: report.remainingDuplicatePeople,
      unresolved: after.unresolved.length, operations: report.operations.length, reportPath }));
    if (!report.completed) throw new Error('仍有完整三要素重复编号，请检查报告');
  } finally { await mongoose.disconnect(); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
