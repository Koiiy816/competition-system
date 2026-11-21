/*
 * 为单个非跳水、非蹦床赛事设置普通项目裁判人数，并同步其已有赛程。
 *
 * 先预览：
 * node scripts/configureCompetitionJudgeCount.js --competition <比赛ID> --judge-count 3
 *
 * 确认没有已录入的成绩后执行：
 * node scripts/configureCompetitionJudgeCount.js --competition <比赛ID> --judge-count 3 --apply
 */
const path = require('path');
const mongoose = require('mongoose');
const Competition = require('../models/Competition');
const Schedule = require('../models/Schedule');
const Result = require('../models/Result');
const { getCompetitionSportType, SPORT_TYPES } = require('../utils/competitionType');

require('dotenv').config({ path: path.resolve(__dirname, '../config/.env') });

const readArg = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const main = async () => {
  const competitionId = readArg('competition');
  const judgeCount = Number(readArg('judge-count'));
  const apply = process.argv.includes('--apply');
  if (!mongoose.isValidObjectId(competitionId) || ![3, 4, 5].includes(judgeCount)) {
    throw new Error('用法：node scripts/configureCompetitionJudgeCount.js --competition <比赛ID> --judge-count 3 [--apply]');
  }

  await mongoose.connect(process.env.MONGO_URI);
  const competition = await Competition.findById(competitionId).select('name sportType type standardJudgeCount').lean();
  if (!competition) throw new Error('未找到比赛');
  if ([SPORT_TYPES.DIVING, SPORT_TYPES.TRAMPOLINE].includes(getCompetitionSportType(competition))) {
    throw new Error('跳水和蹦床赛事使用专用评分规则，不能用此脚本修改');
  }

  const schedules = await Schedule.find({ competition: competitionId }).select('_id name judgeCount').lean();
  const resultCount = schedules.length ? await Result.countDocuments({ schedule: { $in: schedules.map((schedule) => schedule._id) } }) : 0;
  const summary = { competition: competition.name, competitionId, judgeCount, scheduleCount: schedules.length, existingResultCount: resultCount, apply };
  console.log(JSON.stringify(summary, null, 2));

  if (!apply) return;
  if (resultCount > 0) throw new Error('发现已有成绩；为避免覆盖既有评分，请先联系维护人员确认成绩处理方式');

  await Competition.updateOne({ _id: competitionId }, { $set: { standardJudgeCount: judgeCount } });
  await Schedule.updateMany({ competition: competitionId, scoringMode: { $ne: 'diving' } }, { $set: { judgeCount } });
  console.log(`已设置「${competition.name}」为 ${judgeCount} 位裁判，并同步 ${schedules.length} 个赛程。`);
};

main()
  .catch((error) => { console.error(error.message || error); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect(); });
