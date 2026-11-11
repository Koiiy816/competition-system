const assert = require('node:assert/strict');
const test = require('node:test');
const Competition = require('../models/Competition');
const Participant = require('../models/Participant');
const RegistrationDocument = require('../models/RegistrationDocument');
const controller = require('../controllers/participantController');

const response = () => ({ code: 0, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

const withStubs = async (run, competition = { _id: 'match', sportType: 'trampoline', status: 'registration' }) => {
  const originalCompetition = Competition.findById;
  const originalFindOne = RegistrationDocument.findOne;
  const originalUpdate = RegistrationDocument.findOneAndUpdate;
  const writes = [];
  Competition.findById = async () => competition;
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

test('registration document upload is unavailable outside trampoline competitions', () => withStubs(async ({ req, writes }) => {
  req.body.type = 'riskNotice';
  req.files = { files: [{ filename: 'risk.pdf', originalname: '告知书.pdf', mimetype: 'application/pdf', size: 100 }] };
  const res = response();
  await controller.uploadRegistrationDocuments(req, res, error => { throw error; });
  assert.equal(res.code, 403);
  assert.equal(res.body.message, '报名材料功能仅适用于蹦床赛事');
  assert.equal(writes.length, 0);
}, { _id: 'match', sportType: 'wushu', status: 'registration' }));

test('administrator overview groups trampoline material status by organization', async () => {
  const originalCompetition = Competition.findById;
  const originalDocumentFind = RegistrationDocument.find;
  const originalParticipantFind = Participant.find;
  Competition.findById = async () => ({ _id: 'match', sportType: 'trampoline' });
  RegistrationDocument.find = () => ({ populate: () => ({ lean: async () => [{
    user: { _id: 'unit-1', profile: { organization: '测试单位' } },
    attachments: [
      { type: 'riskNotice', participant: 'participant-1', filename: 'risk.pdf', originalName: '告知书.pdf' },
      { type: 'insurance', participant: 'participant-1', filename: 'insurance.pdf', originalName: '保险.pdf' }
    ]
  }] }) });
  Participant.find = () => ({ select: () => ({ lean: async () => [
    { _id: 'participant-1', user: 'unit-1', name: '张三', schoolName: '测试单位' },
    { _id: 'participant-2', user: 'unit-1', name: '李四', schoolName: '测试单位' }
  ] }) });
  try {
    const res = response();
    await controller.getRegistrationDocumentOverview({ user: { roles: ['admin'] }, params: { competitionId: 'match' } }, res, error => { throw error; });
    assert.equal(res.code, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].organization, '测试单位');
    assert.deepEqual(res.body.data[0].athletes[0].submittedTypes, ['riskNotice', 'insurance']);
    assert.deepEqual(res.body.data[0].athletes[1].submittedTypes, []);
  } finally {
    Competition.findById = originalCompetition;
    RegistrationDocument.find = originalDocumentFind;
    Participant.find = originalParticipantFind;
  }
});

test('administrator can remove an organization material archive', async () => {
  const originalCompetition = Competition.findById;
  const originalFindOne = RegistrationDocument.findOne;
  let deleted = false;
  Competition.findById = async () => ({ _id: 'match', sportType: 'trampoline' });
  RegistrationDocument.findOne = async () => ({
    riskNotice: { filename: 'legacy-risk.pdf' },
    attachments: [{ filename: 'insurance.pdf' }],
    deleteOne: async () => { deleted = true; }
  });
  try {
    const res = response();
    await controller.deleteRegistrationDocumentArchive({ params: { competitionId: 'match', userId: 'unit-1' } }, res, error => { throw error; });
    assert.equal(res.code, 200);
    assert.equal(deleted, true);
  } finally {
    Competition.findById = originalCompetition;
    RegistrationDocument.findOne = originalFindOne;
  }
});
