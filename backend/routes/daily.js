const express = require('express');
const DailyLog = require('../models/DailyLog');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

// GET logs
router.get('/', async (req, res) => {
  try {
    const logs = await DailyLog.find({ user: req.userId }).sort({ date: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// POST or update log for a specific date
router.post('/', async (req, res) => {
  try {
    const { date, notes, mood } = req.body;

    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }

    // Convert date string to a Date object, maybe normalize it to midnight to avoid time issues?
    // We'll trust the client sends a consistent Date format for the day (e.g. YYYY-MM-DD).
    const logDate = new Date(date);

    const log = await DailyLog.findOneAndUpdate(
      { user: req.userId, date: logDate },
      { $set: { notes, mood } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
