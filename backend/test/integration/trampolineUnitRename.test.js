const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('../identityFixture');
const { buildTrampolineCompetition } = require('../../data/trampoline2026');
const { getTrampolineUnitQuota, withTrampolineCoachQuota } = require('../../utils/trampolineCoachQuota');

test('蹦床整个单位更名：跨账号、跨项目统一更新，联系人与身份保持，权限、重名和并发受保护', async () => {
  const f = await createFixture();
  try {
    const Competition = require('../../models/Competition');
    const competition = await Competition.create(buildTrampolineCompetition(f.users.admin.id));
    for (const role of ['organization', 'other']) { f.users[role].sportTypes = ['trampoline']; await f.users[role].save(); }
    const api = `/competitions/${competition.id}/participants`;
    const source = '统一更名前单位', target = '统一更名后单位';
    const coaches = [{ name: '甲教练', phone: '100' }, { name: '乙教练', phone: '200' }];
    const leader = { name: '领队', phone: '300' };
    const rows = Array.from({ length: 6 }, (_, i) => ({ name: `更名选手${i}`, idCard: `RENAME-${i}`, birthDate: '2019-01-01', gender: 'male',
      schoolName: source, type: 'individual', event: '大网U8组蹦床个人', ageGroup: '大网U8组', grade: '大网U8组' }));
    const created = await f.request(`${api}/trampoline-batch`, { method: 'POST', body: { participants: rows, staff: { coaches, leader } } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    await f.Participant.updateOne({ _id: created.body.data[1]._id }, { $set: { user: f.users.other.id, schoolName: '统 一 更 名 前 单 位' } });
    await f.Participant.create({ ...rows[0], user: f.users.organization.id, competition: competition.id, event: '另一个项目', additionalInfo: { notes: '保留' } });
    await f.Participant.create({ ...rows[0], name: '已拒绝选手', idCard: 'RENAME-REJECTED', user: f.users.organization.id, competition: competition.id, status: 'rejected' });
    const virtual = await f.Participant.create({ competition: competition.id, name: source, teamName: source, schoolName: source, gender: 'mixed', type: 'team', isVirtualTeam: true });
    const otherUnit = await f.Participant.create({ ...rows[0], name: '其他单位选手', idCard: 'RENAME-OTHER', schoolName: '其他单位', user: f.users.organization.id, competition: competition.id });
    const otherEvent = await f.Participant.create({ ...rows[0], user: f.users.organization.id, competition: f.competition.id });
    const before = await f.Participant.find({ competition: competition.id, _id: { $ne: otherUnit.id } }).lean();
    const rename = (newSchoolName = target, role = 'admin', oldSchoolName = source) => f.request(`${api}/trampoline-unit-name`, {
      role, method: 'PUT', body: { oldSchoolName, newSchoolName }
    });
    const single = await f.request(`${api}/${created.body.data[0]._id}`, { role: 'admin', method: 'PUT', body: { schoolName: target } });
    assert.equal(single.status, 409); // 原故障：逐名移动会留下1名选手关联2名教练。
    assert.equal((await rename(target, 'organization')).status, 403);
    for (const invalid of ['', '甲'.repeat(101), {}, null]) assert.equal((await rename(invalid)).status, 400);
    assert.equal((await rename(target, 'admin', '不存在单位')).status, 404);
    const collision = await rename('其 他 单 位');
    assert.equal(collision.status, 409);
    assert.match(collision.body.message, /已存在.*单位/);
    const wrongSport = await f.request(`/competitions/${f.competition.id}/participants/trampoline-unit-name`, {
      role: 'admin', method: 'PUT', body: { oldSchoolName: source, newSchoolName: target }
    });
    assert.equal(wrongSport.status, 403);
    await withTrampolineCoachQuota(competition, [{ schoolName: target }], [], async () => {
      const busy = await rename();
      assert.equal(busy.status, 409);
      assert.match(busy.body.message, /正在提交/);
    });
    assert.equal(await f.Participant.countDocuments({ competition: competition.id, schoolName: target }), 0);
    await f.Participant.updateOne({ _id: created.body.data[0]._id }, { $push: { 'additionalInfo.trampolineStaff.coaches': { name: '第三名教练' } } });
    const overQuota = await rename();
    assert.equal(overQuota.status, 409);
    assert.match(overQuota.body.message, /最多可报2名教练.*累计3名教练/);
    assert.equal(await f.Participant.countDocuments({ competition: competition.id, schoolName: target }), 0);
    await f.Participant.updateOne({ _id: created.body.data[0]._id }, { $set: { 'additionalInfo.trampolineStaff.coaches': coaches } });
    const result = await rename();
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.data.registrationCount, before.filter(row => !row.isVirtualTeam).length);
    assert.equal(result.body.data.athleteCount, 6);
    assert.equal(result.body.data.coachCount, 2);
    const after = await f.Participant.find({ _id: { $in: before.map(row => row._id) } }).lean();
    for (const row of after) {
      const previous = before.find(item => String(item._id) === String(row._id));
      assert.equal(row.schoolName, target);
      for (const key of ['name', 'idCard', 'gender', 'birthDate', 'user', 'event', 'status', 'athleteNumber', 'registrationNumber', 'coach', 'coachPhone', 'teamLeader', 'leaderPhone', 'additionalInfo']) {
        if (row.isVirtualTeam && key === 'name') continue;
        assert.deepEqual(row[key], previous[key], key);
      }
      assert.ok(row.updatedAt > previous.updatedAt);
    }
    assert.equal((await f.Participant.findById(virtual.id)).teamName, target);
    assert.equal((await f.Participant.findById(virtual.id)).name, target);
    assert.equal((await f.Participant.findById(otherUnit.id)).schoolName, '其他单位');
    assert.equal((await f.Participant.findById(otherEvent.id)).schoolName, source);
    assert.equal(getTrampolineUnitQuota(after).error, '');
    const excess = await f.request(`${api}/trampoline-batch`, { method: 'POST', body: { participants: [{ ...rows[0], idCard: 'RENAME-EXCESS', name: '超额选手', schoolName: target }], staff: { coaches: [{ name: '第三名教练' }] } } });
    assert.equal(excess.status, 409);
    assert.equal(await require('../../models/TrampolineRegistrationLock').countDocuments(), 0);
  } finally { await f.close(); }
});

test('单位账号统一更名：整批限制、本人范围、原单位余量和重新审核均受保护', async () => {
  const f = await createFixture();
  try {
    const Competition = require('../../models/Competition'), Setting = require('../../models/SystemSetting');
    const Schedule = require('../../models/Schedule'), Result = require('../../models/Result');
    const competition = await Competition.create(buildTrampolineCompetition(f.users.admin.id));
    f.users.organization.sportTypes = ['trampoline']; await f.users.organization.save();
    const api = `/competitions/${competition.id}/participants`, source = '单位自助原名', target = '单位自助新名';
    const coaches = [{ name: '自助教练甲', phone: '111' }, { name: '自助教练乙', phone: '222' }];
    const rows = Array.from({ length: 6 }, (_, i) => ({ name: `自助选手${i}`, idCard: `SELF-RENAME-${i}`, birthDate: '2019-01-01', gender: 'male',
      schoolName: source, type: 'individual', event: '大网U8组蹦床个人', ageGroup: '大网U8组', grade: '大网U8组' }));
    const created = await f.request(`${api}/trampoline-batch`, { method: 'POST', body: { participants: rows, staff: { coaches, leader: { name: '自助领队', phone: '333' } } } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const ids = created.body.data.map(row => row._id), lastId = ids.at(-1);
    const other = await f.Participant.create({ ...rows[0], name: '他人选手', idCard: 'OTHER-SELF-RENAME', user: f.users.other.id,
      competition: competition.id, coach: coaches[0].name, coachPhone: coaches[0].phone });
    const anotherCompetition = await f.Participant.create({ ...rows[0], user: f.users.organization.id, competition: f.competition.id });
    const rename = (body = {}) => f.request(`${api}/trampoline-unit-name`, { method: 'PUT', body: { oldSchoolName: source, newSchoolName: target, ...body } });
    const blocked = async (status, message) => {
      const response = await rename();
      assert.equal(response.status, status, JSON.stringify(response.body));
      assert.match(response.body.message, message);
      assert.equal(await f.Participant.countDocuments({ _id: { $in: ids }, schoolName: target }), 0);
    };
    await blocked(403, /尚未开启/);
    await Setting.create({ key: 'wushu_registration_edit_enabled', value: true });
    const successfulPermission = await rename({ oldSchoolName: '不存在的他人单位', user: f.users.other.id });
    assert.equal(successfulPermission.status, 404);
    const victimOnly = await f.Participant.create({ ...rows[0], name: '其他账号独有单位选手', idCard: 'SELF-RENAME-VICTIM', schoolName: '其他账号独有单位',
      user: f.users.other.id, competition: competition.id });
    assert.equal((await rename({ oldSchoolName: victimOnly.schoolName, user: f.users.other.id })).status, 404);
    assert.equal((await f.Participant.findById(victimOnly.id)).schoolName, victimOnly.schoolName);
    await Competition.updateOne({ _id: competition.id }, { $set: { registrationDeadline: new Date(Date.now() - 1000) } });
    await blocked(400, /截止/);
    await Competition.updateOne({ _id: competition.id }, { $set: { registrationDeadline: new Date(Date.now() + 86400000), status: 'ongoing' } });
    await blocked(400, /报名阶段/);
    await Competition.updateOne({ _id: competition.id }, { $set: { status: 'registration' } });
    f.users.organization.sportTypes = ['wushu']; await f.users.organization.save();
    await blocked(403, /授权/);
    f.users.organization.sportTypes = ['trampoline']; await f.users.organization.save();
    for (const state of [{ isCheckedIn: true }, { checkInStatus: 'checked' }, { checkInStatus: 'absent' }]) {
      await f.Participant.updateOne({ _id: lastId }, { $set: state });
      await blocked(409, /自助选手5.*比赛流程/);
      await f.Participant.updateOne({ _id: lastId }, { $set: { isCheckedIn: false, checkInStatus: 'not_checked' } });
    }
    const scheduled = await Schedule.create({ competition: competition.id, name: '自助更名测试赛程', location: '测试场馆', startTime: new Date(), endTime: new Date(), participants: [lastId] });
    await blocked(409, /自助选手5.*赛程/);
    await Schedule.deleteOne({ _id: scheduled.id });
    const result = await Result.create({ competition: competition.id, schedule: scheduled.id, participant: lastId, score: 1, submittedBy: f.users.admin.id });
    await blocked(409, /自助选手5.*成绩/);
    await Result.deleteOne({ _id: result.id });
    const virtual = await f.Participant.create({ competition: competition.id, name: source, schoolName: source, gender: 'mixed', isVirtualTeam: true, type: 'team', teamMembers: [lastId] });
    await blocked(409, /自助选手5.*集体队伍/);
    await f.Participant.deleteOne({ _id: virtual.id });
    await f.Participant.updateOne({ _id: other.id }, { $set: { 'additionalInfo.trampolineStaff.coaches': coaches } });
    await blocked(409, /原单位.*最多可报1名教练/);
    await f.Participant.updateOne({ _id: other.id }, { $unset: { additionalInfo: 1 } });
    const rejected = await f.Participant.create({ ...rows[0], name: '已拒绝带教练记录', idCard: 'SELF-RENAME-REJECTED', competition: competition.id,
      user: f.users.organization.id, status: 'rejected', coach: '第三名教练', coachPhone: '444' });
    await blocked(409, /最多可报2名教练.*累计3名教练/);
    await f.Participant.deleteOne({ _id: rejected.id });
    await f.Participant.updateMany({ _id: { $in: ids } }, { $set: { status: 'approved' } });
    const before = await f.Participant.find({ _id: { $in: ids } }).lean();
    const success = await rename({ user: f.users.other.id }); // 客户端不能指定要修改的账号。
    assert.equal(success.status, 200, JSON.stringify(success.body));
    assert.equal(success.body.data.registrationCount, 6);
    assert.match(success.body.message, /重新审核/);
    const after = await f.Participant.find({ _id: { $in: ids } }).lean();
    for (const row of after) {
      const previous = before.find(item => String(item._id) === String(row._id));
      assert.equal(row.schoolName, target);
      assert.equal(row.status, 'pending');
      assert.ok(row.updatedAt > previous.updatedAt);
      for (const key of ['name', 'gender', 'birthDate', 'idCard', 'athleteNumber', 'registrationNumber', 'event', 'user', 'additionalInfo', 'coach', 'coachPhone', 'teamLeader', 'leaderPhone']) assert.deepEqual(row[key], previous[key], key);
    }
    assert.equal((await f.Participant.findById(other.id)).schoolName, source);
    assert.equal((await f.Participant.findById(anotherCompetition.id)).schoolName, source);
    assert.equal(await require('../../models/TrampolineRegistrationLock').countDocuments(), 0);
  } finally { await f.close(); }
});
