import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createRequestKey } from './requestKey.js';

test('HTTPS uses native randomUUID', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: () => 'native-key' } });
    assert.equal(createRequestKey(), 'native-key');
  } finally { Object.defineProperty(globalThis, 'crypto', descriptor); }
});

test('HTTP generates distinct valid UUIDs without randomUUID', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: bytes => webcrypto.getRandomValues(bytes) } });
    const keys = Array.from({ length: 100 }, createRequestKey);
    assert.equal(new Set(keys).size, 100);
    keys.forEach(key => assert.match(key, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/));
  } finally { Object.defineProperty(globalThis, 'crypto', descriptor); }
});
