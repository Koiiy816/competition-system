import assert from 'node:assert/strict';
import test from 'node:test';
import divingDifficultyTable from './divingDifficultyTable.js';

test('contains the official diving difficulty records used by action-plan matching', () => {
  const rows = Object.values(divingDifficultyTable).flatMap((heights) => Object.values(heights).flatMap((actions) => Object.entries(actions)));
  assert.equal(rows.length, 908);
  assert.equal(divingDifficultyTable.board['1m']['101B'], 1.3);
  assert.equal(divingDifficultyTable.board['3m']['101B'], 1.5);
  assert.equal(divingDifficultyTable.platform['10m']['5255B'], 3.6);
});
