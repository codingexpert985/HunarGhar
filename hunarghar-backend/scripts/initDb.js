'use strict';
/** Creates all tables.   npm run db:init     |   npm run db:reset  (drops everything first) */
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

const DROP = `
DROP TABLE IF EXISTS revoked_tokens, reports, verification_requests, reviews, payments, messages,
  bookings, portfolio_images, services, provider_profiles, categories, users CASCADE;
DROP TYPE IF EXISTS user_role, verification_status, booking_status, mock_payment_status, request_status, report_status CASCADE;`;

(async () => {
  try {
    if (process.argv.includes('--reset')) {
      await pool.query(DROP);
      console.log('Dropped existing tables.');
    }
    const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
    await pool.query(sql);
    console.log('Database schema created successfully.');
  } catch (e) {
    console.error('Could not create schema:', e.message);
    console.error('Check DATABASE_URL in .env and that PostgreSQL is running.');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
