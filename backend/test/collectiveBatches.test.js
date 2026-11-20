const test = require('node:test');
const assert = require('node:assert/strict');
const { validateBatches } = require('../utils/collectiveBatches');
const { attachCollectiveRanks, acquireCollectiveLock } = require('../utils/collectiveBatches');
const Schedule = require('../models/Schedule');
const Result = require('../models/Result');
const Competition = require('../models/Competition');
const Participant = require('../models/Participant');
const { splitCollectiveSchedule } = require('../controllers/scheduleController');
const { submitScore } = require('../controllers/resultController');
const { Types } = require('mongoose');
const oid = () => new Types.ObjectId();
const query = rows => ({ select() { return this; }, sort() { return this; }, populate() { return this; },
  lean: async () => rows, then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); } });
const response = () => ({ code: 0, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

const batch = (ids, overrides = {}) => ({ participantIds: ids, court: '第一场地', scheduleDate: '2026-11-29', timeSlot: '上午', ...overrides });
test('分场必须完整覆盖整支队伍，禁止重复、遗漏、陌生队伍和无效日期', () => {
  assert.equal(validateBatches([batch(['a']), batch(['b'])], ['a', 'b']), null);
  assert.match(validateBatches([batch(['a'])], ['a']), /2 至 30/);
  assert.match(validateBatches([batch(['a']), batch(['a', 'b'])], ['a', 'b']), /重复/);
  assert.match(validateBatches([batch(['a']), batch(['b'])], ['a', 'b', 'c']), /所有队伍/);
  assert.match(validateBatches([batch(['a']), batch(['x'])], ['a', 'b']), /已有的整支队伍/);
  assert.match(validateBatches([batch(['a']), batch([])], ['a']), /至少/);
  for (const overrides of [{ court: ' ' }, { scheduleDate: '2026-02-30' }, { timeSlot: '清晨' }]) {
    assert.match(validateBatches([batch(['a'], overrides), batch(['b'])], ['a', 'b']), /有效日期/);
  }
});

test('从两个场地的完整成绩计算排名，分页不能截断，同分并列且排除测试、弃权、未确认分数', async t => {
  const competitions = [oid()];
  const group = oid();
  const unrelated = oid();
  const schedules = [{ _id: oid(), rankingGroupId: group }, { _id: oid(), rankingGroupId: group }, { _id: oid(), rankingGroupId: unrelated }];
  const scores = [8.5, 9, 8, 9, 0, 10];
  const all = scores.map((score, index) => ({ _id: oid(), schedule: schedules[index < 3 ? 0 : 1]._id,
    participant: { isTest: index === 5 }, score, details: { isAbsent: index === 4 }, status: 'verified' }));
  t.mock.method(Schedule, 'find', filter => {
    assert.deepEqual(filter.competition.$in, competitions.map(String));
    assert.deepEqual(filter.rankingGroupId.$in, [String(group)]);
    return query(schedules.slice(0, 2));
  });
  t.mock.method(Result, 'find', filter => {
    assert.equal(filter.status, 'verified');
    assert.deepEqual(filter.schedule.$in.map(String), schedules.slice(0, 2).map(row => String(row._id)));
    return query(all);
  });
  const page = all.slice(0, 1).map(row => ({ ...row, competition: competitions[0], schedule: schedules[0] }));
  await attachCollectiveRanks(page);
  assert.equal(page[0].rank, 3);
  const rows = all.map(row => ({ ...row, competition: { _id: competitions[0] }, schedule: schedules.find(schedule => String(schedule._id) === String(row.schedule)) }));
  await attachCollectiveRanks(rows);
  assert.deepEqual(rows.map(row => row.rank), [3, 1, 4, 1, null, null]);
  const pending = { _id: oid(), competition: competitions[0], schedule: schedules[0], status: 'pending', rank: 1 };
  await attachCollectiveRanks([pending]);
  assert.equal(pending.rank, null);
});

test('分场控制器支持反复调整批次、保留完整队伍，拒绝错误输入及已有成绩', async t => {
  const competitionId = oid();
  const members = Array.from({ length: 6 }, oid);
  const original = new Schedule({ competition: competitionId, name: 'B组 集体拳', startTime: '2026-11-29', endTime: '2026-11-29',
    location: '原场馆', participants: members, judgeCount: 3 });
  let schedules = [original];
  let hasResults = false;
  let failNextWrite = false;
  const teams = members.map(_id => ({ _id, isVirtualTeam: true }));
  t.mock.method(Competition, 'findById', async () => ({ sportType: 'wushu' }));
  t.mock.method(Schedule, 'findOne', async filter => schedules.find(row => String(row._id) === String(filter._id) && String(row.competition) === String(filter.competition)));
  t.mock.method(Schedule, 'find', () => query([...schedules].sort((a, b) => (a.batchNumber || 0) - (b.batchNumber || 0))));
  t.mock.method(Participant, 'find', () => query(teams));
  t.mock.method(Result, 'exists', async () => hasResults);
  t.mock.method(Schedule, 'create', async data => { const row = new Schedule(data); schedules.push(row); return row; });
  t.mock.method(Schedule, 'bulkWrite', async operations => {
    for (const { updateOne, replaceOne } of operations) {
      if (replaceOne) {
        const index = schedules.findIndex(row => String(row._id) === String(replaceOne.filter._id));
        if (index < 0) schedules.push(new Schedule(replaceOne.replacement));
        else schedules[index] = new Schedule(replaceOne.replacement);
      } else {
        Object.assign(schedules.find(row => String(row._id) === String(updateOne.filter._id)), updateOne.update.$set);
        if (failNextWrite) { failNextWrite = false; throw new Error('模拟部分写入后数据库异常'); }
      }
    }
  });
  t.mock.method(Schedule, 'deleteMany', async filter => { schedules = schedules.filter(row => !filter._id.$in.some(id => String(id) === String(row._id))); });
  const request = async batches => {
    const res = response();
    await splitCollectiveSchedule({ params: { id: String(original._id), competitionId: String(competitionId) }, body: { batches } }, res, assert.fail);
    return res;
  };
  const createBatches = count => Array.from({ length: count }, (_, index) => batch(members.filter((_, i) => i % count === index).map(String), { court: `第${index + 1}场地` }));
  const invalid = createBatches(2);
  invalid[1].participantIds.push(String(members[0]));
  assert.equal((await request(invalid)).code, 400);
  assert.equal(schedules.length, 1);
  for (const count of [2, 3, 2]) {
    const res = await request(createBatches(count));
    assert.equal(res.code, 200, JSON.stringify(res.body));
    assert.equal(schedules.length, count);
    assert.deepEqual(schedules.flatMap(row => row.participants.map(String)).sort(), members.map(String).sort());
    assert.ok(schedules.every(row => String(row.rankingGroupId) === String(original._id) && row.judgeCount === 3 && row.rankingGroupName === 'B组 集体拳'));
    assert.deepEqual(schedules.map(row => row.batchNumber), Array.from({ length: count }, (_, i) => i + 1));
  }
  const beforeFailure = schedules.map(row => row.toObject({ virtuals: false }));
  failNextWrite = true;
  let caught;
  await splitCollectiveSchedule({ params: { id: String(original._id), competitionId: String(competitionId) }, body: { batches: createBatches(3) } }, response(), error => { caught = error; });
  assert.match(caught.message, /数据库异常/);
  assert.deepEqual(schedules.map(row => row.toObject({ virtuals: false })), beforeFailure);
  hasResults = true;
  assert.equal((await request(createBatches(2))).code, 409);
  assert.equal(schedules.length, 2);
});

test('分场评分拒绝异场队伍，同场多名裁判并发不会相互覆盖', async t => {
  const competition = oid(); const group = oid(); const teamId = oid();
  const schedule = { _id: oid(), competition, rankingGroupId: group, participants: [teamId], judgeCount: 5, status: 'scheduled', name: '集体拳', save: async () => {} };
  const team = { _id: teamId, isVirtualTeam: true, teamMembers: [{ checkInStatus: 'checked' }] };
  let stored;
  t.mock.method(Schedule, 'findById', () => query(schedule));
  t.mock.method(Competition, 'findById', async () => ({ sportType: 'wushu' }));
  t.mock.method(Participant, 'findById', () => query(team));
  t.mock.method(Result, 'findOne', async () => stored);
  t.mock.method(Result, 'create', async data => { stored = { ...data, _id: oid() }; return stored; });
  t.mock.method(Result, 'findByIdAndUpdate', async (id, data) => { stored = { ...stored, ...data }; return stored; });
  const submit = async (participantId, name, scores, roles = ['referee']) => {
    const res = response();
    await submitScore({ params: { competitionId: String(competition) }, body: { scheduleId: String(schedule._id), participantId, scores, deduction: 0 },
      user: { id: String(oid()), name, roles } }, res, assert.fail);
    return res;
  };
  assert.equal((await submit(String(oid()), '裁判长', Array(5).fill(9), ['chief_referee'])).code, 400);
  assert.equal(stored, undefined);
  const responses = await Promise.all([submit(String(teamId), '裁判1', [8, 0, 0, 0, 0]), submit(String(teamId), '裁判2', [0, 9, 0, 0, 0])]);
  responses.forEach(res => assert.equal(res.code, 200));
  assert.deepEqual(stored.details.scores.slice(0, 2), [8, 9]);
  assert.equal(stored.status, 'pending');
  assert.equal((await submit(String(teamId), '裁判长', Array(5).fill(8.5), ['chief_referee'])).code, 200);
  assert.equal(stored.status, 'verified');
  assert.equal(stored.score, 8.5);
});

test('分场和录分共享项目锁，等待编排完成后才能读取新名单', async () => {
  const events = [];
  const first = await acquireCollectiveLock('project');
  const waiting = acquireCollectiveLock('project').then(unlock => { events.push('score'); unlock(); });
  await Promise.resolve();
  assert.deepEqual(events, []);
  events.push('split'); first();
  await waiting;
  assert.deepEqual(events, ['split', 'score']);
});
