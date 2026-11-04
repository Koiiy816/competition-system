const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canUserAccessCompetitionType,
  getCompetitionSportType,
  normalizeSportType,
  normalizeSportTypes
} = require('../utils/competitionType');

test('recognizes legacy Chinese martial arts and diving labels', () => {
  assert.equal(normalizeSportType('武术套路／健身气功'), 'wushu');
  assert.equal(normalizeSportType('青少年跳水比赛'), 'diving');
});

test('prefers the canonical workspace type over the legacy display label', () => {
  assert.equal(getCompetitionSportType({ sportType: 'diving', type: '体育竞技' }), 'diving');
});

test('normalizes permitted sport types and restricts configured organisation accounts', () => {
  assert.deepEqual(normalizeSportTypes(['武术', 'wushu', '跳水', '无效类型']), ['wushu', 'diving']);
  const wushuUnit = { roles: ['organization'], sportTypes: ['wushu'] };
  assert.equal(canUserAccessCompetitionType(wushuUnit, { sportType: 'wushu' }), true);
  assert.equal(canUserAccessCompetitionType(wushuUnit, { sportType: 'diving' }), false);
  assert.equal(canUserAccessCompetitionType({ roles: ['organization'] }, { sportType: 'diving' }), true);
});
