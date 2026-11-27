import test from 'node:test';
import assert from 'node:assert/strict';
import { getWushuFloorAwardLevel } from './awardRules.js';

test('正雷杯个人项目按四舍五入的累计边界录取全部完赛选手', () => {
  const awards = Array.from({ length: 11 }, (_, index) => getWushuFloorAwardLevel(index + 1, 11, '女子太极扇'));
  assert.deepEqual(awards, ['金奖', '金奖', '金奖', '银奖', '银奖', '银奖', '银奖', '银奖', '铜奖', '铜奖', '铜奖']);
});

test('正雷杯个人项目同分跳过名次时仍让最后一名取得铜奖', () => {
  assert.equal(getWushuFloorAwardLevel(1, 11, '女子太极扇'), '金奖');
  assert.equal(getWushuFloorAwardLevel(2, 11, '女子太极扇'), '金奖');
  assert.equal(getWushuFloorAwardLevel(4, 11, '女子太极扇'), '银奖');
  assert.equal(getWushuFloorAwardLevel(7, 11, '女子太极扇'), '银奖');
  assert.equal(getWushuFloorAwardLevel(9, 11, '女子太极扇'), '铜奖');
  assert.equal(getWushuFloorAwardLevel(11, 11, '女子太极扇'), '铜奖');
});

test('正雷杯集体项目按六四比例四舍五入且全部录取', () => {
  assert.deepEqual(Array.from({ length: 4 }, (_, index) => getWushuFloorAwardLevel(index + 1, 4, '集体项目')), ['一等奖', '一等奖', '二等奖', '二等奖']);
});

test('正雷杯个人项目不足三人只设金奖和银奖', () => {
  assert.equal(getWushuFloorAwardLevel(1, 1, '个人项目'), '金奖');
  assert.equal(getWushuFloorAwardLevel(2, 2, '个人项目'), '银奖');
  assert.equal(getWushuFloorAwardLevel(3, 2, '个人项目'), null);
});
