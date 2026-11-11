import test from 'node:test';
import assert from 'node:assert/strict';
import { getTrampolineAthleteCount, getTrampolineCoachLimit, validateTrampolineStaff, findTrampolineDuplicate, findTrampolineIdentityConflict } from './trampolineStaff.js';

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

test('当前名单内，同一证件修改姓名、性别或生日，即使不同项目也应提示冲突', () => {
  const person = { name: '选手甲', gender: 'male', idCard: 'P001', birthDate: '2019-01-01', event: '大网个人' };
  assert.equal(findTrampolineIdentityConflict([person, { ...person, name: '选手 甲', idCard: ' p001 ', event: '小网个人' }]), '');
  for (const [field, value, label] of [['name', '乙', '姓名'], ['gender', 'female', '性别'], ['birthDate', '2018-01-01', '出生日期']]) {
    assert.match(findTrampolineIdentityConflict([person, { ...person, [field]: value, event: '小网个人' }]), new RegExp(label));
  }
});

test('领队教练全部留空或仅填姓名、电话之一，均可进入确认页', () => {
  for (const staff of [undefined, {}, { leader: {}, coaches: [] },
    { leader: { name: '', phone: '' }, coaches: [{ name: '', phone: '' }, {}] },
    { leader: { name: '领队' }, coaches: [{ name: '教练' }] }, { coaches: [{ phone: '123' }] }]) {
    assert.equal(validateTrampolineStaff(staff, 1), '');
  }
});

test('教练人数交给服务端累计校验，重复及字段过长仍在前端阻止', () => {
  const leader = { name: '领队', phone: '123' };
  const coaches = [{ name: '甲', phone: '456' }, { name: '乙', phone: '789' }];
  assert.equal(validateTrampolineStaff({ leader, coaches }, 6), '');
  assert.equal(validateTrampolineStaff({ leader, coaches }, 5), '');
  assert.equal(validateTrampolineStaff({ leader: {}, coaches }, 6), '');
  assert.equal(validateTrampolineStaff({ leader, coaches: [] }, 6), '');
  assert.ok(validateTrampolineStaff({ leader, coaches: [coaches[0], coaches[0]] }, 6));
  assert.match(validateTrampolineStaff({ leader, coaches: [coaches[0], { name: '乙'.repeat(51) }] }, 6), /教练2/);
});
