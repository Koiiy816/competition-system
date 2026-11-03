// Run: node test/registrationEdit.integration.js <absolute path to mongod>
// Starts its own temporary database; never loads application environment or production data.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const Participant = require('../models/Participant');
const Competition = require('../models/Competition');
const User = require('../models/User');
const SystemSetting = require('../models/SystemSetting');

async function main() {
  assert.ok(process.argv[2], 'Pass the mongod executable path');
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const directory = await mkdtemp(path.join(os.tmpdir(), 'registration-edit-test-'));
  const database = spawn(process.argv[2], ['--dbpath', directory, '--port', String(port), '--bind_ip', '127.0.0.1'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let server;
  try {
    await new Promise((resolve, reject) => {
      let startupLog = '';
      const timer = setTimeout(() => reject(new Error('Test database did not start')), 20000);
      database.once('error', error => { clearTimeout(timer); reject(error); });
      database.once('exit', code => { clearTimeout(timer); reject(new Error('Test database exited: ' + code + '\n' + startupLog)); });
      database.stdout.on('data', data => { startupLog = (startupLog + String(data)).slice(-6000); if (String(data).includes('Waiting for connections')) { clearTimeout(timer); resolve(); } });
      database.stderr.resume();
    });
    await mongoose.connect(`mongodb://127.0.0.1:${port}/registration_edit_test`);
    await Promise.all([Participant.init(), SystemSetting.init()]);
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    const admin = new mongoose.Types.ObjectId();
    const unit = new mongoose.Types.ObjectId();
    const other = new mongoose.Types.ObjectId();
    await User.collection.insertMany([{ _id: admin, email: 'admin@test.invalid', roles: ['admin'] }, { _id: unit, email: 'unit@test.invalid', roles: ['organization'] }, { _id: other, email: 'other@test.invalid', roles: ['organization'] }]);
    const competitionId = new mongoose.Types.ObjectId();
    await Competition.collection.insertOne({ _id: competitionId, name: '测试武术', type: '武术', sportType: 'wushu', status: 'registration', registrationDeadline: new Date(Date.now() + 86400000), ageGroups: [{ name: 'A' }], events: [{ name: '拳术' }, { name: '剑术', category: '器械' }] });
    const entry = await Participant.create({ user: unit, competition: competitionId, name: '测试选手', schoolName: '测试单位', gender: 'male', type: 'individual', event: '拳术', grade: 'A', status: 'approved', additionalInfo: { preserved: '保留' } });
    const app = express();
    app.use(express.json());
    app.use('/api/settings', require('../routes/settings'));
    app.use('/api/competitions/:competitionId/participants', require('../routes/participants'));
    app.use((error, req, res, next) => res.status(res.statusCode >= 400 ? res.statusCode : 500).json({ message: error.message }));
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (url, user, body, method = 'PUT') => {
      const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: 'Bearer ' + jwt.sign({ id: String(user) }, process.env.JWT_SECRET) } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { code: res.status, body: await res.json() };
    };
    const settingUrl = '/api/settings/wushu_registration_edit_enabled';
    const entryUrl = `/api/competitions/${competitionId}/participants/${entry._id}`;
    const editUrl = entryUrl + '/registration-content';
    const data = { event: '剑术', ageGroup: 'A', groupTeam: '', eventDetail: '说明', updatedAt: entry.updatedAt.toISOString() };
    assert.equal((await request(editUrl, null, data)).code, 401);
    assert.equal((await request(settingUrl, unit, { value: true })).code, 403);
    assert.equal((await request(settingUrl, admin, { value: 'true' })).code, 400);
    assert.equal((await request(editUrl, unit, data)).code, 403);
    assert.equal((await request(settingUrl, admin, { value: true })).code, 200);
    assert.equal((await request(editUrl, other, data)).code, 403);
    assert.equal((await request(editUrl, unit, { ...data, status: 'approved' })).code, 400);
    assert.equal((await request(editUrl, unit, data)).code, 200);
    const saved = await Participant.findById(entry._id);
    assert.equal(saved.event, '剑术');
    assert.equal(saved.status, 'pending');
    assert.equal(saved.additionalInfo.preserved, '保留');
    assert.equal(saved.additionalInfo.eventDetail, '说明');
    assert.equal(saved.registrationNumber, entry.registrationNumber);
    assert.equal(saved.user.toString(), unit.toString());
    assert.equal((await request(editUrl, unit, data)).code, 409);
    assert.equal((await request(settingUrl, admin, { value: false })).code, 200);
    assert.equal((await request(editUrl, unit, { ...data, updatedAt: saved.updatedAt.toISOString() })).code, 403);
    assert.equal((await request(entryUrl, unit, { event: '拳术' })).code, 403);
    assert.equal((await request(entryUrl, admin, { remark: '管理员仍可修改' })).code, 200);
    const newEntry = await request(`/api/competitions/${competitionId}/participants`, unit, { name: '另一选手', schoolName: '测试单位', gender: 'male', idCard: 'TEST-002', type: 'individual', event: '拳术', grade: 'A' }, 'POST');
    assert.equal(newEntry.code, 201);
    assert.equal((await request(`/api/competitions/${competitionId}/participants/${newEntry.body.data._id}/approve`, admin, {})).code, 200);
    assert.equal((await request(`/api/competitions/${competitionId}/participants/me`, unit, undefined, 'GET')).code, 200);
    assert.equal((await request(entryUrl, unit, undefined, 'DELETE')).code, 200);
    assert.equal(await Participant.findById(entry._id), null);
    console.log('PASS: real HTTP authentication, admin switch, validation, MongoDB persistence, stale-version conflict, legacy bypass, admin edit, list and delete regression');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    if (database.exitCode === null) {
      database.kill();
      await new Promise(resolve => database.once('exit', resolve));
    }
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('registration-edit-test-'));
    await rm(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
