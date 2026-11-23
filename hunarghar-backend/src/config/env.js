'use strict';
require('dotenv').config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 5000,
  PUBLIC_URL: process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`,
  CLIENT_URLS: (process.env.CLIENT_URL || 'http://localhost:3000').split(',').map((s) => s.trim()),
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hunarghar',
  DB_SSL: String(process.env.DB_SSL).toLowerCase() === 'true',
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  MIN_PASSWORD_LENGTH: Number(process.env.MIN_PASSWORD_LENGTH) || 8,
  BCRYPT_ROUNDS: 10,
  CLOUDINARY: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  },
  MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB) || 5
};
env.CLOUDINARY_ENABLED = Boolean(env.CLOUDINARY.cloud_name && env.CLOUDINARY.api_key && env.CLOUDINARY.api_secret);

if (!env.JWT_SECRET || env.JWT_SECRET.length < 16) {
  if (env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set (16+ characters) in production');
  }
  env.JWT_SECRET = 'dev-only-insecure-secret-change-me';
  console.warn('[config] JWT_SECRET missing/short - using an insecure development secret.');
}

module.exports = env;
