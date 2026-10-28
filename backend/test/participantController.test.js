const assert = require('node:assert/strict');
const test = require('node:test');
const Participant = require('../models/Participant');
const Competition = require('../models/Competition');
const { getMyParticipations, getParticipants } = require('../controllers/participantController');

test('Participant persists an absent check-in status and keeps its timestamp separate', () => {
  const participant = new Participant({
    user: '507f1f77bcf86cd799439011',
    competition: '507f1f77bcf86cd799439011',
    name: '缺席选手',
    gender: 'male',
    type: 'individual',
    insuranceConfirmed: true,
    checkInStatus: 'absent',
    isCheckedIn: false,
    absentAt: new Date('2026-09-18T00:00:00.000Z')
  });

  const data = participant.toObject();
  assert.equal(data.checkInStatus, 'absent');
  assert.equal(data.absentAt.toISOString(), '2026-09-18T00:00:00.000Z');
  assert.equal(data.checkedInAt, undefined);
});

test('getMyParticipations only queries the current unit account records', async () => {
  const originalFind = Participant.find;
  let query;
  Participant.find = (value) => {
    query = value;
    return { populate() { return this; }, sort: async () => [{ name: '本单位选手' }] };
  };
  const response = { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
  try {
    await getMyParticipations({ user: { id: 'unit-user-id' }, params: { competitionId: 'all' } }, response, assert.fail);
    assert.deepEqual(query, { user: 'unit-user-id' });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.count, 1);
  } finally {
    Participant.find = originalFind;
  }
});

test('event grouping uses the configured collective flag without a name suffix', async () => {
  const originalFind = Participant.find;
  const originalCount = Participant.countDocuments;
  const originalCompetitionFind = Competition.findById;
  const rows = [
    { name: '甲', schoolName: '同一单位', event: '太极扇十八式', ageGroup: 'A1组', gender: 'male' },
    { name: '乙', schoolName: '同一单位', event: '太极扇十八式', ageGroup: 'B组', gender: 'female' }
  ];
  let findCalls = 0;
  Participant.countDocuments = async () => rows.length;
  Participant.find = () => {
    findCalls += 1;
    if (findCalls === 1) return { select() { return this; }, lean: async () => rows };
    return {
      populate() { return this; },
      skip() { return this; },
      limit() { return this; },
      sort: async () => rows
    };
  };
  Competition.findById = () => ({ select: async () => ({ events: [{ name: '太极扇十八式', isGroupEvent: true }] }) });
  const response = { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
  try {
    await getParticipants({ params: { competitionId: '507f1f77bcf86cd799439011' }, query: { groupBy: 'event' } }, response, assert.fail);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.groupCount, 1);
    assert.equal(response.body.data[0].schoolName, '同一单位');
    assert.equal(response.body.data[0].participants.length, 2);
  } finally {
    Participant.find = originalFind;
    Participant.countDocuments = originalCount;
    Competition.findById = originalCompetitionFind;
  }
});
