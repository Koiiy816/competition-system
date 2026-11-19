const assert = require('node:assert/strict');
const test = require('node:test');
const Competition = require('../models/Competition');
const { getParticipantScheduleGroup, mergeUndersizedAgeGroups } = require('../utils/scheduleGrouping');

const ages = ['A1组', 'A2组', 'B组', 'C组', 'D组'];
const event = { name: '陈氏太极单刀23式', category: '个人项目', ageGroups: ages };
const competition = awardRules => ({ ageGroups: ages.map(name => ({ name })), events: [event], awardRules });
const entrants = sizes => Object.fromEntries(sizes.map(([ageGroup, count]) => [ageGroup, {
  event: event.name, sourceEvent: event.name, ageGroup, gender: 'female', participants: Array.from({ length: count }, (_, i) => `${ageGroup}-${i}`)
}]));

test('新赛事不默认合组，旧赛事未启用的三人阈值不合组', () => {
  assert.equal(new Competition().awardRules.mergeGroupsBelow, 0);
  for (const rules of [undefined, { enabled: false, mergeGroupsBelow: 3 }, { enabled: true, mergeGroupsBelow: 0 }]) {
    for (const sizes of [[['C组', 11], ['D组', 1]], [['A2组', 1], ['B组', 6]], [['A1组', 1], ['B组', 1], ['C组', 11]]]) {
      const groups = entrants(sizes);
      assert.deepEqual(Object.values(mergeUndersizedAgeGroups(groups, competition(rules)))
        .map(g => [g.ageGroup, g.participants.length]), sizes);
    }
  }
});

test('显式合组按同项目同性别执行，集体项目不参与个人合组', () => {
  const groups = entrants([['C组', 11], ['D组', 1]]);
  groups.male = { ...groups.D组, gender: 'male', participants: ['male'] };
  groups.team = { ...groups.D组, isGroup: true, participants: ['team'] };
  const result = Object.values(mergeUndersizedAgeGroups(groups, competition({ enabled: true, mergeGroupsBelow: 3 })));
  assert.equal(result.find(g => g.gender === 'female' && !g.isGroup).ageGroup, 'C组/D组');
  assert.equal(result.find(g => g.gender === 'male').participants.length, 1);
  assert.equal(result.find(g => g.isGroup).ageGroup, 'D组');
});

test('不限年龄集体项目的不同年龄及男女队员归入同一场次', () => {
  const collective = { name: '陈氏太极拳精要十八式（集体）', isGroupEvent: true, ageGroups: [], genderRestriction: 'both' };
  const c = { events: [collective] };
  const keys = ages.flatMap(ageGroup => ['male', 'female'].map(gender =>
    getParticipantScheduleGroup({ event: collective.name, ageGroup, gender }, c).key));
  assert.equal(new Set(keys).size, 1);
  assert.equal(keys[0], `${collective.name}|混合集体|mixed`);
});

test('有年龄限制的集体保留年龄组；限定男女的集体不强制变成混合', () => {
  const name = '集体拳';
  const p = { event: name, ageGroup: 'B组', gender: 'female' };
  const eventConfig = { name, isGroupEvent: true, ageGroups: ['B组', 'C组'], genderRestriction: 'both' };
  assert.equal(getParticipantScheduleGroup(p, { events: [eventConfig] }).ageGroup, '混合集体 B组');
  const female = getParticipantScheduleGroup(p, { events: [{ ...eventConfig, ageGroups: [], genderRestriction: 'female' }] });
  assert.equal(female.gender, 'female');
  assert.equal(female.ageGroup, '集体');
});

test('兼容旧集体名称，人工分组仍能使用原项目的年龄配置', () => {
  const c = { events: [{ name: '集体混合', isGroupEvent: true, ageGroups: [], genderRestriction: 'both' }] };
  const group = getParticipantScheduleGroup({ event: '集体混合', manualEventGroup: '自定义集体', ageGroup: 'D组' }, c);
  assert.equal(group.event, '自定义集体');
  assert.equal(group.ageGroup, '混合集体');
  assert.equal(group.isGroup, true);
});
