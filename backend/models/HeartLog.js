const mongoose = require('mongoose');

const heartLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  heartRate: {
    type: Number,
    required: true,
  },
  bloodPressureSys: {
    type: Number,
  },
  bloodPressureDia: {
    type: Number,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  }
}, { timestamps: true });

module.exports = mongoose.model('HeartLog', heartLogSchema);
