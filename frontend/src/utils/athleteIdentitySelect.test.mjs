import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Module, createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { transformWithEsbuild } from 'vite';

const filename = fileURLToPath(new URL('../components/participants/AthleteIdentitySelect.jsx', import.meta.url));
const transformed = await transformWithEsbuild(fs.readFileSync(filename, 'utf8'), filename, { loader: 'jsx', format: 'cjs' });

function fixture(fail = false) {
  let states = [], dependencies = [], index = 0, effects = [];
  const requests = [], ready = [];
  const identity = { number: 'AT-original', name: '选手', schoolName: '原单位', maskedIdCard: '****1234' };
  const compiled = new Module(filename);
  compiled.filename = filename;
  compiled.paths = createRequire(import.meta.url).resolve.paths('react');
  const originalRequire = compiled.require.bind(compiled);
  compiled.require = spec => {
    if (spec === 'react') return { ...React,
      useState: initial => {
        const slot = index++;
        if (!Object.hasOwn(states, slot)) states[slot] = initial;
        return [states[slot], value => { states[slot] = value; }];
      },
      useEffect: (effect, deps) => {
        const slot = index++;
        if (!dependencies[slot] || deps.some((value, i) => value !== dependencies[slot][i])) effects.push(effect);
        dependencies[slot] = deps;
      }
    };
    if (spec.includes('services/api')) return { get: async (...args) => {
      requests.push(args);
      if (fail) throw new Error('offline');
      return { data: { data: [identity] } };
    } };
    return originalRequire(spec);
  };
  compiled._compile(transformed.code, filename);
  const onReady = value => ready.push(value);
  const render = schoolName => {
    index = 0; effects = [];
    const tree = compiled.exports.default({ competitionId: 'competition', schoolName, value: identity.number, onReady, onChange() {} });
    effects.forEach(effect => effect());
    return tree;
  };
  return { requests, ready, render };
}

test('changing unit keeps the original athlete selectable without refetching by unit', async () => {
  const f = fixture();
  f.render('原单位');
  await new Promise(resolve => setImmediate(resolve));
  f.render('原单位');
  assert.equal(f.ready.at(-1), true);
  f.render('新单位');
  assert.equal(f.ready.at(-1), true);
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0][0], '/competitions/competition/participants/athlete-identities');
  assert.equal(f.requests[0][1]?.params?.schoolName, undefined);
});

test('identity lookup failure still blocks submission instead of assuming an existing number is valid', async () => {
  const f = fixture(true);
  f.render('原单位');
  await new Promise(resolve => setImmediate(resolve));
  f.render('原单位');
  assert.equal(f.ready.at(-1), false);
});
