import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';

const filename = fileURLToPath(new URL('../components/participants/WushuFeeTable.jsx', import.meta.url));
const transformed = await transformWithEsbuild(fs.readFileSync(filename, 'utf8'), filename, { loader: 'jsx', format: 'cjs' });
const compiled = new Module(filename);
compiled.filename = filename;
compiled.paths = createRequire(import.meta.url).resolve.paths('react');
compiled._compile(transformed.code, filename);
const WushuFeeTable = compiled.exports.default;

test('merged table renders one person, every original project action, and fee in the final column', () => {
  const calls = [];
  const roster = [{ key: 'person', name: '陈光前', fee: 400, eventCount: 3,
    registrations: ['拳术', '剑术', '双人拳'].map((event, i) => ({ _id: `id-${i}`, event, status: 'approved', type: 'individual', gender: 'male' })) }];
  const html = renderToStaticMarkup(React.createElement(WushuFeeTable, { roster,
    renderActions: row => { calls.push(row._id); return React.createElement('button', { 'data-id': row._id }, '编辑'); },
    getStatusInfo: () => ({ name: '已通过' }), getGenderLabel: () => '男' }));
  assert.deepEqual(calls, ['id-0', 'id-1', 'id-2']);
  assert.equal((html.match(/>陈光前</g) || []).length, 1);
  for (const event of ['拳术', '剑术', '双人拳']) assert.ok(html.includes(event));
  assert.match(html, /会务费（元）/);
  assert.match(html, />400<\/p>/);
  assert.ok(html.lastIndexOf('400') > html.lastIndexOf('data-id="id-2"'));
});

test('empty roster renders no person and no editing action', () => {
  const html = renderToStaticMarkup(React.createElement(WushuFeeTable, { roster: [], renderActions: assert.fail }));
  assert.ok(!html.includes('<button'));
});

test('a second unit shows already counted with the complete personal fee instead of charging another base', () => {
  const html = renderToStaticMarkup(React.createElement(WushuFeeTable, {
    roster: [{ key: 'same-person', name: '跨单位选手', athleteNumber: 'AT-one', fee: 0, totalFee: 400,
      eventCount: 3, schoolCount: 2, billingSchoolName: '最早单位', isFeeBillingUnit: false, registrations: [] }],
    renderActions: assert.fail
  }));
  assert.ok(html.includes('已计费'));
  assert.ok(html.includes('个人合计400元'));
  assert.ok(html.includes('最早单位'));
});

test('project configuration flag controls the individual or collective label', () => {
  const roster = [{ key: 'person', name: '测试选手', fee: 300, eventCount: 2,
    registrations: [
      { _id: 'individual', event: '长拳', status: 'approved', isGroupEvent: false },
      { _id: 'collective', event: '武术操', status: 'approved', isGroupEvent: true }
    ] }];
  const html = renderToStaticMarkup(React.createElement(WushuFeeTable, { roster,
    renderActions: () => null, getStatusInfo: () => ({ name: '已通过' }), getGenderLabel: () => '-' }));

  assert.equal((html.match(/>个人</g) || []).length, 1);
  assert.equal((html.match(/>集体</g) || []).length, 1);
});
