import test from 'node:test';
import assert from 'node:assert/strict';
import { rankStrengthEntries } from './strengthRanking.js';

test('strength total-score ties are broken by each event points in order', () => {
  const entry = (name, points) => ({ participant: { name }, finalScore: 20, details: { events: points.map((value, index) => ({ order: index + 1, points: value })) } });
  const ranked = rankStrengthEntries([entry('乙', [9, 11]), entry('甲', [11, 9])]);
  assert.deepEqual(ranked.map(({ entry: item }) => item.participant.name), ['甲', '乙']);
  assert.deepEqual(ranked.map(({ rank }) => rank), [1, 2]);
});
