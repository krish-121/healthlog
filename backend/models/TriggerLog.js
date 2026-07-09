const mongoose = require('mongoose');

const triggerLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  triggerType: {
    type: String,
    required: true,
  },
  severity: {
    type: Number,
    min: 1,
    max: 10,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  description: {
    type: String,
  }
}, { timestamps: true });

module.exports = mongoose.model('TriggerLog', triggerLogSchema);
