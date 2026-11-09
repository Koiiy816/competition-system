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
  RegistrationDocument.findOneAndUpdate = async (...args) => { writes.push(args); return { attachments: args[1].$push.attachments.$each }; };
  const req = {
    user: { id: 'unit', roles: ['organization'], sportTypes: ['trampoline'] },
    params: { competitionId: 'match' },
    files: {}, body: {}
  };
  try { await run({ req, writes }); }
  finally {
    Competition.findById = originalCompetition;
    RegistrationDocument.findOne = originalFindOne;
    RegistrationDocument.findOneAndUpdate = originalUpdate;
  }
};

test('registration documents append each uploaded file instead of overwriting earlier files', () => withStubs(async ({ req, writes }) => {
  req.body.type = 'riskNotice';
  req.files = {
    files: [
      { filename: 'risk.pdf', originalname: '盖章告知书.pdf', mimetype: 'application/pdf', size: 100 },
      { filename: 'risk-2.pdf', originalname: '第二份告知书.pdf', mimetype: 'application/pdf', size: 200 }
    ]
  };
  const res = response();
  await controller.uploadRegistrationDocuments(req, res, error => { throw error; });
  assert.equal(res.code, 200);
  assert.equal(writes.length, 1);
  const attachments = writes[0][1].$push.attachments.$each;
  assert.equal(attachments.length, 2);
  assert.equal(attachments[0].type, 'riskNotice');
  assert.equal(attachments[0].originalName, '盖章告知书.pdf');
  assert.equal(attachments[1].originalName, '第二份告知书.pdf');
}));

test('unit registration document endpoint rejects an empty upload request', () => withStubs(async ({ req, writes }) => {
  const res = response();
  await controller.uploadRegistrationDocuments(req, res, error => { throw error; });
  assert.equal(res.code, 400);
  assert.equal(writes.length, 0);
}));
