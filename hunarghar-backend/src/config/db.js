'use strict';
const { Pool, types } = require('pg');
const env = require('./env');

// return NUMERIC as JS numbers and BIGINT (COUNT) as numbers instead of strings
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
  max: 10
});

pool.on('error', (err) => console.error('[db] unexpected pool error', err.message));

const query = (text, params) => pool.query(text, params);

/** Run several queries atomically. fn receives a client with .query() */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
