const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('../identityFixture');
const { buildTrampolineCompetition } = require('../../data/trampoline2026');

test('蹦床同步兼容旧标题、追加新报名、分组组队、新建待编排且重复执行不重复添加', async () => {
  const f = await createFixture();
  try {
    const Competition = require('../../models/Competition');
    const Schedule = require('../../models/Schedule');
    const c = await Competition.create(buildTrampolineCompetition(f.users.admin._id));
    const add = (name, event, ageGroup, extra = {}) => f.Participant.create({
      competition: c.id, user: f.users.organization._id, name, schoolName: '单位甲', gender: 'male',
      type: 'individual', event, ageGroup, grade: ageGroup, status: 'approved', ...extra
    });
    const old = await add('原选手', '大网U8组蹦床个人', '大网U8组');
    const oldMember = await add('原队员', '小网小学组蹦床操', '小网小学组');
    const oldTeam = await f.Participant.create({ competition: c.id, name: '单位甲', schoolName: '单位甲',
      event: oldMember.event, ageGroup: oldMember.ageGroup, gender: 'mixed', type: 'team',
      isVirtualTeam: true, teamMembers: [oldMember.id], status: 'approved' });
    const base = { competition: c.id, startTime: c.startDate, endTime: c.endDate, location: c.location,
      scheduleDate: '2026-12-06', timeSlot: '上午', court: '一号场地', order: 8 };
    const large = await Schedule.create({ ...base, name: '大网U8组 男子 大网U8组蹦床个人', participants: [old.id, new f.mongoose.Types.ObjectId()], judgeCount: 7 });
    const collective = await Schedule.create({ ...base, name: '混合集体 小网小学组 小网小学组蹦床操', participants: [oldTeam.id], judgeCount: 2 });
    const small = await Schedule.create({ ...base, name: '小网U8组 小网U8组男子蹦床个人', participants: [] });
    const newLarge = await add('新大网', old.event, old.ageGroup);
    const newSmall = await add('新小网', '小网U8组男子蹦床个人', '小网U8组');
    const u5 = await add('新U5', '小网U5组男子蹦床个人', '小网U5组');
    const member = await add('同单位新队员', oldMember.event, oldMember.ageGroup, { gender: 'female' });
    const anotherUnit = await add('其他单位队员', oldMember.event, oldMember.ageGroup, { schoolName: '单位乙' });
    const child1 = await add('幼儿甲', '小网幼儿组蹦床操', '小网幼儿组');
    const child2 = await add('幼儿乙', child1.event, child1.ageGroup, { gender: 'female' });
    const female = await add('女子小网', '小网U8组女子蹦床个人', '小网U8组', { gender: 'female' });
    const pending = await add('待审核', u5.event, u5.ageGroup, { status: 'pending' });
    const rejected = await add('已拒绝', u5.event, u5.ageGroup, { status: 'rejected' });
    const Result = require('../../models/Result');
    const result = await Result.create({ competition: c.id, schedule: large.id, participant: old.id,
      score: 15, submittedBy: f.users.admin._id, status: 'verified' });
    const sync = () => f.request(`/competitions/${c.id}/schedules/sync-new`, { role: 'admin', method: 'POST', body: {} });
    const response = await sync();
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.appendedCount, 8);
    assert.equal(response.body.data.createdScheduleCount, 3);
    const updatedLarge = await Schedule.findById(large.id);
    assert.deepEqual(updatedLarge.participants.map(String), [old.id, newLarge.id]);
    for (const field of ['scheduleDate', 'timeSlot', 'court', 'order']) assert.equal(updatedLarge[field], base[field]);
    assert.deepEqual((await Schedule.findById(small.id)).participants.map(String), [newSmall.id]);
    assert.deepEqual((await f.Participant.findById(oldTeam.id)).teamMembers.map(String), [oldMember.id, member.id]);
    const teamSchedule = await Schedule.findById(collective.id).populate('participants');
    assert.equal(teamSchedule.participants.length, 2);
    assert.equal(teamSchedule.participants[1].schoolName, '单位乙');
    assert.deepEqual(teamSchedule.participants[1].teamMembers.map(String), [anotherUnit.id]);
    const kindergarten = await Schedule.findOne({ competition: c.id, name: '幼儿组 蹦床操' }).populate('participants');
    assert.equal(kindergarten.participants.length, 1);
    assert.deepEqual(kindergarten.participants[0].teamMembers.map(String), [child1.id, child2.id]);
    for (const name of ['U5组 小网男子个人', '幼儿组 蹦床操', 'U8组 小网女子个人']) {
      const schedule = await Schedule.findOne({ competition: c.id, name });
      assert.ok(schedule, name);
      assert.ok(!schedule.scheduleDate && !schedule.timeSlot && !schedule.court);
      assert.equal(schedule.judgeCount, 2);
    }
    const all = await Schedule.find({ competition: c.id });
    const ids = all.flatMap(s => s.participants.map(String));
    assert.ok(!ids.includes(pending.id) && !ids.includes(rejected.id));
    assert.ok(ids.includes(female.id) && ids.includes(u5.id));
    const second = await sync();
    assert.equal(second.body.data.appendedCount, 0);
    assert.equal(second.body.data.createdScheduleCount, 0);
    assert.equal(await Schedule.countDocuments({ competition: c.id }), 6);
    assert.equal(await f.Participant.countDocuments({ competition: c.id, isVirtualTeam: true }), 3);
    assert.equal((await Result.findById(result.id)).score, 15);
    assert.equal((await Result.findById(result.id)).status, 'verified');
    const oldCount = updatedLarge.participants.length;
    await Schedule.updateOne({ _id: large.id }, { $set: { status: 'completed' } });
    await add('结束后新增', old.event, old.ageGroup);
    const closed = await sync();
    assert.equal(closed.body.data.appendedCount, 0);
    assert.equal(closed.body.data.unmatchedCount, 1);
    assert.equal((await Schedule.findById(large.id)).participants.length, oldCount);
  } finally { await f.close(); }
});

