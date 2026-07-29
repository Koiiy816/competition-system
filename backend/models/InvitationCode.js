const mongoose = require('mongoose');

const invitationCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
  },
  role: {
    type: String,
    required: true,
    enum: ['admin', 'referee', 'chief_referee'],
  },
  isUsed: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '7d', // The invitation code will expire in 7 days
  },
});

module.exports = mongoose.model('InvitationCode', invitationCodeSchema);