import test from 'node:test';
import assert from 'node:assert/strict';
import { getSportType, isDivingCompetition, normalizeSportType } from './competitionType.js';

test('legacy labels resolve to their correct workspace', () => {
  assert.equal(normalizeSportType('武术比赛'), 'wushu');
  assert.equal(normalizeSportType('跳水'), 'diving');
  assert.equal(isDivingCompetition({ type: '武术' }), false);
  assert.equal(isDivingCompetition({ type: '跳水比赛' }), true);
});

test('a canonical type makes workspace selection independent of event names', () => {
  assert.equal(getSportType({ sportType: 'diving', type: '体育竞技' }), 'diving');
  assert.equal(getSportType({ sportType: 'wushu', type: '跳水' }), 'wushu');
});
