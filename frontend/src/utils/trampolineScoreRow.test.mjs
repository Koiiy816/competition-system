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
const compiled = new Module(filename);
compiled.filename = filename;
compiled.paths = createRequire(import.meta.url).resolve.paths('react');
const originalRequire = compiled.require.bind(compiled);
compiled.require = spec => spec.startsWith('../') ? {} : originalRequire(spec);
compiled._compile(transformed.code, filename);

const render = (hideParticipantName, judgeCount = 2) => renderToStaticMarkup(React.createElement('table', null,
  React.createElement('tbody', null, React.createElement(compiled.exports.ScoreRow, {
    participant: { _id: 'test', name: '不应显示的队员姓名', schoolName: '测试代表学校' },
    displayNameContent: '不应显示的队员姓名', hideParticipantName,
    judgeCount, scoringType: judgeCount === 7 ? 'large' : 'small', index: 0, isChiefOrAdmin: true, canEdit: true, checkInStatus: 'checked'
  }))));

test('蹦床操打分行只显示学校，不输出队员姓名，并仅渲染两个技术裁判输入', () => {
  const html = render(true);
  assert.ok(html.includes('测试代表学校'));
  assert.ok(!html.includes('不应显示的队员姓名'));
  // 两个裁判分数和一个裁判长扣分输入框。
  assert.equal((html.match(/<input\b/g) || []).length, 3);
});

test('其他项目打分行继续显示姓名和学校', () => {
  const html = render(false);
  assert.ok(html.includes('测试代表学校'));
  assert.ok(html.includes('不应显示的队员姓名'));
});

test('大网完整显示七个维度和一个裁判长扣分输入', () => {
  assert.equal((render(false, 7).match(/<input\b/g) || []).length, 8);
});
