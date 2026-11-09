const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('../identityFixture');
const { buildTrampolineCompetition } = require('../../data/trampoline2026');

test('单位分组导出：完整记录不受分页影响，单位账号不能读取其他账号报名', async () => {
  const f = await createFixture();
  try {
    const Competition = require('../../models/Competition');
    const competition = await Competition.create(buildTrampolineCompetition(f.users.admin.id));
    for (const user of [f.users.organization, f.users.other]) {
      user.sportTypes = ['trampoline'];
      await user.save();
    }
    const base = { competition: competition.id, name: '单位甲选手', gender: 'male', type: 'individual',
      schoolName: '单位甲全称', event: '大网U8组蹦床个人', ageGroup: '大网U8组', idCard: 'TEST-ONLY-001',
      teamLeader: '领队甲', leaderPhone: '13800000001', coach: '教练甲', coachPhone: '13800000002',
      additionalInfo: { notes: '测试备注' } };
    await f.Participant.create([
      { ...base, user: f.users.organization.id },
      { ...base, user: f.users.organization.id, event: '小网U8组男子蹦床个人', ageGroup: '小网U8组' },
      { ...base, user: f.users.other.id, name: '其他账号选手' },
      { ...base, user: f.users.other.id, schoolName: '其他单位' },
      { ...base, user: f.users.organization.id, name: '虚拟队伍', isVirtualTeam: true }
    ]);
    const path = `/competitions/${competition.id}/participants?groupBy=school&exportPdf=true&limit=1&page=2`;
    const admin = await f.request(path, { role: 'admin' });
    assert.equal(admin.status, 200);
    assert.equal(admin.body.data.length, 2);
    assert.equal(admin.body.data.find(group => group.schoolName === '单位甲全称').participants.length, 3);
    for (const suffix of ['', '&myRegistrations=false', '&myRegistrations=true']) {
      const own = await f.request(path + suffix);
      assert.equal(own.status, 200);
      assert.equal(own.body.data.length, 1);
      const group = own.body.data[0];
      assert.equal(group.displayName, '单位甲全称');
      assert.equal(group.participants.length, 2);
      assert.ok(group.participants.every(row => String(row.user._id) === f.users.organization.id));
      const participant = group.participants[0];
      assert.equal(participant.teamLeader, '领队甲');
      assert.equal(participant.coachPhone, '13800000002');
      assert.equal(participant.idCard, 'TEST-ONLY-001');
      assert.equal(participant.additionalInfo.notes, '测试备注');
    }
  } finally { await f.close(); }
});
