// 默认只读预览。使用 --apply 才为历史蹦床、跳水报名补齐参赛者编号。
const path = require('path');
const mongoose = require('mongoose');

const argument = (name) => process.argv.find(item => item.startsWith(`${name}=`))?.slice(name.length + 1);

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '../config/.env') });
  if (!process.env.MONGO_URI) throw new Error('请配置 MONGO_URI');
  const competitionId = argument('--competition');
  if (competitionId && !mongoose.isValidObjectId(competitionId)) throw new Error('--competition 必须是有效的比赛 ID');

  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false });
  try {
    const Competition = require('../models/Competition');
    const Participant = require('../models/Participant');
    const { SPORT_TYPES, getCompetitionSportType } = require('../utils/competitionType');
    const { buildAthleteNumberBackfillPlan } = require('../utils/athleteNumberBackfill');
    const { resolveAthleteNumber } = require('../utils/athleteIdentity');

    const allCompetitions = await Competition.find(competitionId ? { _id: competitionId } : {}).select('name sportType type').lean();
    const competitions = allCompetitions.filter(item => [SPORT_TYPES.TRAMPOLINE, SPORT_TYPES.DIVING].includes(getCompetitionSportType(item)));
    if (competitionId && !competitions.length) throw new Error('指定比赛不是蹦床或跳水比赛');
    const competitionIds = competitions.map(item => item._id);
    const participants = competitionIds.length
      ? await Participant.find({ competition: { $in: competitionIds }, isVirtualTeam: { $ne: true }, athleteNumber: { $in: [null, ''] } }).lean()
      : [];
    const plan = buildAthleteNumberBackfillPlan(competitions, participants);
    console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'preview', ...plan.summary, skipped: plan.skipped }, null, 2));
    if (!process.argv.includes('--apply')) return;

    let assigned = 0;
    let unchanged = 0;
    const failures = [];
    for (const original of plan.eligible) {
      try {
        const participant = await Participant.findOne({ _id: original._id, athleteNumber: { $in: [null, ''] } }).lean();
        if (!participant) { unchanged += 1; continue; }
        const athleteNumber = await resolveAthleteNumber({ ...participant, athleteRequestKey: `historical-backfill-${participant._id}` }, null);
        const updated = await Participant.updateOne({ _id: participant._id, athleteNumber: { $in: [null, ''] } }, { $set: { athleteNumber, updatedAt: new Date() } });
        if (updated.modifiedCount) assigned += 1;
        else unchanged += 1;
      } catch (error) {
        failures.push({ participantId: String(original._id), name: original.name || '-', message: error.message });
      }
    }
    console.log(JSON.stringify({ completed: failures.length === 0, assigned, unchanged, skipped: plan.skipped.length, failures }, null, 2));
    if (failures.length) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
