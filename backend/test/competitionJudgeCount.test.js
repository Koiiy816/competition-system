const test = require('node:test');
const assert = require('node:assert/strict');
const { getConfiguredJudgeCount, applyCompetitionJudgeCount } = require('../utils/competitionJudgeCount');

test('赛事级普通裁判人数只接受 3、4、5，并覆盖普通赛程', () => {
  assert.equal(getConfiguredJudgeCount({ standardJudgeCount: 3 }), 3);
  assert.equal(getConfiguredJudgeCount({ standardJudgeCount: 2 }), null);
  assert.equal(getConfiguredJudgeCount({}), null);

  const schedule = { name: '陈氏太极拳精要十八式', judgeCount: 5, scoringMode: 'standard' };
  assert.equal(applyCompetitionJudgeCount({ sportType: 'wushu', standardJudgeCount: 3 }, schedule).judgeCount, 3);
});

test('赛事级普通裁判人数不覆盖跳水和蹦床专用规则', () => {
  assert.equal(
    applyCompetitionJudgeCount({ sportType: 'diving', standardJudgeCount: 3 }, { name: '跳水', judgeCount: 5, scoringMode: 'diving' }).judgeCount,
    5
  );
  assert.equal(
    applyCompetitionJudgeCount({ sportType: 'trampoline', standardJudgeCount: 3 }, { name: '大网U8组蹦床个人', judgeCount: 5 }).judgeCount,
    7
  );
});
