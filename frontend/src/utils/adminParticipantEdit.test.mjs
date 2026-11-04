import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Module, createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { transformWithEsbuild } from 'vite';

const filename = fileURLToPath(new URL('../components/participants/AddParticipantModal.jsx', import.meta.url));
const transformed = await transformWithEsbuild(fs.readFileSync(filename, 'utf8'), filename, { loader: 'jsx', format: 'cjs' });
const effects = [];
const compiled = new Module(filename);
compiled.filename = filename;
compiled.paths = createRequire(import.meta.url).resolve.paths('react');
const originalRequire = compiled.require.bind(compiled);
compiled.require = spec => {
  if (spec === 'react') return { ...React, useState: initial => [initial, () => {}], useEffect: effect => effects.push(effect) };
  if (spec === 'react-router-dom') return { useNavigate: () => () => {} };
  if (spec.includes('AuthContext')) return { useAuth: () => ({ user: { roles: ['admin'] } }) };
  if (spec.includes('competitionService')) return { getCompetition: async () => ({ data: { sportType: 'wushu', events: [] } }) };
  if (spec.includes('participantService')) return {};
  if (spec.includes('AthleteIdentitySelect')) return () => null;
  return originalRequire(spec);
};
compiled._compile(transformed.code, filename);

test('opening administrator edit on HTTP does not throw when crypto.randomUUID is unavailable', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: bytes => bytes.fill(7) } });
    effects.length = 0;
    compiled.exports.default({ open: true, competitionId: 'competition', editData: { _id: 'entry', name: '选手', athleteNumber: 'AT-existing' } });
    assert.doesNotThrow(() => effects[0]());
  } finally { Object.defineProperty(globalThis, 'crypto', descriptor); }
});
