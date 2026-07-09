const express = require('express');
const TriggerLog = require('../models/TriggerLog');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

// GET logs sorted by newest
router.get('/', async (req, res) => {
  try {
    const logs = await TriggerLog.find({ user: req.userId }).sort({ timestamp: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// POST log a trigger
router.post('/', async (req, res) => {
  try {
    const { triggerType, severity, description, timestamp } = req.body;

    const log = new TriggerLog({
      user: req.userId,
      triggerType,
      severity,
      description,
      timestamp: timestamp ? new Date(timestamp) : Date.now()
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
    const log = await TriggerLog.findOneAndDelete({ _id: req.params.id, user: req.userId });
    
    if (!log) {
      return res.status(404).json({ message: 'Log not found' });
    }

    res.json({ message: 'Log deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
