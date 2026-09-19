const test = require('node:test');
const assert = require('node:assert/strict');
const Result = require('../models/Result');
const { getResults } = require('../controllers/resultController');

test('getResults version mode returns only the latest update marker', async () => {
  const originalFindOne = Result.findOne;
  const calls = [];
  Result.findOne = (query) => {
    calls.push(query);
    return {
      select() { return this; },
      sort() { return this; },
      lean: async () => ({ _id: 'latest-result', updatedAt: new Date('2026-09-19T01:02:03.000Z') })
    };
  };

  let body;
  const response = { status() { return this; }, json(value) { body = value; } };
  try {
    await getResults({
      params: { competitionId: '507f1f77bcf86cd799439011' },
      query: { status: 'verified', fields: 'version' }
    }, response, assert.fail);
    assert.deepEqual(calls[0], { competition: '507f1f77bcf86cd799439011', status: 'verified' });
    assert.equal(body.data.version, 'latest-result:1789779723000');
  } finally {
    Result.findOne = originalFindOne;
  }
});
