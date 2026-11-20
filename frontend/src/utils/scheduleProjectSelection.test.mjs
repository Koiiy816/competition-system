import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Module, createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { transformWithEsbuild } from 'vite';

const filename = fileURLToPath(new URL('../pages/CompetitionScheduleManagementPage.jsx', import.meta.url));
const source = fs.readFileSync(filename, 'utf8');
const pageSource = source.slice(source.indexOf('const CompetitionScheduleManagementPage ='));
const stateNames = [...pageSource.matchAll(/const \[(\w+),\s*\w+\] = useState\(/g)].map(match => match[1]);
const competition = { _id: 'competition', name: '全选验收', sportType: 'wushu', startDate: '2026-11-29' };
const candidates = [
  { _id: 'a1', name: '甲一', schoolName: '甲单位', groupTeam: '1队', ageGroup: 'B组', event: '集体拳' },
  { _id: 'a2', name: '甲二', schoolName: '甲单位', groupTeam: '1队', ageGroup: 'C组', event: '集体拳' },
  { _id: 'a3', name: '甲三', schoolName: '甲单位', groupTeam: '2队', ageGroup: 'C组', event: '集体拳' },
  { _id: 'b1', name: '乙一', schoolName: '乙单位', groupTeam: '1队', ageGroup: 'B组', event: '集体剑' }
];
let state;
let cursor;
let request;
let candidateReads;
const compiled = new Module(filename);
compiled.filename = filename;
compiled.paths = createRequire(import.meta.url).resolve.paths('react');
const originalRequire = compiled.require.bind(compiled);
compiled.require = spec => {
  if (spec === 'react') return { ...React,
    useEffect: () => {}, useRef: () => ({ current: null }), useCallback: fn => fn,
    useState: initial => {
      const name = stateNames[cursor++];
      if (!Object.hasOwn(state, name)) state[name] = typeof initial === 'function' ? initial() : initial;
      return [state[name], value => { state[name] = typeof value === 'function' ? value(state[name]) : value; }];
    }
  };
  if (spec === 'react-router-dom') return { useParams: () => ({ id: competition._id }), useNavigate: () => () => {} };
  if (spec.includes('AuthContext')) return { useAuth: () => ({ user: { roles: ['admin'] } }) };
  if (spec.includes('/components/')) return () => null;
  if (spec.includes('scheduleService')) return {
    getUnassignedParticipants: async () => { candidateReads++; return { data: candidates }; },
    createSchedule: async (...args) => { request = args; return { data: { name: args[1].name } }; },
    getSchedules: async () => ({ data: [] })
  };
  if (spec.includes('competitionService')) return { getCompetition: async () => ({ data: competition }) };
  if (spec.includes('/services/')) return {};
  return originalRequire(spec);
};
const transformed = await transformWithEsbuild(source, filename, { loader: 'jsx', format: 'cjs' });
compiled._compile(transformed.code, filename);

const nodes = element => Array.isArray(element) ? element.flatMap(nodes) : !element?.props ? [] : [element, ...nodes(element.props.children)];
const text = element => Array.isArray(element) ? element.map(text).join('') : element?.props ? text(element.props.children) : typeof element === 'string' || typeof element === 'number' ? String(element) : '';
const render = () => { cursor = 0; return nodes(compiled.exports.default()); };
const button = label => render().find(node => node.props.onClick && text(node) === label);
const header = () => render().find(node => node.props.inputProps?.['aria-label']?.startsWith('全选'));
const search = value => render().find(node => node.props.label?.startsWith?.('搜索姓名')).props.onChange({ target: { value } });
const selectedCount = () => render().find(node => /^已选择 \d+ 名/.test(text(node)) && node.props.variant === 'body2');
const setup = (overrides = {}) => {
  state = { loading: false, competition, createProjectOpen: true, projectCandidates: candidates, ...overrides };
  request = undefined;
  candidateReads = 0;
  render();
};

test('一键全选与取消全选更新全部行、表头状态及人数，部分选中时不重复添加', () => {
  setup({ selectedProjectParticipantIds: ['a1'] });
  assert.equal(header().props.indeterminate, true);
  button('一键全选（4 名）').props.onClick();
  assert.deepEqual(state.selectedProjectParticipantIds, ['a1', 'a2', 'a3', 'b1']);
  assert.equal(header().props.checked, true);
  assert.equal(header().props.indeterminate, false);
  assert.equal(text(selectedCount()), '已选择 4 名选手');
  button('取消全选（4 名）').props.onClick();
  assert.deepEqual(state.selectedProjectParticipantIds, []);
  assert.equal(header().props.checked, false);
  assert.equal(text(selectedCount()), '已选择 0 名选手');
});

test('搜索后只全选匹配结果，取消该范围时保留范围之外的选手', () => {
  setup({ selectedProjectParticipantIds: ['b1'] });
  search('甲单位');
  button('全选搜索结果（3 名）').props.onClick();
  assert.deepEqual(state.selectedProjectParticipantIds, ['b1', 'a1', 'a2', 'a3']);
  button('取消全选（3 名）').props.onClick();
  assert.deepEqual(state.selectedProjectParticipantIds, ['b1']);
  search('');
  assert.equal(text(selectedCount()), '已选择 1 名选手');
  assert.equal(header().props.indeterminate, true);
});

test('表头复选框支持全选和取消，姓名、队号、组别、项目筛选使用当前结果', () => {
  for (const [keyword, expected] of [['甲一', ['a1']], ['2队', ['a3']], ['B组', ['a1', 'b1']], ['集体剑', ['b1']]]) {
    setup();
    search(keyword);
    header().props.onChange();
    assert.deepEqual(state.selectedProjectParticipantIds, expected);
    assert.equal(header().props.checked, true);
    header().props.onChange();
    assert.deepEqual(state.selectedProjectParticipantIds, []);
  }
});

test('没有匹配结果时禁用两个全选入口，并保留之前选中的选手', () => {
  setup({ selectedProjectParticipantIds: ['b1'] });
  search('不存在的选手');
  assert.equal(button('全选搜索结果（0 名）').props.disabled, true);
  assert.equal(header().props.disabled, true);
  assert.equal(header().props.checked, false);
  assert.equal(header().props.indeterminate, false);
  assert.deepEqual(state.selectedProjectParticipantIds, ['b1']);
});

test('读取名单中或正在创建时禁用批量选择入口', () => {
  for (const overrides of [{ projectCandidatesLoading: true }, { projectCreating: true }]) {
    setup(overrides);
    assert.equal(button('一键全选（4 名）').props.disabled, true);
    if (!overrides.projectCandidatesLoading) assert.equal(header().props.disabled, true);
  }
});

test('关闭后重新打开弹窗会清空筛选和选择并重新读取未编排名单', async () => {
  setup({ selectedProjectParticipantIds: ['a1'], projectCandidateSearch: '甲单位' });
  button('取消').props.onClick();
  assert.equal(state.createProjectOpen, false);
  await button('新建比赛项目').props.onClick();
  assert.equal(state.createProjectOpen, true);
  assert.equal(state.projectCandidateSearch, '');
  assert.deepEqual(state.selectedProjectParticipantIds, []);
  assert.equal(candidateReads, 1);
  assert.equal(header().props.checked, false);
});

test('个人项目全选后提交全部且无重复的选手 ID，成功后关闭弹窗', async () => {
  setup();
  button('一键全选（4 名）').props.onClick();
  render().find(node => node.props.label === '比赛项目名称').props.onChange({ target: { value: '全选个人验收' } });
  render().find(node => node.props.label === '比赛日期').props.onChange({ target: { value: '2026-11-29' } });
  await button('建立并加入 4 名选手').props.onClick();
  assert.equal(request[0], competition._id);
  assert.deepEqual(request[1].participants, ['a1', 'a2', 'a3', 'b1']);
  assert.equal(request[1].eventMode, 'individual');
  assert.equal(state.createProjectOpen, false);
  assert.match(state.success, /加入 4 名选手/);
});

test('武术集体项目全选提交按单位和队号组成三队，保留每名队员', async () => {
  setup();
  render().find(node => node.props.label === '项目类型').props.onChange({ target: { value: 'collective' } });
  button('一键全选（4 名）').props.onClick();
  assert.equal(text(selectedCount()), '已选择 4 名队员');
  render().find(node => node.props.label === '比赛项目名称').props.onChange({ target: { value: '全选集体验收' } });
  render().find(node => node.props.label === '比赛日期').props.onChange({ target: { value: '2026-11-29' } });
  await button('建立集体项目并加入 4 名队员').props.onClick();
  assert.deepEqual(request[1].participants, []);
  assert.deepEqual(request[1].collectiveTeams.map(team => [team.schoolName, team.groupTeam, team.memberIds]), [
    ['甲单位', '1队', ['a1', 'a2']], ['甲单位', '2队', ['a3']], ['乙单位', '1队', ['b1']]
  ]);
  assert.equal(state.createProjectOpen, false);
  assert.match(state.success, /组成 3 支集体队伍、加入 4 名队员/);
});
