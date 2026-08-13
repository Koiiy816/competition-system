const mongoose = require('mongoose');

// Stores only the on-site award decision. Rankings themselves are calculated
// from live results, so recalculating scores never leaves stale award data.
const AwardConfirmationSchema = new mongoose.Schema({
  competition: { type: mongoose.Schema.Types.ObjectId, ref: 'Competition', required: true, index: true },
  awardKey: { type: String, required: true },
  recipientKey: { type: String, required: true },
  recipientName: { type: String, trim: true },
  status: {
    type: String,
    enum: ['pending', 'checked_in', 'forfeited', 'confirmed'],
    default: 'pending'
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

AwardConfirmationSchema.index({ competition: 1, awardKey: 1, recipientKey: 1 }, { unique: true });

module.exports = mongoose.model('AwardConfirmation', AwardConfirmationSchema);
