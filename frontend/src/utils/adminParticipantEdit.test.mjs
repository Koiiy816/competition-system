import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Module, createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { transformWithEsbuild } from 'vite';

const filename = fileURLToPath(new URL('../components/participants/AddParticipantModal.jsx', import.meta.url));
const transformed = await transformWithEsbuild(fs.readFileSync(filename, 'utf8'), filename, { loader: 'jsx', format: 'cjs' });
const effects = [];
let states = [];
let hookIndex = 0;
const updates = [];
let testCompetition = { sportType: 'wushu', events: [{ name: '集体武术操', isGroupEvent: true, ageGroups: [] }] };
const compiled = new Module(filename);
compiled.filename = filename;
compiled.paths = createRequire(import.meta.url).resolve.paths('react');
const originalRequire = compiled.require.bind(compiled);
compiled.require = spec => {
  if (spec === 'react') return { ...React, useState: initial => {
    const index = hookIndex++;
    if (!Object.hasOwn(states, index)) states[index] = initial;
    return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  }, useEffect: effect => effects.push(effect) };
  if (spec === 'react-router-dom') return { useNavigate: () => () => {} };
  if (spec.includes('AuthContext')) return { useAuth: () => ({ user: { roles: ['admin'] } }) };
  if (spec.includes('competitionService')) return { getCompetition: async () => ({ data: testCompetition }) };
  if (spec.includes('participantService')) return { updateParticipant: async (...args) => updates.push(args) };
  if (spec.includes('AthleteIdentitySelect')) return () => null;
  return originalRequire(spec);
};
compiled._compile(transformed.code, filename);

const render = props => {
  effects.length = 0;
  hookIndex = 0;
  return compiled.exports.default(props);
};

for (const edit of [false, true]) {
  test(`HTTP administrator ${edit ? 'edit' : 'add'} opens, loads form and reopens without randomUUID`, async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    try {
      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: bytes => bytes.fill(7) } });
      states = [];
      const props = { open: true, competitionId: 'competition', editData: edit ? { _id: 'entry', name: '选手', athleteNumber: 'AT-existing' } : null };
      render(props);
      assert.doesNotThrow(() => effects[0]());
      await Promise.resolve();
      const form = render(props);
      assert.equal(form.props.children[0].props.children, edit ? '编辑参赛者' : '添加参赛者');
      assert.ok(states.some(value => typeof value === 'string' && /^[0-9a-f]{8}-/.test(value)));
      if (edit) assert.ok(states.includes('AT-existing'));
      render({ ...props, open: false });
      assert.doesNotThrow(() => effects[0]());
      render(props);
      assert.doesNotThrow(() => effects[0]());
      await Promise.resolve();
      assert.doesNotThrow(() => render(props));
    } finally { Object.defineProperty(globalThis, 'crypto', descriptor); }
  });
}

test('editing a collective registration restores its project and team number', async () => {
  states = [];
  const props = {
    open: true,
    competitionId: 'competition',
    editData: {
      _id: 'collective-entry', name: '张红', schoolName: '测试单位', event: '集体武术操',
      groupTeam: '养生队', grade: 'C组', ageGroup: 'C组', gender: 'female'
    }
  };
  render(props);
  await effects[0]();
  assert.ok(states.some((value) => value?.event === '集体武术操' && value.groupTeam === '养生队'));
  const source = fs.readFileSync(filename, 'utf8');
  assert.match(source, /if \(editData && event\.name === formData\.event\) return true/);
  assert.match(source, /label="队伍编号"/);
});

const elements = node => Array.isArray(node) ? node.flatMap(elements) : React.isValidElement(node)
  ? [node, ...elements(node.props.children)] : [];

test('administrator can save a collective registration with an empty team number', async () => {
  states = []; updates.length = 0;
  let saved = false;
  const props = { open: true, competitionId: 'competition', onSuccess: () => { saved = true; },
    editData: { _id: 'entry', name: '选手', schoolName: '测试单位', event: '集体武术操',
      groupTeam: '', grade: 'C组', ageGroup: 'C组', gender: 'female', athleteNumber: 'AT-existing' } };
  render(props);
  await effects[0]();
  let form = render(props);
  const team = elements(form).find(element => element.props.name === 'groupTeam');
  assert.equal(team.props.required, false);
  elements(form).find(element => element.props.onReady).props.onReady(true);
  form = render(props);
  await elements(form).find(element => element.props.children === '保存修改').props.onClick();
  assert.equal(saved, true);
  assert.equal(updates.length, 1);
  assert.equal(updates[0][2].groupTeam, '');
  assert.equal(updates[0][2].athleteNumber, 'AT-existing');
});

test('new collective registrations still require a team number', async () => {
  states = [];
  render({ open: true, competitionId: 'competition' });
  await effects[0]();
  states = states.map(value => value && typeof value === 'object' && Object.hasOwn(value, 'groupTeam')
    ? { ...value, event: '集体武术操', grade: 'C组', gender: 'female' } : value);
  const form = render({ open: true, competitionId: 'competition' });
  assert.equal(elements(form).find(element => element.props.name === 'groupTeam').props.required, true);
});

test('管理员编辑蹦床报名使用简洁组别与项目名称，并隐藏队伍编号', async () => {
  const previous = testCompetition;
  try {
    testCompetition = { sportType: 'trampoline', events: [{ name: '小网幼儿组蹦床操', category: '小网', ageGroups: ['小网幼儿组'], isGroupEvent: true }] };
    states = [];
    const props = { open: true, competitionId: 'competition', editData: {
      _id: 'entry', event: '小网幼儿组蹦床操', grade: '小网幼儿组', gender: 'male', name: '选手'
    } };
    render(props); await effects[0]();
    const nodes = elements(render(props));
    assert.equal(nodes.find(e => e.props.value === '小网幼儿组' && e.props.children === '幼儿组')?.props.children, '幼儿组');
    const option = nodes.find(e => e.props.value === '小网幼儿组蹦床操' && e.props.children?.[0] === '蹦床操');
    assert.equal(option?.props.children[0], '蹦床操');
    assert.ok(!nodes.some(e => e.props.name === 'groupTeam'));
  } finally { testCompetition = previous; }
});
