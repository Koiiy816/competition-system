import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrampolinePlan, getTrampolineActionDifficulty, getTrampolineRoutineD, isLargeTrampolineEvent, trampolineRoutineDifficulty } from './trampolinePlan.js';

test('两套各十个输入，旧单表动作完整带入且不伪造第二套', () => {
  const old = Array.from({ length: 10 }, (_, i) => ({ actionCode: String(30 + i), posture: 'o', difficulty: i / 10 }));
  const plan = buildTrampolinePlan({ actions: old });
  assert.deepEqual(plan.routines.map(r => [r.name, r.actions.length]), [['蹦床1', 10], ['蹦床2', 10]]);
  assert.deepEqual(plan.routines[0].actions, old);
  assert.ok(plan.routines[1].actions.every(a => a.actionCode === '' && a.difficulty === ''));
  const long = buildTrampolinePlan({ actions: [...old, ...old, ...old] });
  assert.equal(long.routines.flatMap(r => r.actions).length, 30);
});

test('只有已确认完整难度可自动成为D分，零难度有效，缺失难度不冒充零分', () => {
  const actions = Array.from({ length: 10 }, () => ({ actionCode: '30', posture: 'o', difficulty: 0 }));
  assert.equal(getTrampolineRoutineD({ actions, totalDifficulty: 0 }), 0);
  assert.equal(getTrampolineRoutineD({ actions: [...actions.slice(1), { ...actions[0], difficulty: '' }], totalDifficulty: 0 }), null);
  assert.equal(getTrampolineRoutineD(undefined), null);
  assert.equal(trampolineRoutineDifficulty({ actions }), 3);
});

test('动作表筛选仅保留大网', () => {
  assert.equal(isLargeTrampolineEvent({ event: '大网U14组蹦床个人' }), true);
  for (const event of ['小网U7组男子蹦床个人', '小网小学组蹦床操']) assert.equal(isLargeTrampolineEvent({ event }), false);
});

test('空白动作不匹配难度表首条记录，也不产生虚假的预计难度', () => {
  assert.equal(getTrampolineActionDifficulty({ actionCode: '', posture: '' }), undefined);
  assert.equal(getTrampolineActionDifficulty({ actionCode: '30', posture: '' }), undefined);
  assert.equal(trampolineRoutineDifficulty(buildTrampolinePlan().routines[0]), 0);
});
