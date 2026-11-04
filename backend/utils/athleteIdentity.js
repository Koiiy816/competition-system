const { randomUUID } = require('crypto');
const AthleteIdentity = require('../models/AthleteIdentity');

const fail = (message, statusCode = 400) => { const error = new Error(message); error.statusCode = statusCode; throw error; };
const dateOnly = value => value ? new Date(value).toISOString().slice(0, 10) : '';
const normalized = value => String(value || '').trim();
const verifyDetails = (identity, data) => {
  if (identity.name !== normalized(data.name) ||
      (identity.gender && identity.gender !== data.gender) ||
      (identity.birthDate && dateOnly(identity.birthDate) !== dateOnly(data.birthDate)) ||
      (identity.idCard && normalized(identity.idCard).toUpperCase() !== normalized(data.idCard).toUpperCase())) {
    fail('所选参赛者编号与姓名、性别、出生日期或证件信息不一致，请核对人员；不同人员请选择新增同名人员');
  }
};
async function resolveAthleteNumber(data, user, { allowOwnerSelection = false } = {}) {
  const number = data.athleteNumber;
  if (number !== undefined && typeof number !== 'string') fail('参赛者编号必须为字符串');
  const schoolName = String(data.schoolName || '').trim();
  const name = String(data.name || '').trim();
  if (!schoolName || !name) fail('分配参赛者编号需要姓名和所属单位');
  if (number?.trim()) {
    const identity = await AthleteIdentity.findOne({ number: number.trim(), competition: data.competition, schoolName }).select('+idCard');
    if (!identity) fail('参赛者编号不存在或不属于该比赛、单位');
    if (allowOwnerSelection && user.roles?.some(role => ['admin', 'chief_referee'].includes(role))) data.user = identity.user;
    if (String(identity.user) !== String(data.user)) fail('参赛者编号不属于该报名账号', 403);
    verifyDetails(identity, data);
    return identity.number;
  }
  const requestKey = data.athleteRequestKey || randomUUID();
  if (typeof requestKey !== 'string' || requestKey.length > 100) fail('人员关联请求标识无效');
  const filter = { competition: data.competition, user: data.user, requestKey };
  let identity;
  try {
    identity = await AthleteIdentity.findOneAndUpdate(filter,
      { $setOnInsert: { name, schoolName, gender: data.gender, birthDate: data.birthDate || undefined,
        idCard: normalized(data.idCard), number: `AT-${randomUUID()}` } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }).select('+idCard');
  } catch (error) {
    if (error.code !== 11000) throw error;
    identity = await AthleteIdentity.findOne(filter).select('+idCard');
    if (!identity) throw error;
  }
  if (identity.name !== name || identity.schoolName !== schoolName) fail('同一人员请求标识不能用于不同人员或单位');
  verifyDetails(identity, data);
  return identity.number;
}

module.exports = { resolveAthleteNumber };
