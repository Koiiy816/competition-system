import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Module, createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { transformWithEsbuild } from 'vite';

const filename = fileURLToPath(new URL('../components/participants/RenameTrampolineUnitDialog.jsx', import.meta.url));
const transformed = await transformWithEsbuild(fs.readFileSync(filename, 'utf8'), filename, { loader: 'jsx', format: 'cjs' });
let states = [], hookIndex = 0, effect, request, failure;
const compiled = new Module(filename);
compiled.filename = filename;
compiled.paths = createRequire(import.meta.url).resolve.paths('react');
const originalRequire = compiled.require.bind(compiled);
compiled.require = spec => {
  if (spec === 'react') return { ...React, useState: initial => {
    const index = hookIndex++;
    if (!Object.hasOwn(states, index)) states[index] = initial;
    return [states[index], value => { states[index] = value; }];
  }, useEffect: value => { effect = value; } };
  if (spec.includes('participantService')) return { renameTrampolineUnit: async (...args) => {
    request = args;
    if (failure) throw new Error(failure);
    return { message: '已统一更名', data: { registrationCount: 8 } };
  } };
  return originalRequire(spec);
};
compiled._compile(transformed.code, filename);
const elements = node => Array.isArray(node) ? node.flatMap(elements) : React.isValidElement(node) ? [node, ...elements(node.props.children)] : [];
const render = props => { hookIndex = 0; return elements(compiled.exports.default(props)); };

test('整单位更名有明确原名与新名，仅提交更名请求并传回成功提示', async () => {
  states = []; request = null; failure = '';
  let result;
  const props = { open: true, competitionId: 'event', originalName: '原单位', initialName: '新单位', onSuccess: value => { result = value; } };
  render(props); effect();
  let nodes = render(props);
  assert.equal(nodes.find(e => e.props.label === '新单位名称').props.value, '新单位');
  assert.ok(nodes.some(e => Array.isArray(e.props.children) && e.props.children.includes('原单位')));
  nodes.find(e => e.props.label === '新单位名称').props.onChange({ target: { value: ' 新单位确认 ' } });
  nodes = render(props);
  await nodes.find(e => e.props.children === '确认统一更名').props.onClick();
  assert.deepEqual(request, ['event', { oldSchoolName: '原单位', newSchoolName: '新单位确认' }]);
  assert.equal(result.data.registrationCount, 8);
});

test('更名拒绝或名称无效时留在弹窗内展示原因，不报告成功', async () => {
  states = []; request = null; failure = '新名称已存在对应的参赛单位';
  let success = false;
  const props = { open: true, competitionId: 'event', originalName: '原单位', onSuccess: () => { success = true; } };
  render(props); effect();
  let nodes = render(props);
  assert.equal(nodes.find(e => e.props.children === '确认统一更名').props.disabled, true);
  nodes.find(e => e.props.label === '新单位名称').props.onChange({ target: { value: '冲突单位' } });
  await render(props).find(e => e.props.children === '确认统一更名').props.onClick();
  assert.ok(render(props).some(e => e.props.severity === 'error' && e.props.children === failure));
  assert.equal(success, false);
  request = null;
  nodes = render(props);
  nodes.find(e => e.props.label === '新单位名称').props.onChange({ target: { value: ' ' } });
  await render(props).find(e => e.props.children === '确认统一更名').props.onClick();
  assert.equal(request, null);
  assert.ok(render(props).some(e => e.props.severity === 'error' && /填写新单位/.test(e.props.children)));
});

test('单位端更名弹窗明确本账号范围和重新审核，管理员仍显示跨账号范围', () => {
  states = [];
  const props = { open: true, originalName: '原单位' };
  for (const ownRegistrationsOnly of [true, false]) {
    const alert = render({ ...props, ownRegistrationsOnly }).find(e => e.props.severity === 'info');
    assert.match(alert.props.children, ownRegistrationsOnly ? /仅将本账号.*待审核.*其他账号的报名不受影响/ : /包括不同账号提交/);
  }
});
