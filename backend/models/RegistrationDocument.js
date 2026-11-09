const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true }
}, { _id: false });

const attachmentSchema = new mongoose.Schema({
  type: { type: String, enum: ['riskNotice', 'insurance', 'paperRegistrationForm'], required: true },
  participant: { type: mongoose.Schema.Types.ObjectId, ref: 'Participant', required: false },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: true });

// 每份材料独立保存；可关联某位运动员，也兼容早期的一份单位材料。
const RegistrationDocumentSchema = new mongoose.Schema({
  competition: { type: mongoose.Schema.Types.ObjectId, ref: 'Competition', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  riskNotice: { type: fileSchema, required: false },
  insurance: { type: fileSchema, required: false },
  paperRegistrationForm: { type: fileSchema, required: false },
  attachments: { type: [attachmentSchema], default: [] }
}, { timestamps: true });

RegistrationDocumentSchema.index({ competition: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('RegistrationDocument', RegistrationDocumentSchema);
