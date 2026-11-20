import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Module, createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { transformWithEsbuild } from 'vite';

const filename = fileURLToPath(new URL('../components/CollectiveSplitDialog.jsx', import.meta.url));
const transformed = await transformWithEsbuild(fs.readFileSync(filename, 'utf8'), filename, { loader: 'jsx', format: 'cjs' });
let state = []; let cursor = 0; let effects = []; let lastDependencies;
let savedRequest;
const compiled = new Module(filename);
compiled.filename = filename;
compiled.paths = createRequire(import.meta.url).resolve.paths('react');
const originalRequire = compiled.require.bind(compiled);
compiled.require = spec => {
  if (spec === 'react') return { ...React, useState: initial => {
    const index = cursor++;
    if (!Object.hasOwn(state, index)) state[index] = initial;
    return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
  }, useEffect: (effect, dependencies) => {
    if (!lastDependencies || dependencies.some((dependency, i) => dependency !== lastDependencies[i])) effects.push(effect);
    lastDependencies = dependencies;
  } };
  if (spec.includes('/services/')) return { splitCollectiveSchedule: async (...args) => { savedRequest = args; return { message: '已保存' }; } };
  return originalRequire(spec);
};
compiled._compile(transformed.code, filename);
const nodes = element => Array.isArray(element) ? element.flatMap(nodes) : !element?.props ? [] : [element, ...nodes(element.props.children)];

test('分场弹窗按整队均分并提交场地，重新打开时保留已有分配', async () => {
  state = []; effects = []; lastDependencies = undefined; savedRequest = undefined;
  const teams = Array.from({ length: 4 }, (_, i) => ({ _id: `team-${i}`, teamName: `单位${i}1队`, teamMembers: [{ name: '队员' }] }));
  const original = { _id: 'source', name: '集体拳', scheduleDate: '2026-11-29', timeSlot: '上午', court: '第一场地', participants: teams };
  let success;
  const props = { competitionId: 'competition', schedule: original, schedules: [original], onClose: () => {}, onSaved: message => { success = message; } };
  const render = () => { cursor = 0; let element = compiled.exports.default(props); if (effects.length) { const pending = effects; effects = []; pending.forEach(effect => effect()); cursor = 0; element = compiled.exports.default(props); } return nodes(element); };
  let tree = render();
  assert.equal(tree.find(node => node.props.children === '保存分场编排').props.disabled, true);
  tree.filter(node => node.props.label === '场地')[1].props.onChange({ target: { value: '第二场地' } });
  tree.find(node => node.props.children === '按队数均分').props.onClick();
  tree = render();
  const save = tree.find(node => node.props.children === '保存分场编排');
  assert.equal(save.props.disabled, false);
  await save.props.onClick();
  assert.equal(success, '已保存');
  assert.deepEqual(savedRequest, ['competition', 'source', [
    { court: '第一场地', scheduleDate: '2026-11-29', timeSlot: '上午', exactTime: '', participantIds: ['team-0', 'team-2'] },
    { court: '第二场地', scheduleDate: '2026-11-29', timeSlot: '上午', exactTime: '', participantIds: ['team-1', 'team-3'] }
  ]]);
  props.schedules = savedRequest[2].map((batch, index) => ({ ...batch, _id: `batch-${index}`, rankingGroupId: 'source', batchNumber: index + 1, participants: teams.filter(team => batch.participantIds.includes(team._id)) }));
  props.schedule = props.schedules[1];
  render();
  assert.deepEqual(state[2], { 'team-0': 0, 'team-2': 0, 'team-1': 1, 'team-3': 1 });
});
