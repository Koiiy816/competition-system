require('dotenv').config();
const mongoose = require('mongoose');
const Competition = require('../models/Competition');

const pattern = /2026.*深圳市青少年（儿童）锦标赛.*跳水|2026.*深圳市青少年.*跳水/;

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongo:27017/competition-system');
  const competitions = await Competition.find({ name: pattern });
  if (competitions.length !== 1) throw new Error(`目标跳水比赛应唯一，当前找到 ${competitions.length} 个`);
  const competition = competitions[0];
  competition.awardRules = {
    ...(competition.awardRules?.toObject?.() || competition.awardRules || {}),
    enabled: true,
    mode: 'fixed_top_eight',
    teamPoints: [13, 11, 10, 9, 8, 7, 6, 5],
    teamMinEventsPerParticipant: 1
  };
  await competition.save();
  console.log(`已配置：${competition.name}`);
  console.log('规则：实际完赛人数内录取前八；前3名金银铜牌；第4至8名获奖证书；团体积分13/11/10/9/8/7/6/5。');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
