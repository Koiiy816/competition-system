/*
 * 为单个非跳水、非蹦床赛事设置普通项目裁判人数，并同步其已有赛程。
 *
 * 先预览：
 * node scripts/configureCompetitionJudgeCount.js --competition <比赛ID> --judge-count 3
 *
 * 确认没有已录入的正式成绩后执行（测试成绩会保留且不阻止配置）：
 * node scripts/configureCompetitionJudgeCount.js --competition <比赛ID> --judge-count 3 --apply
 *
 * 如已明确确认不保留正式成绩，才可额外指定以下参数。它只会删除该比赛赛程下的正式成绩：
 * node scripts/configureCompetitionJudgeCount.js --competition <比赛ID> --judge-count 3 --apply --clear-existing-results
 */
const path = require('path');
const mongoose = require('mongoose');
const Competition = require('../models/Competition');
const Schedule = require('../models/Schedule');
const Result = require('../models/Result');
require('../models/Participant'); // 注册 populate('participant') 所需的模型。
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
  const clearExistingResults = process.argv.includes('--clear-existing-results');
  if (!mongoose.isValidObjectId(competitionId) || ![3, 4, 5].includes(judgeCount)) {
    throw new Error('用法：node scripts/configureCompetitionJudgeCount.js --competition <比赛ID> --judge-count 3 [--apply] [--clear-existing-results]');
  }

  await mongoose.connect(process.env.MONGO_URI);
  const competition = await Competition.findById(competitionId).select('name sportType type standardJudgeCount').lean();
  if (!competition) throw new Error('未找到比赛');
  if ([SPORT_TYPES.DIVING, SPORT_TYPES.TRAMPOLINE].includes(getCompetitionSportType(competition))) {
    throw new Error('跳水和蹦床赛事使用专用评分规则，不能用此脚本修改');
  }

  const schedules = await Schedule.find({ competition: competitionId }).select('_id name judgeCount').lean();
  const results = schedules.length
    ? await Result.find({ schedule: { $in: schedules.map((schedule) => schedule._id) } }).select('participant').populate('participant', 'isTest').lean()
    : [];
  const formalResultCount = results.filter((result) => !result.participant?.isTest).length;
  const testResultCount = results.length - formalResultCount;
  const summary = { competition: competition.name, competitionId, judgeCount, scheduleCount: schedules.length, existingResultCount: results.length, formalResultCount, testResultCount, apply, clearExistingResults };
  console.log(JSON.stringify(summary, null, 2));

  if (!apply) return;
  if (formalResultCount > 0 && !clearExistingResults) {
    throw new Error('发现已有正式成绩；如确认不保留，请使用 --apply --clear-existing-results 后重试');
  }

  if (formalResultCount > 0) {
    const formalResultIds = results
      .filter((result) => !result.participant?.isTest)
      .map((result) => result._id);
    await Result.deleteMany({ _id: { $in: formalResultIds } });
    console.log(`已删除该比赛的 ${formalResultIds.length} 条正式成绩；测试成绩未删除。`);
  }

  await Competition.updateOne({ _id: competitionId }, { $set: { standardJudgeCount: judgeCount } });
  await Schedule.updateMany({ competition: competitionId, scoringMode: { $ne: 'diving' } }, { $set: { judgeCount } });
  console.log(`已设置「${competition.name}」为 ${judgeCount} 位裁判，并同步 ${schedules.length} 个赛程。`);
};

main()
  .catch((error) => { console.error(error.message || error); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect(); });
