const assert = require('node:assert/strict');
const test = require('node:test');
const Schedule = require('../models/Schedule');
const { getSchedules } = require('../controllers/scheduleController');

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
    assert.equal(selectedFields, '_id name court scheduleDate timeSlot order startTime');
    assert.equal(populates.length, 0);
  } finally {
    Schedule.find = originalFind;
    Schedule.countDocuments = originalCountDocuments;
  }
});
