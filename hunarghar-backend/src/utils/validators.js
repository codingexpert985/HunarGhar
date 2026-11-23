'use strict';
const { badRequest } = require('./AppError');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isUUID = (v) => typeof v === 'string' && UUID_RE.test(v);
const isEmail = (v) => typeof v === 'string' && v.length <= 100 && EMAIL_RE.test(v);

/** Collects field errors and throws one 400 error that names every problem (SFR-02, SFR-51). */
class Validator {
  constructor() { this.errors = {}; }
  add(field, msg) { if (!this.errors[field]) this.errors[field] = msg; return this; }
  required(field, value, label = field) {
    if (value === undefined || value === null || String(value).trim() === '') this.add(field, `${label} is required`);
    return this;
  }
  check() {
    const fields = Object.keys(this.errors);
    if (fields.length) {
      throw badRequest(fields.map((f) => this.errors[f]).join('; '), this.errors);
    }
  }
}

function requireUUID(value, label = 'id') {
  if (!isUUID(value)) throw badRequest(`${label} must be a valid UUID`);
  return value;
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');

/** Express param validator: router.param('id', uuidParam) */
function uuidParam(req, res, next, value, name) {
  if (!isUUID(value)) return next(badRequest(`${name} must be a valid UUID`));
  next();
}

module.exports = { Validator, isUUID, isEmail, requireUUID, uuidParam, str };
