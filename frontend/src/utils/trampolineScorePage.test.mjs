import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Module, createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';

const filename = fileURLToPath(new URL('../pages/CompetitionScoreEntryPage.jsx', import.meta.url));
const transformed = await transformWithEsbuild(fs.readFileSync(filename, 'utf8'), filename, { loader: 'jsx', format: 'cjs' });
let states = [];
let cursor = 0;
const compiled = new Module(filename);
compiled.filename = filename;
compiled.paths = createRequire(import.meta.url).resolve.paths('react');
const originalRequire = compiled.require.bind(compiled);
compiled.require = spec => {
  if (spec === 'react') return { ...React, useMemo: fn => fn(), useEffect: () => {}, useState: initial => {
    const index = cursor++;
    if (!Object.hasOwn(states, index)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  } };
  if (spec === 'react-router-dom') return { useParams: () => ({ id: 'competition', scheduleId: 'schedule' }), useNavigate: () => () => {}, useSearchParams: () => [new URLSearchParams()] };
  if (spec.includes('AuthContext')) return { useAuth: () => ({ user: { roles: ['admin'] } }) };
  if (spec.includes('PrintPreviewModal')) return () => null;
  if (spec.includes('/services/')) return {};
  return originalRequire(spec);
};
compiled._compile(transformed.code, filename);

const renderPage = (name, participants) => {
  cursor = 0;
  states = [false, { _id: 'schedule', name, status: 'ongoing', scoringMode: 'standard' },
    { sportType: 'trampoline' }, participants, {}, '', { _id: 'next', name: '混合集体 小网小学组 小网小学组蹦床操' }];
  return renderToStaticMarkup(compiled.exports.default());
};

test('小网评分整页显示三个输入，未检录时禁用、已检录时可输入，标题与导航不重复', () => {
  for (const checked of [false, true]) {
    const html = renderPage('小网U9组 小网U9组男子蹦床个人', [{ _id: 'athlete', name: '选手', schoolName: '单位', checkInStatus: checked ? 'checked' : 'not_checked' }]);
    const inputs = html.match(/<input\b[^>]*>/g) || [];
    assert.equal(inputs.length, 3);
    assert.equal(inputs.filter(input => /\bdisabled=/.test(input)).length, checked ? 0 : 3);
    assert.ok(html.includes('U9组 小网男子个人'));
    assert.ok(html.includes('小学组 蹦床操'));
    assert.ok(!html.includes('小网U9组男子蹦床个人'));
  }
});

test('大网整页显示两套共16个评分输入，蹦床操显示三个评分输入', () => {
  const participant = { _id: 'athlete', schoolName: '单位', checkInStatus: 'checked' };
  const html = renderPage('大网U10组 男子 大网U10组蹦床个人', [participant]);
  assert.equal((html.match(/<input\b/g) || []).length, 16);
  assert.ok(!html.includes('动作表难度'));
  assert.ok(!html.includes('待补录'));
  assert.ok(html.includes('D分') && html.includes('难度'));
  assert.equal((renderPage('混合集体 小网小学组 小网小学组蹦床操', [participant]).match(/<input\b/g) || []).length, 3);
});

test('空场次显示缺少名单的原因和重新加载入口，避免只剩表头', () => {
  const html = renderPage('小网U9组 小网U9组男子蹦床个人', []);
  assert.ok(html.includes('本场赛程暂无参赛者'));
  assert.ok(html.includes('重新加载'));
});
