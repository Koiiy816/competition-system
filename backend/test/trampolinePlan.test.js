const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeTrampolinePlan, isLargeTrampolineEvent } = require('../utils/trampolinePlan');
const actions = (difficulty = 0.3) => Array.from({ length: 10 }, () => ({ actionCode: '30', posture: 'o', difficulty }));

test('大网动作表固定两套各十个动作，服务端分别计算难度', () => {
  const plan = normalizeTrampolinePlan({ routines: [{ actions: actions() }, { actions: actions(0.5) }], totalDifficulty: 999 });
  assert.deepEqual(plan.routines.map(r => [r.name, r.actions.length, r.totalDifficulty]), [['蹦床1', 10, 3], ['蹦床2', 10, 5]]);
  assert.equal(plan.totalDifficulty, 8);
  assert.ok(plan.routines.every(r => r.difficultyComplete));
});

test('拒绝单套、额外套次、错误动作数量及非法代码姿势', () => {
  for (const routines of [[{ actions: actions() }], Array(3).fill({ actions: actions() }),
    [{ actions: actions().slice(1) }, { actions: actions() }],
    [{ actions: [...actions(), ...actions()] }, { actions: actions() }]]) {
    assert.throws(() => normalizeTrampolinePlan({ routines }));
  }
  for (const change of [{ actionCode: '30o' }, { posture: 'X' }, { difficulty: -1 }]) {
    assert.throws(() => normalizeTrampolinePlan({ routines: [{ actions: [{ ...actions()[0], ...change }, ...actions().slice(1)] }, { actions: actions() }] }));
  }
});

test('未确认难度保留为空，不能当作已确认的零分D分', () => {
  const plan = normalizeTrampolinePlan({ routines: [{ actions: actions('') }, { actions: actions(0) }] });
  assert.equal(plan.routines[0].difficultyComplete, false);
  assert.equal(plan.routines[1].difficultyComplete, true);
  assert.equal(plan.routines[1].totalDifficulty, 0);
});

test('只有大网参赛记录需要动作表', () => {
  assert.equal(isLargeTrampolineEvent({ event: '大网U8组蹦床个人' }), true);
  for (const event of ['小网U8组男子蹦床个人', '小网小学组蹦床操', '大网小网蹦床操', '拳术']) {
    assert.equal(isLargeTrampolineEvent({ event }), false);
  }
});
