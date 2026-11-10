import test from 'node:test';
import assert from 'node:assert/strict';
import { getTrampolineAthleteCount, getTrampolineCoachLimit, validateTrampolineStaff, findTrampolineDuplicate } from './trampolineStaff.js';

test('同一运动员多项目只计一人，5/6/10/11人的教练限额正确', () => {
  assert.equal(getTrampolineAthleteCount([{ idCard: 'ABC' }, { idCard: ' abc ' }]), 1);
  assert.equal(getTrampolineAthleteCount([{ idCard: 'A BC' }, { idCard: 'abc' }]), 1);
  for (const [count, limit] of [[0, 0], [1, 1], [5, 1], [6, 2], [10, 2], [11, 3]]) {
    assert.equal(getTrampolineCoachLimit(count), limit);
  }
});

test('同人同项目立即提示重复，报名其他项目仍只计一个人', () => {
  const row = { name: '选手甲', gender: 'male', idCard: 'P001', event: '大网个人' };
  assert.match(findTrampolineDuplicate([row, { ...row, name: '选手 甲', idCard: ' p001 ' }]), /重复/);
  assert.equal(findTrampolineDuplicate([row, { ...row, event: '小网个人' }]), '');
});

test('领队教练全部留空或仅填姓名、电话之一，均可进入确认页', () => {
  for (const staff of [undefined, {}, { leader: {}, coaches: [] },
    { leader: { name: '', phone: '' }, coaches: [{ name: '', phone: '' }, {}] },
    { leader: { name: '领队' }, coaches: [{ name: '教练' }] }, { coaches: [{ phone: '123' }] }]) {
    assert.equal(validateTrampolineStaff(staff, 1), '');
  }
});

test('教练超额、重复及字段过长时仍阻止进入确认页', () => {
  const leader = { name: '领队', phone: '123' };
  const coaches = [{ name: '甲', phone: '456' }, { name: '乙', phone: '789' }];
  assert.equal(validateTrampolineStaff({ leader, coaches }, 6), '');
  assert.match(validateTrampolineStaff({ leader, coaches }, 5), /最多可报1名/);
  assert.equal(validateTrampolineStaff({ leader: {}, coaches }, 6), '');
  assert.equal(validateTrampolineStaff({ leader, coaches: [] }, 6), '');
  assert.ok(validateTrampolineStaff({ leader, coaches: [coaches[0], coaches[0]] }, 6));
  assert.match(validateTrampolineStaff({ leader, coaches: [coaches[0], { name: '乙'.repeat(51) }] }, 6), /教练2/);
  assert.match(validateTrampolineStaff({ leader, coaches }, 5), /当前已填2名/);
});
