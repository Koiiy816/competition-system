const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWushuFeeGroups } = require('../utils/wushuFees');
const Participant = require('../models/Participant');
const Competition = require('../models/Competition');
const SystemSetting = require('../models/SystemSetting');
const { getParticipants } = require('../controllers/participantController');

const entry = (id, event, extra = {}) => ({ _id: id, athleteNumber: 'AT-main', name: '陈光前', schoolName: '甲单位',
  competition: 'match', gender: 'male', type: 'individual', status: 'approved', event, ...extra });
const response = () => ({ code: 0, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

for (const [count, fee] of [[0, 0], [1, 300], [2, 300], [3, 400], [4, 500], [10, 1100]]) {
  test(`${count} payable events cost ${fee}`, () => {
    const rows = count ? Array.from({ length: count }, (_, i) => entry(String(i), `项目${i}`)) : [entry('0', '', { status: 'rejected' })];
    const person = buildWushuFeeGroups(rows)[0].roster[0];
    assert.equal(person.fee, fee);
    assert.equal(person.eventCount, count);
  });
}

test('same confirmed number merges all records without mutating source; other units remain separate', () => {
  const rows = [entry('1', '拳'), entry('2', '剑'), entry('3', '拳', { schoolName: '乙单位' })];
  const before = JSON.stringify(rows);
  const groups = buildWushuFeeGroups(rows);
  assert.equal(groups.length, 2);
  assert.equal(groups.find(g => g.schoolName === '甲单位').roster[0].registrations.length, 2);
  assert.equal(JSON.stringify(rows), before);
});

test('singles and doubles each count once per person; duplicates and rejected entries do not inflate fee', () => {
  const rows = [entry('1', '拳'), entry('2', '双人拳'), entry('3', '剑', { status: 'pending' }),
    entry('4', '拳'), entry('5', '刀', { status: 'rejected' }), entry('6', '双人拳', { name: '搭档', athleteNumber: 'AT-partner' }),
    entry('7', '虚拟队', { isVirtualTeam: true })];
  const people = buildWushuFeeGroups(rows)[0].roster;
  assert.equal(people.length, 2);
  assert.equal(people[0].fee, 400);
  assert.equal(people[0].registrations.length, 5);
  assert.equal(people[1].fee, 300);
});

test('filters select people but preserve all their project details and full fee', () => {
  const rows = [entry('1', '拳'), entry('2', '双人拳'), entry('3', '剑', { status: 'pending' }), entry('4', '拳', { name: '其他人', athleteNumber: 'AT-other' })];
  const groups = buildWushuFeeGroups(rows, { status: 'pending', event: '剑', search: '陈光前', type: 'individual' });
  assert.equal(groups[0].roster.length, 1);
  assert.equal(groups[0].roster[0].fee, 400);
  assert.equal(groups[0].roster[0].registrations.length, 3);
  assert.deepEqual(buildWushuFeeGroups(rows, { search: '不存在' }), []);
});

test('missing names stay separate and special names are safe map keys', () => {
  const groups = buildWushuFeeGroups([entry('1', '拳', { name: '', athleteNumber: undefined }), entry('2', '拳', { name: '', athleteNumber: undefined }), entry('3', '拳', { name: '__proto__', schoolName: '__proto__' })]);
  assert.equal(groups.reduce((sum, g) => sum + g.roster.length, 0), 3);
});

test('rejection, editing and deletion immediately change derived charges', () => {
  const rows = [entry('1', '拳'), entry('2', '双人拳'), entry('3', '剑')];
  const fee = () => buildWushuFeeGroups(rows)[0].roster[0].fee;
  assert.equal(fee(), 400);
  rows[2].status = 'rejected';
  assert.equal(fee(), 300);
  rows[2].status = 'approved';
  assert.equal(fee(), 400);
  rows[2].event = '拳';
  assert.equal(fee(), 300);
  rows.splice(1, 2);
  assert.equal(fee(), 300);
});

async function fixture(run) {
  const originals = [];
  const stub = (object, key, value) => { originals.push([object, key, object[key]]); object[key] = value; };
  const state = { enabled: true, sportType: 'wushu', queries: [], pages: [], settingsRead: 0 };
  const rows = [entry('1', '拳'), entry('2', '剑'), entry('3', '双人拳')];
  stub(SystemSetting, 'findOne', async () => { state.settingsRead++; return state.enabled === undefined ? null : { value: state.enabled }; });
  stub(Competition, 'findById', async () => ({ sportType: state.sportType }));
  stub(Participant, 'countDocuments', async () => rows.length);
  stub(Participant, 'find', query => {
    state.queries.push(query);
    const chain = { populate() { return this; }, select() { return this; },
      skip(n) { state.pages.push(n); return this; }, limit(n) { state.pages.push(n); return this; },
      sort() { return this; }, lean: async () => rows, then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); } };
    return chain;
  });
  const req = { params: { competitionId: 'match' }, query: { groupBy: 'school', limit: '1', page: '2' }, user: { id: 'unit' } };
  const invoke = async () => { const res = response(); await getParticipants(req, res, error => { throw error; }); return res; };
  try { await run({ state, rows, req, invoke, stub }); }
  finally { originals.reverse().forEach(([object, key, value]) => { object[key] = value; }); }
}

