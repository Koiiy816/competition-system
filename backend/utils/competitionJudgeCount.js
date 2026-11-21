const { applyTrampolineJudgeCount, getTrampolineScoringType } = require('./trampolineScoring');

const STANDARD_JUDGE_COUNTS = new Set([3, 4, 5]);

const getConfiguredJudgeCount = (competition) => {
  const judgeCount = Number(competition?.standardJudgeCount);
  return STANDARD_JUDGE_COUNTS.has(judgeCount) ? judgeCount : null;
};

// 跳水和蹦床有各自固定的专用计分规则；其余赛事才使用赛事级普通裁判人数。
const applyCompetitionJudgeCount = (competition, schedule) => {
  const adjustedSchedule = applyTrampolineJudgeCount(competition, schedule);
  if (getTrampolineScoringType(competition, adjustedSchedule) || adjustedSchedule.scoringMode === 'diving') return adjustedSchedule;

  const judgeCount = getConfiguredJudgeCount(competition);
  if (judgeCount) adjustedSchedule.judgeCount = judgeCount;
  return adjustedSchedule;
};

module.exports = { getConfiguredJudgeCount, applyCompetitionJudgeCount };
