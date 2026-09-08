import assert from 'node:assert/strict';
import test from 'node:test';
import { getAutoAgeGroup } from './ageGroup.js';

const divingGroups = [
  { name: 'U12组' },
  { name: 'U10组' },
  { name: 'U8组' },
  { name: 'U7组' }
];

test('跳水 U8 组可按出生日期自动识别', () => {
  assert.equal(getAutoAgeGroup('2018-09-08', divingGroups, 2026), 'U8组');
});

test('跳水 U7 和 U10 的现有年龄边界保持正确', () => {
  assert.equal(getAutoAgeGroup('2019-09-08', divingGroups, 2026), 'U7组');
  assert.equal(getAutoAgeGroup('2017-09-08', divingGroups, 2026), 'U10组');
});

test('明确配置的出生日期范围优先于旧版 U 组别规则', () => {
  const groups = [{ name: 'U8组', birthDateStart: '2018-01-01', birthDateEnd: '2018-12-31' }];
  assert.equal(getAutoAgeGroup('2018-09-08', groups, 2026), 'U8组');
});
