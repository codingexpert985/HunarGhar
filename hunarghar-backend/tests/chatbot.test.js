'use strict';
// Run with:  npm test     (needs no database - tests the chatbot and NLP only)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const bot = require('../src/chatbot/chatbot');
const { scrubPersonalInfo } = require('../src/chatbot/nlp');

const fakeFind = async ({ category }) => (category === 'Tailoring' ? [{ name: 'Ayesha', city: 'Karachi' }] : []);

test('model file exists (run npm run train:chatbot first)', () => {
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'src', 'chatbot', 'model.json')));
});

test('answers a project FAQ: payment is simulated', async () => {
  const r = await bot.reply('is the payment real money?');
  assert.strictEqual(r.intent, 'payment');
  assert.match(r.reply, /simulated/i);
});

test('every answer carries the not-a-guarantee disclaimer (SFR-47)', async () => {
  for (const q of ['hello', 'how do i book a service', 'blah blah xyz']) {
    const r = await bot.reply(q);
    assert.match(r.disclaimer, /not a guarantee/i);
  }
});

test('matches a service request with city and budget (FR-40)', async () => {
  const r = await bot.reply('I need a tailor in Karachi under 3000 rs', { findProviders: fakeFind });
  assert.strictEqual(r.type, 'service_match');
  assert.strictEqual(r.suggestions.category, 'Tailoring');
  assert.strictEqual(r.suggestions.city, 'Karachi');
  assert.strictEqual(r.suggestions.maxPrice, 3000);
  assert.strictEqual(r.suggestions.providers.length, 1);
});

test('understands Roman Urdu service requests', async () => {
  const r = await bot.reply('mujhe tuition chahiye', { findProviders: fakeFind });
  assert.strictEqual(r.suggestions.category, 'Tutoring');
});

test('falls back politely for out-of-scope questions (FR-41)', async () => {
  for (const q of ['what is the capital of france', 'tell me a joke', 'asdfgh']) {
    const r = await bot.reply(q);
    assert.strictEqual(r.type, 'fallback', q);
    assert.ok(r.manualSearch);
  }
});

test('personal information is removed before processing (SFR-48)', () => {
  const clean = scrubPersonalInfo('call 03001234567 or mail sara@example.com for a tutor');
  assert.ok(!/03001234567/.test(clean) && !/@/.test(clean));
});

test('trained model reaches >= 90% on held-out questions', () => {
  const NB = require('../src/chatbot/naiveBayes');
  const model = NB.fromJSON(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'chatbot', 'model.json'), 'utf8')));
  const tests = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'chatbot', 'data', 'test_questions.json'), 'utf8'));
  const ok = tests.filter(([q, label]) => model.predict(q).ranked[0].label === label).length;
  assert.ok(ok / tests.length >= 0.9, `accuracy ${(ok / tests.length * 100).toFixed(1)}%`);
});
