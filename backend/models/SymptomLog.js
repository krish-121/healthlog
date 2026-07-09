const mongoose = require('mongoose');

const symptomLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  symptomTypes: [{
    type: String
  }],
  duration: {
    type: String,
  },
  activity: {
    type: String,
  },
  severity: {
    type: Number,
    min: 1,
    max: 10,
  },
  redFlags: [{
    type: String
  }],
  notes: {
    type: String,
  }
}, { timestamps: true });

module.exports = mongoose.model('SymptomLog', symptomLogSchema);
