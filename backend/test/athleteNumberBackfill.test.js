const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAthleteNumberBackfillPlan } = require('../utils/athleteNumberBackfill');

test('历史蹦床和跳水补号仅自动处理身份资料完整的报名', () => {
  const competition = { _id: 'competition-1', name: '蹦床测试赛' };
  const complete = { _id: 'complete', competition: competition._id, name: '完整选手', schoolName: '甲学校', birthDate: '2020-01-02', idCard: 'DOC-1' };
  const incomplete = { _id: 'incomplete', competition: competition._id, name: '同名选手', schoolName: '甲学校', birthDate: '2020-01-02' };
  const plan = buildAthleteNumberBackfillPlan([competition], [complete, incomplete]);
  assert.deepEqual(plan.eligible, [complete]);
  assert.equal(plan.summary.pending, 2);
  assert.equal(plan.summary.eligible, 1);
  assert.equal(plan.summary.skipped, 1);
  assert.deepEqual(plan.skipped[0].missing, ['证件号码']);
});
