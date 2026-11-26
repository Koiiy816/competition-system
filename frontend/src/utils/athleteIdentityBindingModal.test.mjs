import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const filename = fileURLToPath(new URL('../components/participants/AddParticipantModal.jsx', import.meta.url));
const source = fs.readFileSync(filename, 'utf8');

test('管理员编辑蹦床和跳水报名时显示并提交参赛者编号关联', () => {
  assert.match(source, /\['wushu', 'trampoline', 'diving'\]/);
  assert.match(source, /editData \|\| getSportType\(competition\) === 'wushu'/);
  assert.match(source, /canManageAthleteIdentity && !identityReady/);
  assert.match(source, /canManageAthleteIdentity \? \{ athleteNumber, athleteRequestKey/);
  assert.match(source, /\{canManageAthleteIdentity && <Grid item xs=\{12\}><AthleteIdentitySelect/);
});
