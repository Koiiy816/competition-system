const { randomUUID } = require('crypto');
const mongoose = require('mongoose');

// 仅用于独立本地数据库联调，不读取或覆盖实际部署的数据库地址。
async function createFixture(port = 0) {
  process.env.JWT_SECRET = randomUUID();
  process.env.JWT_EXPIRE = '2h';
  process.env.NODE_ENV = port ? 'production' : 'test';
  const dbName = `athlete_identity_test_${randomUUID().replaceAll('-', '')}`;
  const uri = `mongodb://127.0.0.1:27188/${dbName}`;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  try {
  const User = require('../models/User');
  const Competition = require('../models/Competition');
  const Participant = require('../models/Participant');
  const AthleteIdentity = require('../models/AthleteIdentity');
  await Promise.all([User.init(), Participant.init(), AthleteIdentity.init()]);
  const password = 'IdentityTest2026!';
  const users = {};
  for (const role of ['admin', 'organization', 'other']) {
    users[role] = await User.create({ name: `联调${role}`, email: `${role}@identity.example.com`, password,
      roles: [role === 'other' ? 'organization' : role], sportTypes: ['wushu'], profile: { organization: '联调武术馆' } });
  }
  const competition = await Competition.create({ name: '参赛者编号联调赛事', description: '独立测试库，不含真实报名数据',
    sportType: 'wushu', type: '武术', status: 'registration', organizer: users.admin._id, location: '测试场馆',
    startDate: new Date(Date.now() + 86400000 * 30), endDate: new Date(Date.now() + 86400000 * 31),
    registrationDeadline: new Date(Date.now() + 86400000 * 20), ageGroups: [{ name: 'A组' }],
    participantRequirements: { requirePhoto: false, requireStudentInfoDetails: false },
    events: ['拳术', '剑术', '双人拳', '刀术'].map(name => ({ name, category: '武术' })) });
  const app = require('../app');
  const server = await new Promise(resolve => { const server = app.listen(port, '127.0.0.1', () => resolve(server)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, { role = 'organization', method = 'GET', body } = {}) => {
    const response = await fetch(`${base}/api${path}`, { method, headers: { 'Content-Type': 'application/json',
      Authorization: `Bearer ${users[role].getSignedJwtToken()}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const close = async () => {
    await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name !== dbName || !dbName.startsWith('athlete_identity_test_')) throw new Error('拒绝清理非测试数据库');
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  };
  return { mongoose, uri, dbName, users, password, competition, Participant, AthleteIdentity, base, request, close };
  } catch (error) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    throw error;
  }
}
module.exports = { createFixture };
