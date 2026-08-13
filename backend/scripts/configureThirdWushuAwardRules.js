const mongoose = require('mongoose');
const Competition = require('../models/Competition');

const competitionName = '2025\u5e74\u7b2c\u4e09\u5c4a\u6b66\u672f\u4f20\u627f\u53d1\u5c55\u4ea4\u6d41\u6587\u5316\u8282\u66a8\u3010\u6b66\u76df\u676f\u3011\u7ca4\u6e2f\u6fb3\u5168\u6c11\u6b66\u672f\u516c\u5f00\u8d5b';

async function configureAwardRules() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongo:27017/competition-system');
  try {
    const competition = await Competition.findOne({ name: competitionName });
    if (!competition) throw new Error(`\u672a\u627e\u5230\u6bd4\u8d5b\uff1a${competitionName}`);

    competition.awardRules = {
      ...competition.awardRules?.toObject?.(),
      enabled: true,
      mode: 'top3_then_percentage',
      rankAwardCount: 3,
      minParticipantsForRanking: 3,
      remainingPrizePercents: { first: 50, second: 30, third: 20 },
      teamAwardPoints: {
        rank1: 6,
        rank2: 5,
        rank3: 4,
        firstPrize: 3,
        secondPrize: 2,
        thirdPrize: 1
      },
      teamMinEventsPerParticipant: 2,
      mergeGroupsBelow: 3
    };
    await competition.save();

    console.log(JSON.stringify({
      competitionId: competition._id,
      competitionName: competition.name,
      awardRules: competition.awardRules
    }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

configureAwardRules().catch(error => {
  console.error(error.message);
  process.exit(1);
});
