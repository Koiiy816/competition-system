/*
 * 仅配置 2026 正雷杯的奖项规则；默认预览，必须加 --apply 才会写入数据库。
 * node scripts/configureZhenglei2026AwardRules.js
 * node scripts/configureZhenglei2026AwardRules.js --apply
 */
const path = require('path');
const mongoose = require('mongoose');
const Competition = require('../models/Competition');

require('dotenv').config({ path: path.resolve(__dirname, '../config/.env') });

const competitionId = '6ae1d15d7858aac2657365d7';
const competitionName = '2026非遗在鹏城·第二届“正雷杯”陈氏太极拳传承交流大赛';

async function main() {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGO_URI);
  const competition = await Competition.findById(competitionId);
  if (!competition || competition.name !== competitionName) throw new Error('未找到指定的正雷杯比赛，未做任何修改');

  const awardRules = {
    ...(competition.awardRules?.toObject?.() || competition.awardRules || {}),
    enabled: true,
    mode: 'wushu_floor_percentage',
    scoreboardDisplay: 'prize',
    // 个人：金/银/铜=3:4:3；集体：一/二等=6:4，均由程序向下取整。
    mergeGroupsBelow: 0
  };
  console.log(JSON.stringify({ competition: competition.name, competitionId: String(competition._id), awardRules, apply }, null, 2));
  if (!apply) return;
  competition.awardRules = awardRules;
  await competition.save();
  console.log('已设置正雷杯专用武术奖项规则。');
}

main().catch((error) => { console.error(error.message || error); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
