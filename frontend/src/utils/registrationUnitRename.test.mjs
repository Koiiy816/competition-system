import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Module, createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { transformWithEsbuild } from 'vite';

const filename = fileURLToPath(new URL('../components/participants/EditRegistrationModal.jsx', import.meta.url));
const transformed = await transformWithEsbuild(fs.readFileSync(filename, 'utf8'), filename, { loader: 'jsx', format: 'cjs' });
let states = [], hookIndex = 0, effect, sportType = 'trampoline', saves = 0, savedArgs;
const compiled = new Module(filename);
compiled.filename = filename;
compiled.paths = createRequire(import.meta.url).resolve.paths('react');
const originalRequire = compiled.require.bind(compiled);
compiled.require = spec => {
  if (spec === 'react') return { ...React, useState: initial => {
    const index = hookIndex++;
    if (!Object.hasOwn(states, index)) states[index] = initial;
    return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  }, useEffect: value => { effect = value; } };
  if (spec.includes('competitionService')) return { getCompetition: async () => ({ data: { _id: 'event', sportType, events: [] } }) };
  if (spec.includes('participantService')) return { updateRegistrationContent: async (...args) => { saves++; savedArgs = args; } };
  if (spec.includes('RenameTrampolineUnitDialog')) return () => null;
  return originalRequire(spec);
};
compiled._compile(transformed.code, filename);
const elements = node => Array.isArray(node) ? node.flatMap(elements) : React.isValidElement(node) ? [node, ...elements(node.props.children)] : [];
const render = props => { hookIndex = 0; return elements(compiled.exports.default(props)); };

test('我的报名打开统一更名时限定本账号范围，并传回整批更新的结果', async () => {
  states = []; saves = 0; sportType = 'trampoline';
  let result;
  const props = { participant: { _id: 'entry', competition: 'event', schoolName: '原单位', name: '选手' }, onSuccess: value => { result = value; } };
  render(props); effect(); await Promise.resolve();
  let nodes = render(props);
  nodes.find(e => e.props.label === '代表单位 / 学校').props.onChange({ target: { value: '新单位' } });
  nodes.find(e => e.props.children === '整个单位统一更名').props.onClick();
  nodes = render(props);
  const dialog = nodes.find(e => e.props.ownRegistrationsOnly === true);
  assert.equal(dialog.props.open, true);
  assert.equal(dialog.props.competitionId, 'event');
  assert.equal(dialog.props.originalName, '原单位');
  assert.equal(dialog.props.initialName, '新单位');
  dialog.props.onSuccess({ message: '已更新6条报名，请等待重新审核' });
  assert.match(result.message, /6条报名/);
  assert.equal(saves, 0);
});

test('武术报名编辑保持原有入口，不显示蹦床统一更名', async () => {
  states = []; sportType = 'wushu';
  const props = { participant: { _id: 'entry', competition: 'event', schoolName: '武术单位', event: '拳术', athleteNumber: 'AT-existing' }, onSuccess: () => {} };
  render(props); effect(); await Promise.resolve();
  const nodes = render(props);
  assert.ok(!nodes.some(e => e.props.children === '整个单位统一更名'));
  assert.ok(nodes.some(e => e.props.label === '教练联系电话'));
  await nodes.find(e => e.props.children === '保存并提交审核').props.onClick();
  assert.equal(Object.hasOwn(savedArgs[2], 'trampolineCoaches'), false);
});

test('单位端显示全部教练并完整提交第二名的修改，允许删除、清空和新增', async () => {
  states = []; saves = 0; sportType = 'trampoline';
  const coaches = [{ name: '甲', phone: '123' }, { name: '乙', phone: '456' }];
  const props = { participant: { _id: 'entry', competition: 'event', schoolName: '单位', event: '大网个人', coach: '甲', coachPhone: '123',
    additionalInfo: { trampolineStaff: { coaches } } }, onSuccess: () => {} };
  render(props); effect(); await Promise.resolve();
  let nodes = render(props);
  assert.equal(nodes.find(e => e.props.label === '教练1姓名').props.value, '甲');
  assert.equal(nodes.find(e => e.props.label === '教练2姓名').props.value, '乙');
  assert.ok(!nodes.some(e => e.props.label === '教练联系电话'));
  nodes.find(e => e.props.label === '教练2电话').props.onChange({ target: { value: '789' } });
  const save = async () => render(props).find(e => e.props.children === '保存并提交审核').props.onClick();
  await save();
  assert.deepEqual(savedArgs[2].trampolineCoaches, [coaches[0], { name: '乙', phone: '789' }]);
  const text = e => Array.isArray(e.props.children) ? e.props.children.join('') : e.props.children;
  render(props).find(e => e.props.onClick && text(e) === '删除教练1').props.onClick();
  nodes = render(props);
  assert.equal(nodes.find(e => e.props.label === '教练1姓名').props.value, '乙');
  nodes.find(e => e.props.onClick && text(e) === '删除教练1').props.onClick();
  await save();
  assert.deepEqual(savedArgs[2].trampolineCoaches, []);
  render(props).find(e => e.props.children === '添加教练').props.onClick();
  nodes = render(props);
  assert.equal(nodes.find(e => e.props.label === '教练1姓名').props.value, '');
  nodes.find(e => e.props.label === '教练1姓名').props.onChange({ target: { value: '新教练' } });
  await save();
  assert.deepEqual(savedArgs[2].trampolineCoaches, [{ name: '新教练', phone: '' }]);
  const previousSaves = saves;
  render(props).find(e => e.props.children === '添加教练').props.onClick();
  render(props).find(e => e.props.label === '教练2姓名').props.onChange({ target: { value: '新教练' } });
  await save();
  assert.equal(saves, previousSaves);
  assert.ok(render(props).some(e => e.props.severity === 'error' && /请勿重复/.test(e.props.children)));
});
