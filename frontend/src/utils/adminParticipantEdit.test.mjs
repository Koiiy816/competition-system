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
let states = [];
let hookIndex = 0;
const compiled = new Module(filename);
compiled.filename = filename;
compiled.paths = createRequire(import.meta.url).resolve.paths('react');
const originalRequire = compiled.require.bind(compiled);
compiled.require = spec => {
  if (spec === 'react') return { ...React, useState: initial => {
    const index = hookIndex++;
    if (!Object.hasOwn(states, index)) states[index] = initial;
    return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  }, useEffect: effect => effects.push(effect) };
  if (spec === 'react-router-dom') return { useNavigate: () => () => {} };
  if (spec.includes('AuthContext')) return { useAuth: () => ({ user: { roles: ['admin'] } }) };
  if (spec.includes('competitionService')) return { getCompetition: async () => ({ data: { sportType: 'wushu', events: [] } }) };
  if (spec.includes('participantService')) return {};
  if (spec.includes('AthleteIdentitySelect')) return () => null;
  return originalRequire(spec);
};
compiled._compile(transformed.code, filename);

const render = props => {
  effects.length = 0;
  hookIndex = 0;
  return compiled.exports.default(props);
};

for (const edit of [false, true]) {
  test(`HTTP administrator ${edit ? 'edit' : 'add'} opens, loads form and reopens without randomUUID`, async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    try {
      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: bytes => bytes.fill(7) } });
      states = [];
      const props = { open: true, competitionId: 'competition', editData: edit ? { _id: 'entry', name: '选手', athleteNumber: 'AT-existing' } : null };
      render(props);
      assert.doesNotThrow(() => effects[0]());
      await Promise.resolve();
      const form = render(props);
      assert.equal(form.props.children[0].props.children, edit ? '编辑参赛者' : '添加参赛者');
      assert.ok(states.some(value => typeof value === 'string' && /^[0-9a-f]{8}-/.test(value)));
      if (edit) assert.ok(states.includes('AT-existing'));
      render({ ...props, open: false });
      assert.doesNotThrow(() => effects[0]());
      render(props);
      assert.doesNotThrow(() => effects[0]());
      await Promise.resolve();
      assert.doesNotThrow(() => render(props));
    } finally { Object.defineProperty(globalThis, 'crypto', descriptor); }
  });
}
