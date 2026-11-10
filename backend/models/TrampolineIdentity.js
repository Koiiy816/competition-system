const mongoose = require('mongoose');

// 仅供蹦床报名使用；证件号码归一化后的哈希作为唯一键，不重复存储证件明文。
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true, maxlength: 10000 },
  gender: { type: String, required: true, enum: ['male', 'female'] },
  birthDate: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TrampolineIdentity', schema);
