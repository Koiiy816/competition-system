const { createHash } = require('crypto');
const AthleteIdentity = require('../models/AthleteIdentity');
const AthleteIdentityMerge = require('../models/AthleteIdentityMerge');
const Participant = require('../models/Participant');
const Competition = require('../models/Competition');
const { getCompetitionSportType, SPORT_TYPES } = require('./competitionType');
const { buildWushuFeeGroups } = require('./wushuFees');
const { identityKey } = require('./athleteIdentityKey');

const fail = (message, statusCode = 409) => { const error = new Error(message); error.statusCode = statusCode; throw error; };
const text = value => String(value || '').trim();
const day = value => value ? new Date(value).toISOString().slice(0, 10) : '';
const scopeOf = identity => String(identity.competition);
const compatible = (source, target) => {
  if (scopeOf(source) !== scopeOf(target)) fail('不同比赛的编号不能合并');
  for (const field of ['name', 'birthDate']) {
    const normalize = field === 'birthDate' ? day : field === 'idCard' ? value => text(value).toUpperCase() : text;
    if (normalize(source[field]) !== normalize(target[field])) fail('两个编号的姓名、性别、出生日期或证件资料不一致，不能合并');
  }
};
const publicIdentity = ({ number, name, schoolName, gender, birthDate, idCard }) => ({ number, name, schoolName, gender,
  birthDate, maskedIdCard: idCard ? `****${idCard.slice(-4)}` : '未填写' });

async function planMerge(competitionId, sourceNumber, targetNumber) {
  if (typeof sourceNumber !== 'string' || typeof targetNumber !== 'string' || !sourceNumber.trim() || !targetNumber.trim() || sourceNumber === targetNumber) fail('请选择两个不同的参赛者编号', 400);
  const competition = await Competition.findById(competitionId);
  if (!competition) fail('比赛不存在', 404);
  if (getCompetitionSportType(competition) !== SPORT_TYPES.WUSHU) fail('该编号合并入口仅适用于武术赛事', 400);
  const identities = await AthleteIdentity.find({ competition: competitionId, number: { $in: [sourceNumber, targetNumber] } }).select('+idCard').lean();
  const source = identities.find(item => item.number === sourceNumber);
  const target = identities.find(item => item.number === targetNumber);
  if (!source || !target) fail('编号不存在或不属于该比赛', 404);
  if (target.mergedInto || (source.mergedInto && source.mergedInto !== targetNumber)) fail('编号已被合并到其他人员，请重新选择');
  compatible(source, target);
  const rows = await Participant.find({ athleteNumber: { $in: [sourceNumber, targetNumber] } }).sort({ _id: 1 }).lean();
  for (const row of rows) {
    if (row.isVirtualTeam) fail('虚拟队伍不能关联人员编号');
    compatible(row, target);
  }
  const version = createHash('sha256').update(JSON.stringify({ source, target, rows })).digest('hex');
  const after = rows.map(row => ({ ...row, athleteNumber: targetNumber }));
  const roster = buildWushuFeeGroups(after)[0]?.roster[0];
  const documentDifferences = [source, ...rows].filter(item => text(item.idCard).toUpperCase() !== text(target.idCard).toUpperCase())
    .map(item => ({ record: item.registrationNumber || item.number, maskedIdCard: publicIdentity(item).maskedIdCard,
      documentLength: text(item.idCard).length }));
  return { source, target, rows, version, preview: {
    source: publicIdentity(source), target: publicIdentity(target), version,
    documentDifferences, targetDocumentLength: text(target.idCard).length,
    registrations: rows.map(({ _id, registrationNumber, event, status, athleteNumber, schoolName }) => ({ _id, registrationNumber, event, status, athleteNumber, schoolName })),
    movingCount: rows.filter(row => row.athleteNumber === sourceNumber).length,
    participantCount: rows.length ? 1 : 0, eventCount: roster?.eventCount || 0, fee: roster?.totalFee || 0
  } };
}

