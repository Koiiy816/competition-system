import test from 'node:test';
import assert from 'node:assert/strict';
import { toWushuRegistrationRows, createWushuRegistrationPdf, toWushuRegistrationGroups, createWushuGroupedRegistrationPdf } from './wushuRegistrationPdf.js';

const competition = { _id: 'wushu', name: '武术测试赛事' };
const participant = {
  _id: 'entry', competition: { _id: 'wushu' }, name: '陈小明', gender: 'male',
  birthDate: '2010-01-02', idCard: '440301201001020011', schoolName: '测试单位',
  event: '太极拳', ageGroup: '少年组', status: 'pending', registrationNumber: 'CP-2026-123456',
  phone: '13800000000', teamLeader: '领队甲', leaderPhone: '13800000001',
  coach: '教练乙', coachPhone: '13800000002', groupTeam: '1队',
  additionalInfo: { eventDetail: '陈式', notes: '报名备注' }
};

test('roster export retains events and statuses without identity numbers or supplementary rows', () => {
  const rows = toWushuRegistrationRows([
    participant,
    { ...participant, event: '太极剑', status: 'approved' },
    { ...participant, status: 'rejected' }
  ], competition);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].cells[5], '太极拳 / 陈式');
  assert.deepEqual(rows.map(row => row.cells[8]), ['待审核', '已通过', '已拒绝']);
  for (const value of ['测试单位', '少年组', '1队']) {
    assert.ok(rows[0].cells.includes(value));
  }
  assert.equal(rows[0].cells.length, 9);
  for (const row of rows) assert.equal(Object.hasOwn(row, 'details'), false);
  for (const value of ['440301201001020011', '领队甲', '13800000001', '教练乙', '13800000002', '报名备注', 'CP-2026-123456']) {
    assert.ok(!JSON.stringify(rows).includes(value));
  }
});

test('export excludes virtual teams and other competitions, supports unpopulated competition IDs', () => {
  const rows = toWushuRegistrationRows([
    { ...participant, competition: 'wushu' },
    { ...participant, competition: 'other' },
    { ...participant, isVirtualTeam: true }
  ], competition);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cells[0], '1');
});

test('missing optional data is printable and empty exports fail clearly', async () => {
  const [row] = toWushuRegistrationRows([{ competition: 'wushu', name: '选手' }], competition);
  assert.ok(!JSON.stringify(row).includes('undefined'));
  await assert.rejects(createWushuRegistrationPdf([], competition), /没有可导出的报名记录/);
});

test('grouped export preserves displayed group order, titles, members and table fields', () => {
  const groups = [
    { displayName: '集体武术操 - 测试单位', ageGroup: '少年组', schoolName: '测试单位',
      participants: [{ ...participant, type: 'team', teamName: '测试一队', event: '武术操', isGroupEvent: true }] },
    { event: '太极拳', participants: [participant, { ...participant, name: '另一选手', status: 'approved' }] }
  ];
  const sections = toWushuRegistrationGroups(groups, competition);
  assert.equal(sections.length, 2);
  assert.match(sections[0].title, /^集体武术操 - 测试单位/);
  assert.match(sections[0].title, /少年组/);
  assert.match(sections[0].title, /人数：1/);
  assert.deepEqual(sections[0].rows[0].cells.slice(0, 7), ['测试一队', '测试单位', '男', '少年组', '集体', '待审核', '报名备注']);
  assert.equal(sections[0].rows[0].cells.length, 8);
  assert.deepEqual(sections[1].rows.map(row => row.cells[0]), ['陈小明', '另一选手']);
  assert.equal(sections[1].rows[0].cells[4], '个人');
  assert.ok(!JSON.stringify(sections).includes(participant.idCard));
});

test('grouped export uses only supplied filtered groups and configured collective type', async () => {
  const sections = toWushuRegistrationGroups([{ event: '拳术', participants: [participant] }],
    { ...competition, events: [{ name: participant.event, isGroupEvent: true }] });
  assert.equal(sections[0].rows.length, 1);
  assert.equal(sections[0].rows[0].cells[4], '集体');
  await assert.rejects(createWushuGroupedRegistrationPdf([], competition), /没有可导出的报名记录/);
});
