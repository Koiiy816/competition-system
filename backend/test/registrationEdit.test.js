const assert = require('node:assert/strict');
const test = require('node:test');
const AthleteIdentity = require('../models/AthleteIdentity');
const Participant = require('../models/Participant');
const Competition = require('../models/Competition');
const SystemSetting = require('../models/SystemSetting');
const Schedule = require('../models/Schedule');
const Result = require('../models/Result');
const controller = require('../controllers/participantController');

const response = () => ({ code: 0, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
async function fixture(run) {
  const originals = [];
  const stub = (model, method, fn) => { originals.push([model, method, model[method]]); model[method] = fn; };
  const row = { _id: 'entry', athleteNumber: 'AT-test', user: 'unit', competition: 'match', name: '选手', schoolName: '单位', gender: 'male', type: 'individual', status: 'approved', event: '拳术', ageGroup: 'A', updatedAt: new Date('2026-01-01'), additionalInfo: { preserved: true }, toObject() { return { ...this }; } };
  const competition = { _id: 'match', name: '武术比赛', sportType: 'wushu', status: 'registration', registrationDeadline: new Date(Date.now() + 86400000), ageGroups: [{ name: 'A' }], events: [{ name: '拳术' }, { name: '剑术', category: '器械', ageGroups: ['A'], genderRestriction: 'male' }, { name: '集体拳', isGroupEvent: true }] };
  const state = { enabled: true, writes: [], scheduled: false, result: false, virtual: false, duplicate: false, conflict: false };
  stub(Participant, 'findById', async () => row);
  stub(Competition, 'findById', async () => competition);
  stub(SystemSetting, 'findOne', async () => ({ value: state.enabled }));
  stub(Participant, 'exists', async query => query.isVirtualTeam === true ? state.virtual : state.duplicate);
  stub(Schedule, 'exists', async () => state.scheduled);
  stub(Result, 'exists', async () => state.result);
  stub(Participant, 'find', async () => []);
  stub(Participant, 'findOneAndUpdate', async (filter, update, options) => { state.writes.push({ filter, update, options }); return state.conflict ? null : { ...row, ...update.$set }; });
  stub(AthleteIdentity, 'findOne', () => ({ select: async () => ({ number: 'AT-test', user: 'unit', name: '选手', schoolName: '单位' }) }));
  const req = { user: { id: 'unit', roles: ['organization'] }, params: { id: 'entry', competitionId: 'match' }, body: { athleteNumber: 'AT-test', event: '剑术', ageGroup: 'A', groupTeam: '', eventDetail: '', updatedAt: row.updatedAt.toISOString() } };
  const invoke = async (handler = controller.updateRegistrationContent) => { const res = response(); await handler(req, res, error => { throw error; }); return res; };
  try { await run({ row, competition, state, req, invoke, stub }); }
  finally { originals.reverse().forEach(([model, method, original]) => { model[method] = original; }); }
}

test('approved registration can change event and returns to review, preserving identity and unrelated metadata', () => fixture(async ({ invoke, state }) => {
  const res = await invoke();
  assert.equal(res.code, 200);
  const { filter, update, options } = state.writes[0];
  assert.equal(filter.user, 'unit');
  assert.equal(filter.status, 'approved');
  assert.equal(update.$set.status, 'pending');
  assert.equal(update.$set.event, '剑术');
  assert.equal(Object.hasOwn(update.$set, 'ageGroup'), false);
  assert.equal(Object.hasOwn(update.$set, 'grade'), false);
  assert.equal(update.$set.category, '器械');
  assert.equal(update.$set.manualEventGroup, '');
  for (const key of ['user', 'competition', 'name', 'registrationNumber', 'photoFile', 'registrationDate']) assert.equal(Object.hasOwn(update.$set, key), false);
  assert.equal(update.$set.additionalInfo.preserved, true);
  assert.equal(options.runValidators, true);
}));

const cases = [
  ['switch off', x => { x.state.enabled = false; }, 403],
  ['missing switch', x => { x.state.enabled = undefined; }, 403],
  ['string true does not enable feature', x => { x.state.enabled = 'true'; }, 403],
  ['other unit', x => { x.req.user.id = 'other'; }, 403],
  ['non organization', x => { x.req.user.roles = ['referee']; }, 403],
  ['wrong competition URL', x => { x.req.params.competitionId = 'other'; }, 404],
  ['non wushu', x => { x.competition.sportType = 'diving'; }, 403],
  ['unauthorized sport', x => { x.req.user.sportTypes = ['diving']; }, 403],
  ['deadline passed', x => { x.competition.registrationDeadline = new Date(Date.now() - 1); }, 400],
  ['missing deadline', x => { delete x.competition.registrationDeadline; }, 400],
  ['invalid deadline', x => { x.competition.registrationDeadline = 'bad'; }, 400],
  ['not registration phase', x => { x.competition.status = 'ongoing'; }, 400],
  ['checked in', x => { x.row.isCheckedIn = true; }, 409],
  ['absent', x => { x.row.checkInStatus = 'absent'; }, 409],
  ['virtual entry', x => { x.row.isVirtualTeam = true; }, 409],
  ['scheduled', x => { x.state.scheduled = true; }, 409],
  ['has results', x => { x.state.result = true; }, 409],
  ['member of virtual team', x => { x.state.virtual = true; }, 409],
  ['duplicate target event', x => { x.state.duplicate = true; }, 409],
  ['unknown event', x => { x.req.body.event = '不存在'; }, 400],
  ['unknown age group', x => { x.req.body.ageGroup = 'B'; }, 400],
  ['event age restriction', x => { x.competition.events[1].ageGroups = ['B']; }, 400],
  ['gender restriction', x => { x.row.gender = 'female'; }, 400],
  ['date of birth restriction', x => { x.competition.ageGroups[0].birthDateStart = '2020-01-01'; }, 400],
  ['required event detail', x => { x.competition.events[1].registrationDetail = { required: true }; }, 400],
  ['detail too long', x => { x.req.body.eventDetail = 'x'.repeat(101); }, 400],
  ['team number required', x => { x.req.body.event = '集体拳'; }, 400],
  ['protected fields', x => { x.req.body.status = 'approved'; }, 400],
  ['operator injection', x => { x.req.body.$set = { user: 'other' }; }, 400],
  ['malformed field', x => { x.req.body.event = { $ne: '' }; }, 400],
  ['missing version', x => { delete x.req.body.updatedAt; }, 400],
  ['stale version', x => { x.req.body.updatedAt = '2025-01-01'; }, 409]
];
for (const [name, change, expected] of cases) test(name + ' rejects without writing', () => fixture(async x => {
  change(x);
  assert.equal((await x.invoke()).code, expected);
  assert.equal(x.state.writes.length, 0);
}));

test('concurrent same-record update returns conflict', () => fixture(async x => { x.state.conflict = true; assert.equal((await x.invoke()).code, 409); }));
test('switch takes effect on next request without restart', () => fixture(async x => {
  assert.equal((await x.invoke()).code, 200);
  x.state.enabled = false;
  assert.equal((await x.invoke()).code, 403);
  x.state.enabled = true;
  assert.equal((await x.invoke()).code, 200);
}));
test('collective event saves team number and detail', () => fixture(async x => {
  Object.assign(x.req.body, { event: '集体拳', groupTeam: ' 2队 ', eventDetail: '陈式' });
  assert.equal((await x.invoke()).code, 200);
  assert.equal(x.state.writes[0].update.$set.groupTeam, '2队');
  assert.equal(x.state.writes[0].update.$set.additionalInfo.eventDetail, '陈式');
}));
test('old update endpoint cannot bypass the wushu feature switch', () => fixture(async x => {
  x.row.status = 'pending';
  assert.equal((await x.invoke(controller.updateParticipant)).code, 403);
  assert.equal(x.state.writes.length, 0);
}));
test('admin old update remains available with feature disabled', () => fixture(async x => {
  x.req.user.roles = ['admin']; x.state.enabled = false;
  x.stub(Participant, 'findByIdAndUpdate', async () => x.row);
  assert.equal((await x.invoke(controller.updateParticipant)).code, 200);
}));
test('non wushu pending edit remains available with feature disabled', () => fixture(async x => {
  x.competition.sportType = 'diving'; x.row.status = 'pending'; x.state.enabled = false;
  x.stub(Participant, 'findByIdAndUpdate', async () => x.row);
  assert.equal((await x.invoke(controller.updateParticipant)).code, 200);
}));
test('existing Luohu quota excludes edited record and rejects conflicting fist selection', () => fixture(async x => {
  x.competition.name = '罗湖区传统武术'; x.req.body.event = '拳术';
  x.stub(Participant, 'find', async query => { assert.deepEqual(query._id, { $ne: 'entry' }); return [{ event: '长拳' }]; });
  assert.equal((await x.invoke()).code, 400);
  assert.equal(x.state.writes.length, 0);
}));

for (const status of ['pending', 'rejected']) test(status + ' registration can submit project changes for review', () => fixture(async x => {
  x.row.status = status;
  assert.equal((await x.invoke()).code, 200);
  assert.equal(x.state.writes[0].update.$set.status, 'pending');
}));
test('legacy null additionalInfo is safely replaced with event details', () => fixture(async x => {
  x.row.additionalInfo = null;
  assert.equal((await x.invoke()).code, 200);
  assert.equal(x.state.writes[0].update.$set.additionalInfo.eventDetail, '');
}));
test('database failure is forwarded and never silently permits editing', () => fixture(async x => {
  x.stub(SystemSetting, 'findOne', async () => { throw new Error('database unavailable'); });
  await assert.rejects(x.invoke, /database unavailable/);
  assert.equal(x.state.writes.length, 0);
}));

test('organization cannot change to another valid competition age group', () => fixture(async x => {
  x.competition.ageGroups.push({ name: 'B' });
  x.competition.events[1].ageGroups.push('B');
  x.req.body.ageGroup = 'B';
  const res = await x.invoke();
  assert.equal(res.code, 400);
  assert.match(res.body.message, /不能修改组别/);
  assert.equal(x.state.writes.length, 0);
}));
test('legacy grade-only registration can edit event without rewriting group fields', () => fixture(async x => {
  delete x.row.ageGroup;
  x.row.grade = 'A';
  assert.equal((await x.invoke()).code, 200);
  assert.equal(Object.hasOwn(x.state.writes[0].update.$set, 'ageGroup'), false);
  assert.equal(Object.hasOwn(x.state.writes[0].update.$set, 'grade'), false);
}));
test('editing event preserves distinct legacy grade and ageGroup values', () => fixture(async x => {
  x.row.grade = '原年级';
  assert.equal((await x.invoke()).code, 200);
  assert.equal(Object.hasOwn(x.state.writes[0].update.$set, 'grade'), false);
}));
test('grade field cannot bypass locked age group', () => fixture(async x => {
  x.req.body.grade = 'B';
  assert.equal((await x.invoke()).code, 400);
  assert.equal(x.state.writes.length, 0);
}));