test('蹦床首次随机生成不纳入待审核及拒绝报名', async () => {
  const f = await createFixture();
  try {
    const Competition = require('../../models/Competition');
    const Schedule = require('../../models/Schedule');
    const c = await Competition.create(buildTrampolineCompetition(f.users.admin._id));
    for (const status of ['approved', 'pending', 'rejected']) await f.Participant.create({ competition: c.id,
      user: f.users.organization._id, name: status, schoolName: '单位', type: 'individual', gender: 'male',
      event: c.events[2].name, ageGroup: c.events[2].ageGroups[0], status });
    const response = await f.request(`/competitions/${c.id}/schedules/generate-start-list`, { role: 'admin', method: 'POST', body: {} });
    assert.equal(response.status, 200);
    const schedules = await Schedule.find({ competition: c.id }).populate('participants');
    assert.equal(schedules.length, 1);
    assert.deepEqual(schedules[0].participants.map(p => p.status), ['approved']);
  } finally { await f.close(); }
});

test('蹦床首次同步仅编排已通过报名，武术赛事仍不自动建立日程', async () => {
  const f = await createFixture();
  try {
    const Competition = require('../../models/Competition');
    const Schedule = require('../../models/Schedule');
    const c = await Competition.create(buildTrampolineCompetition(f.users.admin._id));
    for (const status of ['approved', 'pending', 'rejected']) await f.Participant.create({ competition: c.id,
      user: f.users.organization._id, name: status, schoolName: '单位', type: 'individual', gender: 'male',
      event: c.events[2].name, ageGroup: c.events[2].ageGroups[0], status });
    const response = await f.request(`/competitions/${c.id}/schedules/sync-new`, { role: 'admin', method: 'POST', body: {} });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.appendedCount, 1);
    const schedules = await Schedule.find({ competition: c.id });
    assert.equal(schedules.length, 1);
    assert.equal(schedules[0].judgeCount, 7);
    const wushu = await f.request(`/competitions/${f.competition.id}/schedules/sync-new`, { role: 'admin', method: 'POST', body: {} });
    assert.equal(wushu.status, 400);
    assert.equal(await Schedule.countDocuments({ competition: f.competition.id }), 0);
  } finally { await f.close(); }
});
