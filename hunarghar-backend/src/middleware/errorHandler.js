'use strict';
const { AppError } = require('../utils/AppError');

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  if (err instanceof AppError) { /* already shaped */ }
  else if (err.code === '23505') { status = 409; message = 'A record with these details already exists'; }       // unique violation
  else if (err.code === '23503') { status = 400; message = 'A referenced record does not exist'; }              // foreign key
  else if (err.code === '22P02') { status = 400; message = 'Invalid identifier or value format'; }              // bad uuid/enum
  else if (err.code === '23514') { status = 400; message = 'A value is outside the allowed range'; }            // check constraint
  else if (err.type === 'entity.parse.failed') { status = 400; message = 'Request body is not valid JSON'; }
  else if (err.name === 'MulterError') {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large' : err.message;
  } else if (status === 500) {
    console.error('[error]', err);
    message = 'Something went wrong on the server';
    details = undefined;
  }
  res.status(status).json({ success: false, message, ...(details ? { details } : {}) });
}

module.exports = { notFoundHandler, errorHandler };
