const assert = require('node:assert/strict');
const test = require('node:test');
const Competition = require('../models/Competition');
const RegistrationDocument = require('../models/RegistrationDocument');
const controller = require('../controllers/participantController');

const response = () => ({ code: 0, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

const withStubs = async (run) => {
  const originalCompetition = Competition.findById;
  const originalFindOne = RegistrationDocument.findOne;
  const originalUpdate = RegistrationDocument.findOneAndUpdate;
  const writes = [];
  Competition.findById = async () => ({ _id: 'match', sportType: 'trampoline', status: 'registration' });
  RegistrationDocument.findOne = async () => null;
  RegistrationDocument.findOneAndUpdate = async (...args) => { writes.push(args); return { ...args[1].$set }; };
  const req = {
    user: { id: 'unit', roles: ['organization'], sportTypes: ['trampoline'] },
    params: { competitionId: 'match' },
    files: {}
  };
  try { await run({ req, writes }); }
  finally {
    Competition.findById = originalCompetition;
    RegistrationDocument.findOne = originalFindOne;
    RegistrationDocument.findOneAndUpdate = originalUpdate;
  }
};

test('optional unit registration documents save the selected risk notice and insurance files', () => withStubs(async ({ req, writes }) => {
  req.files = {
    riskNotice: [{ filename: 'risk.pdf', originalname: '盖章告知书.pdf', mimetype: 'application/pdf', size: 100 }],
    insurance: [{ filename: 'insurance.jpg', originalname: '比赛保险.jpg', mimetype: 'image/jpeg', size: 200 }],
    paperRegistrationForm: [{ filename: 'form.pdf', originalname: '纸质报名表.pdf', mimetype: 'application/pdf', size: 300 }]
  };
  const res = response();
  await controller.uploadRegistrationDocuments(req, res, error => { throw error; });
  assert.equal(res.code, 200);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0][1].$set.riskNotice, { filename: 'risk.pdf', originalName: '盖章告知书.pdf', mimetype: 'application/pdf', size: 100 });
  assert.deepEqual(writes[0][1].$set.insurance, { filename: 'insurance.jpg', originalName: '比赛保险.jpg', mimetype: 'image/jpeg', size: 200 });
  assert.deepEqual(writes[0][1].$set.paperRegistrationForm, { filename: 'form.pdf', originalName: '纸质报名表.pdf', mimetype: 'application/pdf', size: 300 });
}));

test('unit registration document endpoint rejects an empty upload request', () => withStubs(async ({ req, writes }) => {
  const res = response();
  await controller.uploadRegistrationDocuments(req, res, error => { throw error; });
  assert.equal(res.code, 400);
  assert.equal(writes.length, 0);
}));
