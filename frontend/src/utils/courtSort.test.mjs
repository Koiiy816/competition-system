import test from 'node:test';
import assert from 'node:assert/strict';
import { compareCourts } from './courtSort.js';

test('按场地编号自然排序，不按中文字符串排序', () => {
  const courts = ['第四场地', '第一场地', '第三场地', '第二场地'];
  assert.deepEqual(courts.sort(compareCourts), ['第一场地', '第二场地', '第三场地', '第四场地']);
});

test('兼容阿拉伯数字场地名称', () => {
  const courts = ['第10场地', '第2场地', '第1场地'];
  assert.deepEqual(courts.sort(compareCourts), ['第1场地', '第2场地', '第10场地']);
});