test('API reads full competition without pagination; retains raw records and user scope', () => fixture(async ({ state, req, invoke }) => {
  req.query.myRegistrations = 'true';
  req.query.status = 'approved';
  const res = await invoke();
  assert.equal(res.code, 200);
  assert.equal(res.body.data[0].roster[0].fee, 400);
  assert.equal(res.body.data[0].participants.length, 3);
  assert.deepEqual(state.queries, [{ competition: 'match', isVirtualTeam: { $ne: true }, user: 'unit' }]);
  assert.deepEqual(state.pages, []);
}));

test('API switch on/off/on takes effect on next request, default and malformed values stay off', () => fixture(async ({ state, invoke }) => {
  for (const enabled of [true, false, true, undefined, 'true']) {
    state.enabled = enabled;
    const res = await invoke();
    assert.equal(Boolean(res.body.feeSummaryEnabled), enabled === true);
    assert.equal(Boolean(res.body.data[0].roster), enabled === true);
  }
}));

test('non-wushu and ordinary lists preserve existing response and pagination', () => fixture(async ({ state, req, invoke }) => {
  state.sportType = 'diving';
  assert.equal((await invoke()).body.feeSummaryEnabled, undefined);
  assert.deepEqual(state.pages, [1, 1]);
  req.query.groupBy = undefined;
  state.settingsRead = 0;
  assert.equal((await invoke()).body.grouped, undefined);
  assert.equal(state.settingsRead, 0);
}));

test('setting read errors are forwarded instead of returning misleading fees', () => fixture(async ({ stub, invoke }) => {
  stub(SystemSetting, 'findOne', async () => { throw new Error('settings unavailable'); });
  await assert.rejects(invoke, /settings unavailable/);
}));

test('admin setting rejects non-booleans and persists both enabled and disabled', async () => {
  const route = require('../routes/settings').stack.find(layer => layer.route?.methods.put).route;
  const authorize = route.stack[1].handle;
  const save = route.stack[2].handle;
  const original = SystemSetting.findOneAndUpdate;
  const writes = [];
  SystemSetting.findOneAndUpdate = async (...args) => { writes.push(args); return { value: args[1].value }; };
  try {
    for (const roles of [undefined, ['organization'], ['chief_referee'], ['admin']]) {
      const res = response();
      let error;
      authorize({ user: roles ? { roles } : undefined }, res, e => { error = e; });
      assert.equal(Boolean(error), !roles?.includes('admin'));
    }
    for (const value of ['true', 1, null, {}, true, false]) {
      const res = response();
      await save({ params: { key: 'wushu_fee_summary_enabled' }, body: { value } }, res, assert.fail);
      assert.equal(res.code, typeof value === 'boolean' ? 200 : 400);
    }
    assert.equal(writes.length, 2);
    assert.deepEqual(writes.map(args => args[1].value), [true, false]);
    assert.deepEqual(writes[0][0], { key: 'wushu_fee_summary_enabled' });
  } finally { SystemSetting.findOneAndUpdate = original; }
});
