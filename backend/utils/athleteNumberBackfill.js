const { identityKey } = require('./athleteIdentityKey');

const missingIdentityFields = (participant = {}) => {
  const missing = [];
  if (!String(participant.name || '').trim()) missing.push('姓名');
  if (!participant.birthDate) missing.push('出生日期');
  if (!String(participant.idCard || '').trim()) missing.push('证件号码');
  if (!String(participant.schoolName || '').trim()) missing.push('代表单位/学校');
  return missing;
};

// 历史记录只在具备完整身份三要素时自动补号，避免将同名或资料不完整的选手误关联。
const buildAthleteNumberBackfillPlan = (competitions = [], participants = []) => {
  const names = new Map(competitions.map(item => [String(item._id), item.name || String(item._id)]));
  const eligible = [];
  const skipped = [];
  for (const participant of participants) {
    const missing = missingIdentityFields(participant);
    if (missing.length || !identityKey(participant)) {
      skipped.push({ participantId: String(participant._id), competitionId: String(participant.competition),
        name: participant.name || '-', missing });
    } else {
      eligible.push(participant);
    }
  }
  const byCompetition = new Map();
  for (const participant of participants) {
    const competitionId = String(participant.competition);
    const row = byCompetition.get(competitionId) || { competitionId, competition: names.get(competitionId) || competitionId, pending: 0, eligible: 0, skipped: 0 };
    row.pending += 1;
    if (eligible.includes(participant)) row.eligible += 1;
    else row.skipped += 1;
    byCompetition.set(competitionId, row);
  }
  return { eligible, skipped, summary: { pending: participants.length, eligible: eligible.length, skipped: skipped.length, competitions: [...byCompetition.values()] } };
};

module.exports = { buildAthleteNumberBackfillPlan, missingIdentityFields };
