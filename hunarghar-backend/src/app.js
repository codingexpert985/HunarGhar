'use strict';
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const db = require('./config/db');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { UPLOAD_DIR } = require('./services/upload');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, cb) => (!origin || env.CLIENT_URLS.includes(origin) || env.NODE_ENV !== 'production'
    ? cb(null, true) : cb(new Error('Origin not allowed by CORS'))),
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' } });
const botLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many chatbot requests. Please slow down.' } });

app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, '..', 'public')));       // demo page at "/"

app.get('/api/health', async (req, res) => {
  try { await db.query('SELECT 1'); res.json({ success: true, status: 'ok', database: 'connected', time: new Date().toISOString() }); }
  catch (e) { res.status(503).json({ success: false, status: 'degraded', database: 'unreachable' }); }
});

app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/providers', require('./routes/providers'));
app.use('/api/services', require('./routes/services'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/verification', require('./routes/verification'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/chatbot', botLimiter, require('./routes/chatbot'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
