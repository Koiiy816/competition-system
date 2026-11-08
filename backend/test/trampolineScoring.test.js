const test = require('node:test');
const assert = require('node:assert/strict');
const { applyTrampolineJudgeCount } = require('../utils/trampolineScoring');

test('小网个人与蹦床操固定两位裁判，大网固定七位评分裁判', () => {
  for (const name of ['小网U7组男子蹦床个人', '混合集体 小网小学组蹦床操', '幼儿组蹦床操']) {
    assert.equal(applyTrampolineJudgeCount({ sportType: 'trampoline' }, { name, judgeCount: 5 }).judgeCount, 2);
  }
  assert.equal(applyTrampolineJudgeCount({ sportType: 'trampoline' }, { name: '大网U8组蹦床个人', judgeCount: 5 }).judgeCount, 7);
});

test('非蹦床赛事即使含有相似项目名称，也不改变裁判人数', () => {
  for (const sportType of ['wushu', 'diving', 'other']) {
    const schedule = { name: '小网蹦床操', judgeCount: 5 };
    assert.deepEqual(applyTrampolineJudgeCount({ sportType }, { ...schedule }), schedule);
  }
});

const { calculateTrampolineScore, getTrampolineJudgeIndex } = require('../utils/trampolineScoring');
test('大网去掉各一个极值，仅合计中间两位技术分再扣分', () => {
  assert.equal(calculateTrampolineScore([6, 9, 8, 7, 99, 98, 97], 0.5, 'large'), 14.5);
  assert.equal(calculateTrampolineScore([8, 8, 8, 8, 0, 0, 0], 1, 'large'), 15);
});
test('小网相加再扣分，零分有效，未填技术分不计算', () => {
  assert.equal(calculateTrampolineScore([8, 9], 0.3, 'small'), 16.7);
  assert.equal(calculateTrampolineScore([0, 8], 1, 'small'), 7);
  assert.equal(calculateTrampolineScore([null, 8], 1, 'small'), 0);
  assert.equal(calculateTrampolineScore([1, 2, 3], 0, 'large'), 0);
});
test('按维度名称分配评分栏位，拒绝小网多余裁判', () => {
  for (const [name, index] of [['E1',0],['E4（技术分）',3],['D1',4],['T1',5],['H1',6],['裁判7',6]]) {
    assert.equal(getTrampolineJudgeIndex({ name }, 'large'), index);
  }
  for (const name of ['E3','D1','H1','裁判3','未知']) assert.equal(getTrampolineJudgeIndex({ name }, 'small'), -1);
});
