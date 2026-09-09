const assert = require('node:assert/strict');
const test = require('node:test');
const Participant = require('../models/Participant');
const { getMyParticipations } = require('../controllers/participantController');

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