async function mergeIdentities({ competitionId, sourceNumber, targetNumber, version, operator, confirmDocumentDifference, documentPolicy = 'preserve' }) {
  if (!['preserve', 'source', 'target'].includes(documentPolicy)) fail('证件资料处理方式无效', 400);
  let plan = await planMerge(competitionId, sourceNumber, targetNumber);
  if (plan.preview.documentDifferences.length && confirmDocumentDifference !== true) fail('证件字段存在差异，请核实为同一人并明确确认保留原证件资料后合并', 400);
  const scope = scopeOf(plan.target);
  let operation = await AthleteIdentityMerge.findOne({ scope, status: 'pending' });
  if (operation && (operation.sourceNumber !== sourceNumber || operation.targetNumber !== targetNumber)) fail('该单位另一次编号合并尚未完成，请先重试原操作');
  if (operation && (operation.before.documentPolicy || 'preserve') !== documentPolicy) fail('重试时必须沿用原合并操作的证件资料处理方式');
  if (!operation) {
    if (plan.source.mergedInto === targetNumber) {
      const done = await AthleteIdentityMerge.findOne({ sourceNumber, targetNumber, status: 'completed' });
      if (done && !plan.preview.movingCount) return { ...plan.preview, operationId: done.id };
    }
    if (version !== plan.version) fail('报名或人员档案已变化，请重新预览');
    try {
      operation = await AthleteIdentityMerge.create({ scope, sourceNumber, targetNumber, operator,
        before: { source: plan.source, target: plan.target, registrations: plan.rows, documentDifferenceConfirmed: confirmDocumentDifference === true, documentPolicy } });
    } catch (error) {
      if (error.code === 11000) fail('该单位正在执行编号合并，请稍后重试');
      throw error;
    }
    // 获得串行锁后再次核验；发生并发编辑时，不能据旧快照继续合并。
    const fresh = await planMerge(competitionId, sourceNumber, targetNumber);
    if (fresh.version !== plan.version) {
      await AthleteIdentityMerge.updateOne({ _id: operation._id, status: 'pending' }, { $set: { status: 'cancelled' } });
      fail('报名或人员档案已变化，请重新预览');
    }
    plan = fresh;
  }
  // 先停用旧编号。后续报名使用旧请求键时沿用保留编号，不会重新建立重复档案。
  await AthleteIdentity.updateOne({ _id: plan.source._id, $or: [{ mergedInto: { $exists: false } }, { mergedInto: targetNumber }] },
    { $set: { mergedInto: targetNumber, mergedAt: operation.createdAt, mergedBy: operation.operator }, $unset: { identityKey: 1 } });
  const changes = { athleteNumber: targetNumber, updatedAt: new Date() };
  if (documentPolicy !== 'preserve') {
    changes.idCard = operation.before[documentPolicy].idCard || '';
  }
  const targetKey = identityKey({ ...plan.target, ...(documentPolicy !== 'preserve' ? { idCard: changes.idCard } : {}) });
  await AthleteIdentity.updateOne({ _id: plan.target._id }, {
    $set: { ...(targetKey ? { identityKey: targetKey } : {}), ...(documentPolicy !== 'preserve' ? { idCard: changes.idCard } : {}) },
    ...(!targetKey ? { $unset: { identityKey: 1 } } : {})
  });
  const result = await Participant.updateMany({ competition: competitionId,
    athleteNumber: documentPolicy === 'preserve' ? sourceNumber : { $in: [sourceNumber, targetNumber] } },
  { $set: changes }, { runValidators: true });
  const remaining = await Participant.countDocuments({ athleteNumber: sourceNumber });
  if (remaining) fail('编号合并尚未完成，请重试本次操作；合并前资料已保留');
  await AthleteIdentityMerge.updateOne({ _id: operation._id }, { $set: { status: 'completed', completedAt: new Date() } });
  const completed = await planMerge(competitionId, sourceNumber, targetNumber);
  return { ...completed.preview, updatedCount: result.modifiedCount, operationId: operation.id };
}

module.exports = { planMerge, mergeIdentities };
