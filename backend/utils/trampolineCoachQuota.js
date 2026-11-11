const { createHash, randomUUID } = require('crypto');
const Participant = require('../models/Participant');
const Lock = require('../models/TrampolineRegistrationLock');
const { getCompetitionSportType, SPORT_TYPES } = require('./competitionType');

const normalize = value => String(value || '').replace(/\s+/g, '').toUpperCase();
const normalizeTrampolineUnit = normalize;
const active = row => !row.isVirtualTeam && row.status !== 'rejected';
const summary = rows => {
  const athletes = new Set(), coaches = new Set();
  for (const row of rows.filter(active)) {
    const birth = row.birthDate ? new Date(row.birthDate) : null;
    const birthday = birth && !Number.isNaN(birth.getTime()) ? birth.toISOString().slice(0, 10) : '';
    const identity = normalize(row.idCard) || [normalize(row.name), normalize(row.gender), birthday].join('|');
    if (identity) athletes.add(identity);
    const people = [...(Array.isArray(row.additionalInfo?.trampolineStaff?.coaches) ? row.additionalInfo.trampolineStaff.coaches : []),
      { name: row.coach, phone: row.coachPhone }];
    for (const coach of people) {
      const name = normalize(coach?.name), phone = normalize(coach?.phone);
      if (name || phone) coaches.add(JSON.stringify([name, phone]));
    }
  }
  return { athleteCount: athletes.size, coachCount: coaches.size, coachLimit: Math.ceil(athletes.size / 5) };
};

const getTrampolineUnitQuota = (existing, added = [], removedIds = []) => {
  const removed = new Set(removedIds.map(String));
  const previous = summary(existing);
  const next = summary([...existing.filter(row => !removed.has(String(row._id))), ...added]);
  const error = next.coachCount > next.coachLimit
    ? `本单位在本赛事累计${next.athleteCount}名运动员，最多可报${next.coachLimit}名教练，当前累计${next.coachCount}名教练，请减少教练人数或补齐运动员名单` : '';
  return { ...next, existingAthleteCount: previous.athleteCount, existingCoachCount: previous.coachCount, error };
};

const loadRows = competitionId => Participant.find({ competition: competitionId, isVirtualTeam: { $ne: true } })
  .select('name gender birthDate idCard schoolName coach coachPhone additionalInfo status isVirtualTeam').lean();

const getTrampolineQuotaPreview = async (competitionId, rows) => {
  const unit = normalize(rows[0]?.schoolName);
  const existing = (await loadRows(competitionId)).filter(row => normalize(row.schoolName) === unit);
  return getTrampolineUnitQuota(existing, rows);
};

// 同一赛事、同一单位的“读取累计名额→保存”必须串行，避免并发拆单绕过。
const withTrampolineCoachQuota = async (competition, rows, replaced, write) => {
  if (getCompetitionSportType(competition) !== SPORT_TYPES.TRAMPOLINE) return write();
  const units = [...new Set([...rows, ...replaced].map(row => normalize(row.schoolName)).filter(Boolean))].sort();
  const owner = randomUUID(), held = [];
  try {
    for (const unit of units) {
      const key = createHash('sha256').update(JSON.stringify([String(competition._id), unit])).digest('hex');
      try {
        await Lock.findOneAndUpdate({ _id: key, expiresAt: { $lte: new Date() } },
          { $set: { owner, expiresAt: new Date(Date.now() + 5 * 60 * 1000) } }, { upsert: true, new: true });
        held.push(key);
      } catch (error) {
        if (error.code !== 11000) throw error;
        const busy = new Error('本单位正在提交报名，请稍后重试，系统将重新核对累计教练名额');
        busy.statusCode = 409; throw busy;
      }
    }
    const existing = await loadRows(competition._id);
    for (const unit of units) {
      const quota = getTrampolineUnitQuota(existing.filter(row => normalize(row.schoolName) === unit),
        rows.filter(row => normalize(row.schoolName) === unit), replaced.map(row => row._id));
      if (quota.error) { const error = new Error(quota.error); error.statusCode = 409; throw error; }
    }
    return await write();
  } finally {
    await Promise.all(held.map(_id => Lock.deleteOne({ _id, owner }).catch(error => console.error('释放蹦床单位报名锁失败:', error.message))));
  }
};

// 旧编辑表单只修改第一名教练的字段时，同步共享资料，避免留下两套不同的教练名单。
const syncTrampolineCoachContacts = (participant, changes) => {
  const info = changes.additionalInfo || participant.additionalInfo;
  const staff = info?.trampolineStaff;
  if (!Array.isArray(staff?.coaches)) return changes;
  let coaches = staff.coaches;
  if (Object.hasOwn(changes, 'coach') || Object.hasOwn(changes, 'coachPhone')) {
    coaches = [{ name: changes.coach ?? participant.coach ?? '', phone: changes.coachPhone ?? participant.coachPhone ?? '' }, ...coaches.slice(1)]
      .filter(person => person.name || person.phone);
  }
  return { ...changes, coach: coaches[0]?.name || '', coachPhone: coaches[0]?.phone || '',
    additionalInfo: { ...info, trampolineStaff: { ...staff, coaches } } };
};

module.exports = { getTrampolineUnitQuota, normalizeTrampolineUnit, getTrampolineQuotaPreview, withTrampolineCoachQuota, syncTrampolineCoachContacts };
