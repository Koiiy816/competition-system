import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Module, createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';

const filename = fileURLToPath(new URL('../layouts/MainLayout.jsx', import.meta.url));
const transformed = await transformWithEsbuild(fs.readFileSync(filename, 'utf8'), filename, { loader: 'jsx', format: 'cjs' });
const compiled = new Module(filename);
compiled.filename = filename;
compiled.paths = createRequire(import.meta.url).resolve.paths('react');
const originalRequire = compiled.require.bind(compiled);
let roles = [];
compiled.require = spec => {
  if (spec === 'react-router-dom') return {
    Outlet: () => null, useNavigate: () => () => {}, useLocation: () => ({ pathname: '/trampoline-difficulties', search: '?workspace=trampoline' }),
    Link: React.forwardRef(({ to, ...props }, ref) => React.createElement('a', { ...props, href: to, ref }))
  };
  if (spec.includes('AuthContext')) return { useAuth: () => ({ isAuthenticated: true,
    user: { name: '测试账号', roles, sportTypes: ['trampoline'] }, logout: () => {} }) };
  if (spec.includes('participantService')) return {};
  if (spec.includes('competitionType')) return { isDivingCompetition: () => false };
  return originalRequire(spec);
};
compiled._compile(transformed.code, filename);

for (const role of ['admin', 'organization', 'referee', 'chief_referee']) {
  test(`${role}：动作表仅管理员可见，蹦床难度表入口保留`, () => {
    roles = [role];
    const html = renderToStaticMarkup(React.createElement(compiled.exports.default));
    assert.equal(html.includes('补录蹦床动作表'), role === 'admin');
    assert.ok(html.includes('蹦床难度系数表'));
  });
}
