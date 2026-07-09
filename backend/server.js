const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const dailyRoutes = require('./routes/daily');
const triggerRoutes = require('./routes/trigger');
const heartRoutes = require('./routes/heart');
const insightRoutes = require('./routes/insights');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/daily', require('./routes/daily'));
app.use('/api/trigger', require('./routes/trigger'));
app.use('/api/heart', require('./routes/heart'));
app.use('/api/symptom', require('./routes/symptom'));
app.use('/api/insights', insightRoutes);

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Catch-all route to serve index.html for any unhandled paths (useful for SPA routing or general fallback)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
  });
