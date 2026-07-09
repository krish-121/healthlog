const express = require('express');
const SymptomLog = require('../models/SymptomLog');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

// GET logs sorted by newest
router.get('/', async (req, res) => {
  try {
    const logs = await SymptomLog.find({ user: req.userId }).sort({ timestamp: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// POST log a symptom
router.post('/', async (req, res) => {
  try {
    const { timestamp, symptomTypes, duration, activity, severity, redFlags, notes } = req.body;

    const log = new SymptomLog({
      user: req.userId,
      timestamp: timestamp ? new Date(timestamp) : Date.now(),
      symptomTypes: symptomTypes || [],
      duration,
      activity,
      severity,
      redFlags: redFlags || [],
      notes
    });

    await log.save();
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// DELETE a log
router.delete('/:id', async (req, res) => {
  try {
    const log = await SymptomLog.findOneAndDelete({ _id: req.params.id, user: req.userId });

    if (!log) {
      return res.status(404).json({ message: 'Log not found' });
    }

    res.json({ message: 'Log deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
