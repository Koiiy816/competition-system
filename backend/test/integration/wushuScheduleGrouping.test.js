const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('../identityFixture');

test('武术编排按赛事规则分组，预览与实际赛程一致', async (t) => {
  const f = await createFixture();
  const Competition = require('../../models/Competition');
  const Schedule = require('../../models/Schedule');
  const ages = ['A1组', 'A2组', 'B组', 'C组', 'D组'];
  const individual = { name: '陈氏太极单刀23式', category: '个人项目', ageGroups: ages };
  const collective = { name: '陈氏太极拳精要十八式（集体）', category: '集体项目',
    isGroupEvent: true, genderRestriction: 'both', ageGroups: [] };
  const competition = (overrides = {}) => Competition.create({
    name: '正雷杯编排回归测试', description: '独立测试数据库', type: '武术', sportType: 'wushu',
    organizer: f.users.admin.id, startDate: '2026-11-29', endDate: '2026-11-29',
    registrationDeadline: '2026-11-17', location: '测试场馆', status: 'registration',
    ageGroups: ages.map(name => ({ name })), events: [individual, collective], ...overrides
  });
  const add = (c, ageGroup, extra = {}) => f.Participant.create({
    competition: c.id, user: f.users.organization.id, type: 'individual', name: '测试选手',
    schoolName: '单位甲', event: individual.name, ageGroup, gender: 'female', status: 'approved', ...extra
  });
  const generate = c => f.request(`/competitions/${c.id}/schedules/generate-start-list?overwrite=true`,
    { role: 'admin', method: 'POST', body: {} });
  const preview = c => f.request(`/competitions/${c.id}/schedules/group-preview`, { role: 'admin' });
  try {
    await t.test('新赛事默认不合组；旧赛事未启用的默认三人阈值也不生效', async () => {
      assert.equal(new Competition().awardRules.mergeGroupsBelow, 0);
      for (const awardRules of [undefined, { enabled: false, mergeGroupsBelow: 3 }]) {
        const c = await competition(awardRules ? { awardRules } : {});
        await add(c, 'C组');
        await add(c, 'D组');
        const response = await generate(c);
        assert.equal(response.status, 200, JSON.stringify(response.body));
        const schedules = await Schedule.find({ competition: c.id });
        assert.deepEqual(schedules.map(s => s.name).sort(),
          ['C组 女子 陈氏太极单刀23式', 'D组 女子 陈氏太极单刀23式']);
        assert.ok(schedules.every(s => s.participants.length === 1));
      }
    });

    await t.test('不限年龄集体项目完整成队；同单位多支队伍及不同单位不混并', async () => {
      const c = await competition();
      const members = [];
      for (let i = 0; i < 6; i++) members.push(await add(c, ages[i % ages.length], {
        event: collective.name, groupTeam: '1队', gender: i % 2 ? 'male' : 'female'
      }));
      const second = await add(c, 'D组', { event: collective.name, groupTeam: '2队' });
      const other = await add(c, 'A1组', { event: collective.name, groupTeam: '1队', schoolName: '单位乙' });
      const before = await f.Participant.find({ competition: c.id }).lean();
      const p = await preview(c);
      assert.equal(p.status, 200, JSON.stringify(p.body));
      assert.equal(p.body.data.length, 1);
      assert.equal(p.body.data[0].count, 8);
      assert.equal(await Schedule.countDocuments({ competition: c.id }), 0);
      assert.equal(await f.Participant.countDocuments({ competition: c.id, isVirtualTeam: true }), 0);
      const response = await generate(c);
      assert.equal(response.status, 200, JSON.stringify(response.body));
      const schedules = await Schedule.find({ competition: c.id }).populate('participants');
      assert.equal(schedules.length, 1);
      assert.equal(schedules[0].name, p.body.data[0].name);
      assert.doesNotMatch(schedules[0].name, /A1组|A2组|B组|C组|D组|未知/);
      assert.equal(schedules[0].participants.length, 3);
      const teams = schedules[0].participants;
      assert.deepEqual(teams.find(p => p.schoolName === '单位甲' && p.groupTeam === '1队').teamMembers.map(String).sort(),
        members.map(p => p.id).sort());
      assert.deepEqual(teams.find(p => p.groupTeam === '2队').teamMembers.map(String), [second.id]);
      assert.deepEqual(teams.find(p => p.schoolName === '单位乙').teamMembers.map(String), [other.id]);
      assert.deepEqual(await f.Participant.find({ competition: c.id, isVirtualTeam: { $ne: true } }).lean(), before);
      const ids = schedules[0].participants.map(p => p.id).sort();
      assert.equal((await generate(c)).status, 200);
      const again = await Schedule.findById(schedules[0].id);
      assert.deepEqual(again.participants.map(String).sort(), ids);
      assert.equal(await f.Participant.countDocuments({ competition: c.id, isVirtualTeam: true }), 3);
    });

    await t.test('明确启用的小人数合组保留，并与分组预览一致', async () => {
      const c = await competition({ awardRules: { enabled: true, mergeGroupsBelow: 3 } });
      await add(c, 'C组');
      await add(c, 'D组');
      const p = await preview(c);
      assert.equal(p.status, 200, JSON.stringify(p.body));
      assert.equal((await generate(c)).status, 200);
      const schedules = await Schedule.find({ competition: c.id });
      assert.deepEqual(schedules.map(s => s.name), ['C组/D组 女子 陈氏太极单刀23式']);
      assert.deepEqual(p.body.data.map(g => g.name), schedules.map(s => s.name));
    });

    await t.test('明确按年龄分组的集体项目保持年龄分组', async () => {
      const c = await competition({ events: [{ ...collective, ageGroups: ['B组', 'C组'] }] });
      await add(c, 'B组', { event: collective.name, groupTeam: '1队' });
      await add(c, 'C组', { event: collective.name, groupTeam: '1队' });
      const p = await preview(c);
      assert.equal((await generate(c)).status, 200);
      const schedules = await Schedule.find({ competition: c.id });
      assert.equal(schedules.length, 2);
      assert.deepEqual(p.body.data.map(g => g.name).sort(), schedules.map(s => s.name).sort());
    });

    await t.test('个人项目保留性别和人工项目分组，报名备注不参与分组', async () => {
      const c = await competition();
      await add(c, 'C组', { gender: 'male' });
      await add(c, 'C组', { remark: '不同备注' });
      await add(c, 'C组', { manualEventGroup: '人工分组' });
      const p = await preview(c);
      assert.equal((await generate(c)).status, 200);
      const schedules = await Schedule.find({ competition: c.id });
      assert.equal(schedules.length, 3);
      assert.deepEqual(p.body.data.map(g => g.name).sort(), schedules.map(s => s.name).sort());
    });
  } finally {
    await f.close();
  }
});
