const { createFixture } = require('./identityFixture');
const fs = require('fs');
const path = require('path');

createFixture(5088).then(async fixture => {
  const endpoint = `/competitions/${fixture.competition.id}/participants`;
  for (const event of ['拳术', '剑术', '双人拳']) {
    const result = await fixture.request(endpoint, { method: 'POST', body: {
      name: '张伟', schoolName: '联调武术馆', gender: 'male', birthDate: '2000-01-02',
      idCard: 'TEST-PASSPORT-1234', type: 'individual', event, ageGroup: 'A组', grade: 'A组', athleteRequestKey: 'browser-person-one'
    } });
    if (result.status !== 201) throw new Error(JSON.stringify(result.body));
  }
  await fixture.request(endpoint, { method: 'POST', body: {
    name: '张伟', schoolName: '联调武术馆', gender: 'female', birthDate: '2002-02-03',
    idCard: 'TEST-PASSPORT-5678', type: 'individual', event: '拳术', ageGroup: 'A组', grade: 'A组', athleteRequestKey: 'browser-person-two'
  } });
  for (const key of ['wushu_fee_summary_enabled', 'wushu_registration_edit_enabled']) {
    await fixture.request(`/settings/${key}`, { role: 'admin', method: 'PUT', body: { value: true } });
  }
  const info = { base: fixture.base, dbName: fixture.dbName, competitionId: fixture.competition.id };
  fs.writeFileSync(path.resolve(__dirname, '../../.tmp/identity-browser.json'), JSON.stringify(info, null, 2));
  console.log('BROWSER_FIXTURE_READY', JSON.stringify(info));
  process.on('SIGINT', async () => { await fixture.close(); process.exit(0); });
}).catch(error => { console.error(error); process.exit(1); });
