const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('../identityFixture');
const { buildTrampolineCompetition } = require('../../data/trampoline2026');

test('真实接口：仅大网保存两套动作，各套D自动带入且可修改，分别确认后汇总', async () => {
  const f = await createFixture();
  try {
    const Competition = require('../../models/Competition');
    const Schedule = require('../../models/Schedule');
    const Result = require('../../models/Result');
    f.users.organization.sportTypes = ['trampoline']; await f.users.organization.save();
    const c = await Competition.create(buildTrampolineCompetition(f.users.admin._id));
    const p = await f.Participant.create({ competition: c.id, user: f.users.organization.id,
      name: '两套验证', event: c.events[2].name, ageGroup: '大网U8组', type: 'individual',
      gender: 'male', schoolName: '测试单位', checkInStatus: 'checked', isCheckedIn: true });
    const path = `/competitions/${c.id}/participants/${p.id}/trampoline-plan`;
    const routines = [0.3, 0.5].map(difficulty => ({ actions: Array.from({ length: 10 }, () => ({ actionCode: '30', posture: 'o', difficulty })) }));
    assert.equal((await f.request(path, { role: 'admin', method: 'PUT', body: { actions: routines[0].actions } })).status, 400);
    assert.equal((await f.request(path, { method: 'PUT', body: { routines } })).status, 403);
    assert.equal((await f.request(path, { role: 'other', method: 'PUT', body: { routines } })).status, 403);
    for (const role of ['referee', 'chief_referee']) {
      f.users.other.roles = [role]; await f.users.other.save();
      assert.equal((await f.request(path, { role: 'other', method: 'PUT', body: { routines } })).status, 403);
    }
    const saved = await f.request(path, { role: 'admin', method: 'PUT', body: { routines } });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(saved.body.data.additionalInfo.trampolinePlan.routines.map(r => [r.name, r.totalDifficulty]), [['蹦床1', 3], ['蹦床2', 5]]);
    for (const event of ['小网U7组男子蹦床个人', '小网小学组蹦床操']) {
      await f.Participant.updateOne({ _id: p.id }, { event });
      assert.equal((await f.request(path, { role: 'admin', method: 'PUT', body: { routines } })).status, 400);
    }
    await f.Participant.updateOne({ _id: p.id }, { event: c.events[2].name });
    const s = await Schedule.create({ competition: c.id, name: c.events[2].name, participants: [p.id],
      startTime: c.startDate, endTime: c.endDate, location: c.location, judgeCount: 7 });
    const scorePath = `/competitions/${c.id}/results/submit`;
    const send = (routineIndex, scores, role = 'admin', extra = {}) => f.request(scorePath, { role, method: 'POST', body: { scheduleId: s.id, participantId: p.id, routineIndex, scores, deduction: 0.5, ...extra } });
    assert.equal((await send(undefined, [1, 2, 3, 4, 5, 6, 7])).status, 400);
    assert.equal((await send(2, [1, 2, 3, 4, 5, 6, 7])).status, 400);
    const first = await send(0, [6, 9, 8, 7, null, 10, 9]);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.data.details.routines[0].scores[4], 3);
    assert.equal(first.body.data.status, 'pending');
    const second = await send(1, [8, 8, 8, 8, null, 12, 9]);
    assert.equal(second.body.data.details.routines[1].scores[4], 5);
    assert.equal(second.body.data.score, 30);
    assert.equal(second.body.data.status, 'verified');
    const overridden = await send(1, [8, 8, 8, 8, 4.1, 12, 9]);
    assert.equal(overridden.body.data.details.routines[1].scores[4], 4.1);
    assert.equal(overridden.body.data.details.routines[0].scores[4], 3);
    f.users.other.roles = ['referee']; f.users.other.name = 'E1'; await f.users.other.save();
    const forged = await send(0, [7, 99, 99, 99, 99, 99, 99], 'other');
    assert.deepEqual(forged.body.data.details.routines[0].scores, [7, 9, 8, 7, 3, 10, 9]);
    assert.equal(forged.body.data.details.routines[1].scores[4], 4.1);
    assert.equal(forged.body.data.status, 'pending');
    f.users.other.name = 'D1'; await f.users.other.save();
    const difficultyJudge = await send(0, [99, 99, 99, 99, 2.9, 99, 99], 'other');
    assert.deepEqual(difficultyJudge.body.data.details.routines[0].scores, [7, 9, 8, 7, 2.9, 10, 9]);
    // 两套更新共用选手锁，不能互相覆盖另一套已录入的数据。
    const concurrent = await Promise.all([send(0, [6, 9, 8, 7, 3, 10, 9]), send(1, [8, 8, 8, 8, 4.1, 12, 9])]);
    assert.ok(concurrent.every(r => r.status === 200));
    const stored = await Result.findOne({ participant: p.id, schedule: s.id });
    assert.deepEqual(stored.details.routines.map(r => r.scores[4]), [3, 4.1]);
    assert.equal(stored.status, 'verified');
    const read = await f.request(`/competitions/${c.id}/schedules/${s.id}`, { role: 'admin' });
    assert.equal(read.body.data.participants[0].additionalInfo.trampolinePlan.routines.length, 2);
    const legacy = { scoringType: 'large', scores: [9, 9, 9, 9, 3, 10, 9], deduction: 0 };
    await Result.updateOne({ _id: stored.id }, { details: legacy, score: 18 });
    const migrated = await send(0, [6, 9, 8, 7, 3, 10, 9]);
    assert.deepEqual(migrated.body.data.details.legacySingleRoutine, legacy);
    assert.equal(migrated.body.data.details.routines[1], null);
    assert.equal(migrated.body.data.status, 'pending');
    await f.Participant.updateOne({ _id: p.id }, { checkInStatus: 'absent', isCheckedIn: false });
    const absent = await send(1, [null, null, null, null, null, null, null]);
    assert.equal(absent.body.data.score, 0);
    assert.equal(absent.body.data.status, 'verified');
    assert.deepEqual(absent.body.data.details.routines.map(r => r.score), [0, 0]);
  } finally { await f.close(); }
});
