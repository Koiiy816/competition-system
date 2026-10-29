import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChineseResidentIdentityNumber } from './certificateInfo.js';

test('parses a Hong Kong resident permit number using the national identity-number format', () => {
  assert.deepEqual(parseChineseResidentIdentityNumber('810000200001010014'), {
    documentType: '香港居民居住证',
    birthDate: '2000-01-01',
    gender: 'male'
  });
});

test('rejects a number with an invalid checksum', () => {
  assert.equal(parseChineseResidentIdentityNumber('810000200001010015'), null);
});
