import test from 'node:test';
import assert from 'node:assert/strict';
import { getRankingProjectName } from './collectiveRanking.mjs';
import { getScheduleDisplayName } from './trampolineRegistration.js';

test('同一项目不同场地或批次名称汇总为一个排名项目，独立年龄组保留', () => {
  const first = { name: '集体拳', rankingGroupId: 'shared', rankingGroupName: '集体拳', batchNumber: 1 };
  const second = { ...first, name: '场地二自定义名称', batchNumber: 2 };
  assert.equal(getRankingProjectName(first), getRankingProjectName(second));
  assert.notEqual(getRankingProjectName({ name: 'B组 集体拳' }), getRankingProjectName({ name: 'C组 集体拳' }));
  assert.equal(getRankingProjectName(null), '未分类项目');
  assert.equal(getScheduleDisplayName({ sportType: 'wushu' }, first), '集体拳（第1批 · 统一排名）');
});
