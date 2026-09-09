import assert from 'node:assert/strict';
import test from 'node:test';
import { isCompletedDivingPlan, toDivingPlanPrintRecord } from './divingPlanPrint.js';

test('formats an individual diving plan for printing', () => {
  const participant = {
    name: '柯雨鑫', gender: 'male', schoolName: '深圳市代表队', ageGroup: 'U12组', event: '1米跳板',
    competition: { name: '广东省第十七届运动会跳水比赛' },
    additionalInfo: { divingPlan: { takeoffOrHeight: '3m', dives: [{ actionCode: '101C', difficulty: 1.2 }, { actionCode: '201B', difficulty: 1.5 }] } }
  };

  assert.equal(isCompletedDivingPlan(participant), true);
  assert.deepEqual(toDivingPlanPrintRecord(participant), {
    competitionName: '广东省第十七届运动会跳水比赛', unit: '深圳市代表队', name: '柯雨鑫', gender: '男', group: 'U12组', event: '1米跳板', takeoffOrHeight: '3m',
    dives: [{ actionCode: '101C', posture: 'C', difficulty: 1.2 }, { actionCode: '201B', posture: 'B', difficulty: 1.5 }]
  });
});

test('requires every saved round to have an action code', () => {
  assert.equal(isCompletedDivingPlan({ additionalInfo: { divingPlan: { dives: [{ actionCode: '101C' }, { actionCode: '' }] } } }), false);
});

test('formats mixed-gender diving pairs as mixed gender', () => {
  const record = toDivingPlanPrintRecord({
    name: '男选手', gender: 'male', event: '男女混合跳台双人',
    additionalInfo: { divingPair: { partnerName: '女选手' }, divingPlan: { dives: [{ actionCode: '101A', difficulty: 1.4 }] } }
  });
  assert.equal(record.gender, '男女混合');
});
