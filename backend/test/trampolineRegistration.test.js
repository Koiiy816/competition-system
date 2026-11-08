const test = require('node:test');
const assert = require('node:assert/strict');
const Competition = require('../models/Competition');
const { buildTrampolineCompetition } = require('../data/trampoline2026');
const { validateTrampolineRegistration } = require('../utils/trampolineRegistration');
const { canUserAccessCompetitionType } = require('../utils/competitionType');
const competition = buildTrampolineCompetition('507f1f77bcf86cd799439011');
const body = (event, birthDate, extra = {}) => ({ event: event.name, ageGroup: event.ageGroups[0], birthDate,
  type: 'individual', gender: event.genderRestriction === 'female' ? 'female' : 'male', schoolName: '测试俱乐部', ...extra });

test('规程配置正好17项：大网3项、小网12项个人和2项团体，无动作代码要求', async () => {
  await new Competition(competition).validate();
  assert.equal(competition.events.length, 17);
  assert.equal(new Set(competition.events.map(e => e.name)).size, 17);
  assert.equal(competition.events.filter(e => e.category === '大网').length, 3);
  assert.equal(competition.events.filter(e => e.category === '小网').length, 14);
  assert.deepEqual(competition.events.filter(e => e.isGroupEvent).map(e => e.name), ['小网小学组蹦床操', '小网幼儿组蹦床操']);
  assert.ok(competition.events.every(e => !e.registrationDetail.required));
  assert.equal(competition.registrationFee, 0);
});

for (const event of competition.events) {
  const group = competition.ageGroups.find(g => g.name === event.ageGroups[0]);
  test(`${event.name} 出生日期起止边界、越界和错误组别`, () => {
    assert.equal(validateTrampolineRegistration(competition, body(event, group.birthDateStart)), null);
    const before = new Date(group.birthDateStart); before.setUTCDate(before.getUTCDate() - 1);
    assert.match(validateTrampolineRegistration(competition, body(event, before.toISOString())), /出生日期/);
    if (group.birthDateEnd) {
      assert.equal(validateTrampolineRegistration(competition, body(event, group.birthDateEnd)), null);
      const after = new Date(group.birthDateEnd); after.setUTCDate(after.getUTCDate() + 1);
      assert.match(validateTrampolineRegistration(competition, body(event, after.toISOString())), /出生日期/);
    }
    assert.match(validateTrampolineRegistration(competition, body(event, group.birthDateStart, { ageGroup: '不存在的组别' })), /年龄组别/);
    if (event.genderRestriction !== 'both') assert.match(validateTrampolineRegistration(competition,
      body(event, group.birthDateStart, { gender: event.genderRestriction === 'male' ? 'female' : 'male' })), /性别/);
  });
}

test('2019年选手可同时报大网U8、小网U7、小学与幼儿蹦床操', () => {
  const matched = competition.events.filter(e => validateTrampolineRegistration(competition, body(e, '2019-06-01')) === null);
  assert.equal(matched.length, 5); // 小网个人男女项目各一项，这里按每个项目的性别分别验证。
  assert.equal(matched.filter(e => e.isGroupEvent).length, 2);
});

test('拒绝未知项目、无效或未来生日、缺失单位和整队代替队员资料', () => {
  const event = competition.events[0];
  for (const extra of [{ event: '跳水' }, { birthDate: '' }, { birthDate: 'bad' }, { birthDate: '2099-01-01' },
    { schoolName: '' }, { type: 'team' }, { gender: 'mixed' }]) {
    assert.ok(validateTrampolineRegistration(competition, body(event, '2014-01-01', extra)));
  }
});

test('蹦床赛事权限与武术、跳水隔离', () => {
  assert.equal(canUserAccessCompetitionType({ roles: ['organization'], sportTypes: ['trampoline'] }, competition), true);
  for (const type of ['wushu', 'diving']) assert.equal(canUserAccessCompetitionType({ roles: ['organization'], sportTypes: [type] }, competition), false);
});
