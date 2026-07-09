const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const TriggerLog = require('../models/TriggerLog');
const HeartLog = require('../models/HeartLog');
const DailyLog = require('../models/DailyLog');
const {
  getStrongestTrigger,
  getWorstCombination,
  getSymptomPattern
} = require('../utils/insights');

const router = express.Router();

router.use(authMiddleware);

// GET /api/insights – returns all three insight calculations
router.get('/', async (req, res) => {
  try {
    const [triggerLogs, heartLogs, dailyLogs] = await Promise.all([
      TriggerLog.find({ user: req.userId }).lean(),
      HeartLog.find({ user: req.userId }).lean(),
      DailyLog.find({ user: req.userId }).lean()
    ]);

    const strongestTrigger = getStrongestTrigger(triggerLogs, heartLogs);
    const worstCombination = getWorstCombination(triggerLogs, heartLogs);
    const symptomPattern = getSymptomPattern(dailyLogs, triggerLogs);

    res.json({
      strongestTrigger,
      worstCombination,
      symptomPattern
    });
  } catch (err) {
    console.error('Insight engine error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
