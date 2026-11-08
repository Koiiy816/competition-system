const { randomUUID } = require('crypto');
const AthleteIdentity = require('../models/AthleteIdentity');
const { identityKey, dateOnly } = require('./athleteIdentityKey');

const fail = (message, statusCode = 400) => { const error = new Error(message); error.statusCode = statusCode; throw error; };
const normalized = value => String(value || '').trim();
async function canonicalIdentity(identity) {
  const visited = new Set();
  while (identity?.mergedInto) {
    if (visited.has(identity.number)) fail('人员编号关联异常，请联系管理员', 409);
    visited.add(identity.number);
    identity = await AthleteIdentity.findOne({ number: identity.mergedInto }).select('+idCard');
    if (!identity) fail('合并后的参赛者档案不存在，请联系管理员', 409);
  }
  return identity;
}
const verifyDetails = async (identity, data, allowRegistrationSnapshot = false) => {
  if (identity.name !== normalized(data.name) ||
      (identity.birthDate && dateOnly(identity.birthDate) !== dateOnly(data.birthDate)) ||
      (identity.idCard && normalized(identity.idCard).toUpperCase() !== normalized(data.idCard).toUpperCase())) {
    // 管理员已确认合并的历史记录可保留原证件资料，仅信任数据库读出的原报名快照。
    if (allowRegistrationSnapshot && data._id) {
      const recorded = await require('../models/AthleteIdentityMerge').exists({ targetNumber: identity.number, status: 'completed',
        'before.documentDifferenceConfirmed': true, 'before.registrations': { $elemMatch: {
          _id: data._id, user: data.user, competition: data.competition, schoolName: data.schoolName,
          name: data.name, gender: data.gender, birthDate: data.birthDate, idCard: data.idCard
        } } });
      if (recorded) return;
    }
    fail('参赛者资料与已有编号不一致，请核对姓名、出生日期和证件信息，或联系管理员');
  }
};
async function resolveAthleteNumber(data, user, { allowRegistrationSnapshot = false } = {}) {
  const number = data.athleteNumber;
  if (number !== undefined && typeof number !== 'string') fail('参赛者编号必须为字符串');
  const schoolName = String(data.schoolName || '').trim();
  const name = String(data.name || '').trim();
  if (!schoolName || !name) fail('分配参赛者编号需要姓名和所属单位');
  if (number?.trim()) {
    const identity = await canonicalIdentity(await AthleteIdentity.findOne({ number: number.trim(), competition: data.competition }).select('+idCard'));
    if (!identity) fail('参赛者编号不存在或不属于该比赛');
    await verifyDetails(identity, data, allowRegistrationSnapshot);
    return identity.number;
  }
  const key = identityKey(data);
  const idCard = normalized(data.idCard).toUpperCase();
  if (key) {
    const existing = await AthleteIdentity.findOne({ competition: data.competition, identityKey: key, mergedInto: { $exists: false } }).select('+idCard');
    if (existing) {
      await verifyDetails(existing, data);
      return existing.number;
    }
    // 兼容尚未写入 identityKey 的历史档案；不能按单位或报名账号拆分同一个人。
    const escaped = idCard.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = (await AthleteIdentity.find({ competition: data.competition, mergedInto: { $exists: false },
      name, idCard: new RegExp(`^${escaped}$`, 'i') }).select('+idCard'))
      .filter(item => identityKey(item) === key);
    if (matches.length > 1) fail('存在多个姓名、生日和证件号一致的编号，请联系管理员统一编号', 409);
    if (matches.length === 1) {
      try {
        const assigned = await AthleteIdentity.findOneAndUpdate({ _id: matches[0]._id, mergedInto: { $exists: false } }, { $set: { identityKey: key } }, { new: true }).select('+idCard');
        if (assigned) return assigned.number;
      } catch (error) { if (error.code !== 11000) throw error; }
      const assigned = await AthleteIdentity.findOne({ competition: data.competition, identityKey: key }).select('+idCard');
      if (assigned) return (await canonicalIdentity(assigned)).number;
      fail('人员档案已变化，请刷新后重试', 409);
    }
  }
  const requestKey = key ? `global-${key}` : data.athleteRequestKey || randomUUID();
  if (typeof requestKey !== 'string' || requestKey.length > 100) fail('人员关联请求标识无效');
  const filter = key ? { competition: data.competition, identityKey: key } : { competition: data.competition, user: data.user, requestKey };
  let identity;
  try {
    identity = await AthleteIdentity.findOneAndUpdate(filter,
      { $setOnInsert: { name, schoolName, user: data.user, requestKey, gender: data.gender, birthDate: data.birthDate || undefined,
        idCard: normalized(data.idCard), number: `AT-${randomUUID()}` } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }).select('+idCard');
  } catch (error) {
    if (error.code !== 11000) throw error;
    identity = await AthleteIdentity.findOne(filter).select('+idCard');
    if (!identity) throw error;
  }
  if (!key && (identity.name !== name || identity.schoolName !== schoolName)) fail('同一人员请求标识不能用于不同人员或单位');
  identity = await canonicalIdentity(identity);
  await verifyDetails(identity, data);
  return identity.number;
}

module.exports = { resolveAthleteNumber, canonicalIdentity };
