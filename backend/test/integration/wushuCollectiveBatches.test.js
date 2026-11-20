const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('../identityFixture');

test('武术集体项目分场、各场地裁判录分、统一排名及安全约束', async t => {
  const f = await createFixture();
  const Schedule = require('../../models/Schedule');
  const Result = require('../../models/Result');
  const User = require('../../models/User');
  const base = `/competitions/${f.competition.id}`;
  const teams = [];
  let source;
  const split = batches => f.request(`${base}/schedules/${source.id}/collective-batches`, { role: 'admin', method: 'POST', body: { batches } });
  const batch = (ids, court) => ({ participantIds: ids, court, scheduleDate: '2026-11-29', timeSlot: '上午' });
  try {
    for (const [role, name] of [['chief', '裁判长'], ['judge1', '裁判1'], ['judge2', '裁判2']]) {
      f.users[role] = await User.create({ name, email: `${role}@batches.example.com`, password: f.password,
        roles: [role === 'chief' ? 'chief_referee' : 'referee'], sportTypes: ['wushu'] });
    }
    for (let i = 0; i < 6; i++) {
      const member = await f.Participant.create({ competition: f.competition.id, user: f.users.organization.id,
        name: `队员${i}`, gender: 'male', schoolName: `单位${i}`, event: '集体拳', type: 'individual', status: 'approved',
        isCheckedIn: true, checkInStatus: i === 4 ? 'absent' : 'checked' });
      teams.push(await f.Participant.create({ competition: f.competition.id, user: f.users.organization.id,
        name: `队伍${i}`, gender: 'mixed', schoolName: `单位${i}`, teamName: `单位${i}1队`, event: '集体拳', type: 'team',
        isVirtualTeam: true, teamMembers: [member.id], isTest: i === 5, status: 'approved' }));
    }
    source = await Schedule.create({ competition: f.competition.id, name: '集体拳', startTime: '2026-11-29', endTime: '2026-11-29',
      location: '原场地', participants: teams.map(team => team.id), judgeCount: 5 });
    const beforeMembers = await f.Participant.find({ competition: f.competition.id }).lean();
    const assignments = [batch(teams.slice(0, 3).map(team => team.id), '第一场地'), batch(teams.slice(3).map(team => team.id), '第二场地')];
    await t.test('权限、队伍重复、遗漏、其他赛事ID均不能修改赛程', async () => {
      assert.equal((await f.request(`${base}/schedules/${source.id}/collective-batches`, { role: 'organization', method: 'POST', body: { batches: assignments } })).status, 403);
      assert.equal((await split([assignments[0], batch([teams[0].id, ...teams.slice(3).map(team => team.id)], '第二场地')])).status, 400);
      assert.equal((await split([assignments[0], batch([teams[3].id], '第二场地')])).status, 400);
      assert.equal((await f.request(`/competitions/${new f.mongoose.Types.ObjectId()}/schedules/${source.id}/collective-batches`, { role: 'admin', method: 'POST', body: { batches: assignments } })).status, 404);
      assert.equal(await Schedule.countDocuments({ competition: f.competition.id }), 1);
    });
    let batches;
    await t.test('按整队分为两场，调整分场不产生重复，随机排序保留批次与名单', async () => {
      let response = await split(assignments);
      assert.equal(response.status, 200, JSON.stringify(response.body));
      response = await split(assignments);
      assert.equal(response.status, 200, JSON.stringify(response.body));
      batches = await Schedule.find({ competition: f.competition.id }).sort({ batchNumber: 1 });
      assert.equal(batches.length, 2);
      assert.ok(batches.every(row => String(row.rankingGroupId) === source.id && row.rankingGroupName === '集体拳'));
      assert.deepEqual(batches.flatMap(row => row.participants.map(String)).sort(), teams.map(team => team.id).sort());
      assert.deepEqual(await f.Participant.find({ competition: f.competition.id }).lean(), beforeMembers);
      assert.equal((await f.request(`${base}/schedules/generate-start-list?overwrite=true`, { role: 'admin', method: 'POST', body: {} })).status, 200);
      const after = await Schedule.find({ competition: f.competition.id }).sort({ batchNumber: 1 });
      after.forEach((row, index) => { assert.equal(row.court, batches[index].court); assert.deepEqual(row.participants.map(String).sort(), batches[index].participants.map(String).sort()); });
      const navigation = await f.request(`${base}/schedules?fields=navigation&limit=100`, { role: 'judge1' });
      assert.equal(navigation.status, 200);
      assert.equal(navigation.body.data.filter(row => row.rankingGroupId === source.id).length, 2);
    });
    const score = (schedule, team, value, role = 'chief') => f.request(`${base}/results/submit`, { role, method: 'POST',
      body: { scheduleId: schedule.id, participantId: team.id, scores: role === 'chief' ? Array(5).fill(value) : Array.from({ length: 5 }, (_, index) => index === (role === 'judge1' ? 0 : 1) ? value : 0), deduction: 0 } });
    await t.test('异场队伍不能在错误场地录分；多位裁判的分数互不覆盖', async () => {
      assert.equal((await score(batches[0], teams[3], 9)).status, 400);
      const responses = await Promise.all([score(batches[0], teams[0], 8, 'judge1'), score(batches[0], teams[0], 9, 'judge2')]);
      responses.forEach(response => assert.equal(response.status, 200, JSON.stringify(response.body)));
      const saved = await Result.findOne({ schedule: batches[0].id, participant: teams[0].id });
      assert.equal(saved.details.scores[0], 8);
      assert.equal(saved.details.scores[1], 9);
      assert.equal(saved.status, 'pending');
    });
    await t.test('两个场地高低分交错、同分并列，弃权和测试队伍不参与正式排名', async () => {
      const scores = [8.5, 9, 8, 9, 0, 10];
      for (let i = 0; i < teams.length; i++) {
        const response = await score(batches[i < 3 ? 0 : 1], teams[i], scores[i]);
        assert.equal(response.status, 200, JSON.stringify(response.body));
      }
      await Schedule.findByIdAndUpdate(batches[1].id, { name: '第二场地自订批次名' });
      const response = await f.request(`${base}/results?status=verified&limit=100`, { role: 'admin' });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      const ranks = new Map(response.body.data.map(row => [row.participant._id, row.rank]));
      assert.deepEqual(teams.map(team => ranks.get(team.id)), [3, 1, 4, 1, null, null]);
      const filtered = await f.request(`${base}/results?status=verified&scheduleId=${batches[0].id}&limit=1`, { role: 'admin' });
      assert.equal(filtered.status, 200);
      assert.equal(filtered.body.data[0].rank, ranks.get(filtered.body.data[0].participant._id));
      assert.ok(response.body.data.every(row => row.schedule.rankingGroupName === '集体拳'));
    });
    await t.test('项目开始后禁止重新分场，已有分数与归属不变', async () => {
      const before = await Result.find({ competition: f.competition.id }).lean();
      const response = await split(assignments);
      assert.equal(response.status, 409, JSON.stringify(response.body));
      assert.deepEqual(await Result.find({ competition: f.competition.id }).lean(), before);
    });
  } finally { await f.close(); }
});
