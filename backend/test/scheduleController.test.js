const assert = require('node:assert/strict');
const test = require('node:test');
const Schedule = require('../models/Schedule');
const { getSchedules, getUnassignedParticipants } = require('../controllers/scheduleController');

test('getSchedules includes diving action plans for start-order printing', async () => {
  const originalFind = Schedule.find;
  const originalCountDocuments = Schedule.countDocuments;
  const populates = [];
  Schedule.countDocuments = async () => 0;
  Schedule.find = () => ({
    populate(value) { populates.push(value); return this; },
    skip() { return this; },
    limit() { return this; },
    sort: async () => []
  });
  const response = { status() { return this; }, json() {} };
  try {
    await getSchedules({ params: { competitionId: '507f1f77bcf86cd799439011' }, query: {} }, response, assert.fail);
    const participants = populates.find((value) => value.path === 'participants');
    assert.match(participants.select, /additionalInfo/);
    assert.match(participants.select, /checkInStatus/);
    assert.match(participants.select, /absentAt/);
    assert.match(participants.populate.find((value) => value.path === 'teamMembers').select, /additionalInfo/);
  } finally {
    Schedule.find = originalFind;
    Schedule.countDocuments = originalCountDocuments;
  }
});

test('getSchedules navigation mode does not populate participant data', async () => {
  const originalFind = Schedule.find;
  const originalCountDocuments = Schedule.countDocuments;
  const populates = [];
  let selectedFields;
  let receivedQuery;
  Schedule.countDocuments = async () => 1;
  Schedule.find = (query) => {
    receivedQuery = query;
    return {
      select(value) { selectedFields = value; return this; },
      populate(value) { populates.push(value); return this; },
      skip() { return this; },
      limit() { return this; },
      sort() { return this; },
      lean: async () => []
    };
  };
  const response = { status() { return this; }, json() {} };
  try {
    await getSchedules({
      params: { competitionId: '507f1f77bcf86cd799439011' },
      query: { fields: 'navigation', court: '一号场地', limit: '1000' }
    }, response, assert.fail);
    assert.equal(receivedQuery.court, '一号场地');
    for (const field of ['_id', 'name', 'court', 'scheduleDate', 'timeSlot', 'order', 'startTime', 'rankingGroupId', 'rankingGroupName', 'batchNumber']) {
      assert.ok(selectedFields.split(' ').includes(field), `navigation includes ${field}`);
    }
    assert.equal(populates.length, 0);
  } finally {
    Schedule.find = originalFind;
    Schedule.countDocuments = originalCountDocuments;
  }
});

test('unassigned candidate list includes every eligible participant and its team number', async () => {
  const Participant = require('../models/Participant');
  const originalScheduleFind = Schedule.find;
  const originalParticipantFind = Participant.find;
  let participantQueryCount = 0;
  let eligibleFields = '';
  Schedule.find = () => ({ select() { return this; }, lean: async () => [] });
  Participant.find = () => {
    participantQueryCount += 1;
    const rows = participantQueryCount === 1
      ? []
      : [{ _id: 'late-entry', name: '刘志敏', schoolName: '测试单位', groupTeam: '2队', event: '集体拳', status: 'approved' }];
    return {
      select(fields) { if (participantQueryCount === 2) eligibleFields = fields; return this; },
      sort() { return this; },
      lean: async () => rows
    };
  };
  const response = { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
  try {
    await getUnassignedParticipants({ params: { competitionId: 'competition' } }, response, assert.fail);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.summary.unassignedCount, 1);
    assert.equal(response.body.data[0].name, '刘志敏');
    assert.equal(response.body.data[0].groupTeam, '2队');
    assert.match(eligibleFields, /groupTeam/);
  } finally {
    Schedule.find = originalScheduleFind;
    Participant.find = originalParticipantFind;
  }
});
