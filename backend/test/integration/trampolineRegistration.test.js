const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('../identityFixture');
const { buildTrampolineCompetition } = require('../../data/trampoline2026');

test('真实HTTP与MongoDB：蹦床跨项目报名、权限、年龄、团体编排和重复导入', async () => {
  const f = await createFixture();
  try {
    const Competition = require('../../models/Competition');
    const Schedule = require('../../models/Schedule');
    f.users.organization.sportTypes = ['trampoline'];
    await f.users.organization.save();
    const competition = await Competition.create(buildTrampolineCompetition(f.users.admin._id));
    const context = await f.request(`/competitions/${competition.id}?fields=score-context`, { role: 'admin' });
    assert.equal(context.status, 200);
    assert.equal(context.body.data.sportType, 'trampoline');
    assert.equal(context.body.data.type, '蹦床');
    const path = `/competitions/${competition.id}/participants`;
    const base = { name: '测试队员甲', schoolName: '测试蹦床俱乐部', gender: 'male', idCard: 'TRAMPOLINE-TEST-001',
      birthDate: '2019-01-01', type: 'individual' };
    const post = body => f.request(path, { method: 'POST', body });
    for (const [event, ageGroup] of [['大网U8组蹦床个人', '大网U8组'], ['小网U7组男子蹦床个人', '小网U7组'],
      ['小网小学组蹦床操', '小网小学组'], ['小网幼儿组蹦床操', '小网幼儿组']]) {
      const response = await post({ ...base, event, ageGroup, grade: ageGroup, groupTeam: '1队' });
      assert.equal(response.status, 201, JSON.stringify(response.body));
    }
    const team = { ...base, event: '小网小学组蹦床操', ageGroup: '小网小学组', grade: '小网小学组', groupTeam: '1队' };
    assert.equal((await post({ ...team, name: '测试队员乙', idCard: 'TRAMPOLINE-TEST-002', gender: 'female' })).status, 201);
    assert.equal((await post({ ...team, name: '测试队员丙', idCard: 'TRAMPOLINE-TEST-003', groupTeam: '2队' })).status, 201);
    for (const extra of [{ birthDate: '2020-01-01' }, { ageGroup: '小网幼儿组' }, { event: '跳水' }, { type: 'team' }]) {
      assert.equal((await post({ ...team, ...extra })).status, 400);
    }
    assert.equal((await f.request(path, { role: 'other', method: 'POST', body: team })).status, 403);
    const listing = await f.request('/competitions?sportType=trampoline');
    assert.equal(listing.status, 200);
    assert.ok(listing.body.data.every(c => c.sportType === 'trampoline'));
    const imported = { ...base, name: '导入选手', idCard: 'TRAMPOLINE-IMPORT', event: '大网U8组蹦床个人', ageGroup: '大网U8组' };
    const importedSecond = { ...imported, event: '小网U7组男子蹦床个人', ageGroup: '小网U7组' };
    const importResponse = await f.request(`${path}/import`, { role: 'admin', method: 'POST', body: { participants: [imported, importedSecond, importedSecond] } });
    assert.equal(importResponse.status, 201, JSON.stringify(importResponse.body));
    assert.equal(importResponse.body.data.imported, 2);
    assert.equal(importResponse.body.data.failed, 1);
    const generated = await f.request(`/competitions/${competition.id}/schedules/generate-start-list`, { role: 'admin', method: 'POST', body: {} });
    assert.equal(generated.status, 200, JSON.stringify(generated.body));
    const teams = await f.Participant.find({ competition: competition.id, isVirtualTeam: true, event: team.event });
    assert.equal(teams.length, 2);
    assert.equal(teams.find(t => t.groupTeam === '1队').teamMembers.length, 2);
    assert.equal(teams.find(t => t.groupTeam === '2队').teamMembers.length, 1);
    assert.equal((await Schedule.find({ competition: competition.id, participants: { $all: teams.map(t => t._id) } })).length, 1);
    const schedules = await Schedule.find({ competition: competition.id });
    assert.ok(schedules.filter(s => s.name.includes('小网')).every(s => s.judgeCount === 2));
    assert.ok(schedules.filter(s => s.name.includes('大网')).every(s => s.judgeCount === 7));
    // 通过真实提交接口验证新计分和评分栏位，覆盖首次提交与后续合并保存。
    f.users.other.roles = ['referee'];
    f.users.other.sportTypes = ['trampoline'];
    for (const [kind, label, values, expected] of [
      ['large', '大网', [6, 9, 8, 7, 2.5, 10, 0], 14.5],
      ['small', '小网U7', [0, 8], 7.5]
    ]) {
      const schedule = schedules.find(item => item.name.includes(label));
      const participantId = String(schedule.participants[0]);
      await f.Participant.updateOne({ _id: participantId }, { checkInStatus: 'checked', isCheckedIn: true });
      const scorePath = `/competitions/${competition.id}/results/submit`;
      const send = (scores, deduction, role = 'other') => f.request(scorePath, { role, method: 'POST', body: { scheduleId: schedule.id, participantId, scores, deduction } });
      const names = kind === 'large' ? ['E1','E2','E3','E4','D1','T1','H1'] : ['E1','E2'];
      for (let index = 0; index < names.length; index++) {
        f.users.other.name = names[index];
        await f.users.other.save();
        const malicious = values.map(() => 99);
        malicious[index] = values[index];
        const response = await send(malicious, -100);
        assert.equal(response.status, 200, JSON.stringify(response.body));
        assert.equal(response.body.data.details.deduction, 0);
        assert.deepEqual(response.body.data.details.scores, values.map((value, i) => i <= index ? value : null));
        assert.equal(response.body.data.status, 'pending');
      }
      const confirmed = await send(values, 0.5, 'admin');
      assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
      assert.equal(confirmed.body.data.score, expected);
      assert.equal(confirmed.body.data.status, 'verified');
      assert.equal(confirmed.body.data.details.scoringType, kind);
      assert.equal((await send(values, -1, 'admin')).status, 400);
      const invalid = [...values]; invalid[0] = -1;
      assert.equal((await send(invalid, 0, 'admin')).status, 400);
      f.users.other.name = 'E4'; await f.users.other.save();
      if (kind === 'small') assert.equal((await send(values, 0)).status, 403);
    }
    await Competition.updateOne({ _id: competition.id }, { registrationDeadline: new Date('2020-01-01') });
    assert.equal((await post(team)).status, 400);
  } finally { await f.close(); }
});
