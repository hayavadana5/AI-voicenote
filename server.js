require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { connectDB } = require('./src/utils/database');
const { errorHandler, notFound } = require('./src/middleware/errorMiddleware');
const sessionRoutes = require('./src/routes/sessionRoutes');
const audioRoutes = require('./src/routes/audioRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Serve uploaded audio files statically
app.use('/audio', express.static(path.join(__dirname, 'uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/sessions', sessionRoutes);
app.use('/api', audioRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Voice Assistant API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`\n🚀 Voice Assistant API running on port ${PORT}`);
    console.log(`📡 Health: http://localhost:${PORT}/health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });
};

startServer();

module.exports = app;
