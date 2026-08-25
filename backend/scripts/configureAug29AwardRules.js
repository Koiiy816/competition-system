const mongoose = require('mongoose');
const Competition = require('../models/Competition');

const COMPETITION_NAME = '“奔跑吧·少年”第四届全国青少年武术俱乐部公开赛（广东深圳站）';
const MATCH_DATE = new Date('2026-08-29T00:00:00+08:00');

async function configureAug29AwardRules() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongo:27017/competition-system');
  try {
    const competition = await Competition.findOne({ name: COMPETITION_NAME })
      || await Competition.findOne({ startDate: { $gte: MATCH_DATE, $lt: new Date('2026-08-30T00:00:00+08:00') } });
    if (!competition) throw new Error('未找到 2026-08-29 的比赛；未修改任何资料。');

    competition.awardRules = {
      ...competition.awardRules?.toObject?.(),
      enabled: true,
      mode: 'legacy_percentage',
      firstPrizePercent: 30,
      secondPrizePercent: 60,
      teamPoints: [8, 7, 6, 5, 4, 3, 2, 1],
      teamMinEventsPerParticipant: 1
    };
    await competition.save();
    console.log(JSON.stringify({ competitionId: competition._id, competitionName: competition.name, startDate: competition.startDate, awardRules: competition.awardRules }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

configureAug29AwardRules().catch(error => {
  console.error(error.message);
  process.exit(1);
});
