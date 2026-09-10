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
    assert.match(participants.populate.find((value) => value.path === 'teamMembers').select, /additionalInfo/);
  } finally {
    Schedule.find = originalFind;
    Schedule.countDocuments = originalCountDocuments;
  }
});
