'use strict';
const fs = require('fs');
const path = require('path');
const NaiveBayes = require('./naiveBayes');
const { tokenize, scrubPersonalInfo } = require('./nlp');
const { PRICE_MIN, PRICE_MAX } = require('../config/constants');

const CONFIDENCE_THRESHOLD = 0.45;   // min probability of the top intent
const MIN_KNOWN_RATIO = 0.5;         // min share of words the model has seen in training
const DISCLAIMER =
  'Note: these are automated suggestions, not a guarantee of provider quality, availability or safety.';

const intentsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'intents.json'), 'utf8'));
const intentByTag = Object.fromEntries(intentsData.intents.map((i) => [i.tag, i]));

let model = null;
function loadModel() {
  if (model) return model;
  const file = path.join(__dirname, 'model.json');
  if (!fs.existsSync(file)) {
    throw new Error('Chatbot model not found. Run:  npm run train:chatbot');
  }
  model = NaiveBayes.fromJSON(JSON.parse(fs.readFileSync(file, 'utf8')));
  return model;
}

/** Pull a Pakistani city and a maximum budget out of the message. */
function extractEntities(text) {
  const lower = text.toLowerCase();
  const city = intentsData.cities.find((c) => new RegExp('\\b' + c.toLowerCase() + '\\b').test(lower)) || null;
  let maxPrice = null;
  const m =
    lower.match(/(?:under|below|less than|within|upto|up to|max(?:imum)?|budget(?: of)?)\s*(?:rs\.?|pkr)?\s*(\d{3,6})/) ||
    lower.match(/(\d{3,6})\s*(?:rs|pkr|rupees)/);
  if (m) maxPrice = Number(m[1]);
  // remove the entities so they do not confuse the classifier
  let cleaned = lower;
  if (city) cleaned = cleaned.replace(new RegExp('\\b' + city.toLowerCase() + '\\b', 'g'), ' ');
  cleaned = cleaned.replace(/(?:under|below|less than|within|upto|up to|max(?:imum)?|budget(?: of)?)?\s*(?:rs\.?|pkr)?\s*\d{3,6}\s*(?:rs|pkr|rupees)?/g, ' ');
  return { city, maxPrice, cleaned: cleaned.replace(/\s+/g, ' ').trim() };
}

/**
 * Main entry point.
 * @param {string} message  raw user text
 * @param {object} deps     { findProviders({category, city, maxPrice, limit}) => Promise<Provider[]> }
 */
async function reply(message, deps = {}) {
  const safeText = scrubPersonalInfo(message);           // SFR-48: never use personal info
  const base = { disclaimer: DISCLAIMER, manualSearch: '/search' };

  if (!safeText) {
    return { ...base, type: 'fallback', intent: null, confidence: 0,
      reply: 'Please type what you need, for example "I need a tutor in Lahore", or ask me about HunarGhar.' };
  }

  let { city, maxPrice, cleaned } = extractEntities(safeText);
  let priceNote = '';
  if (maxPrice != null && maxPrice < PRICE_MIN) {
    priceNote = ` Note: services on HunarGhar start at PKR ${PRICE_MIN}, so I searched without a budget limit.`;
    maxPrice = null;
  } else if (maxPrice != null && maxPrice > PRICE_MAX) {
    priceNote = ` Note: services on HunarGhar cost at most PKR 9,000, so I used that as the limit.`;
    maxPrice = PRICE_MAX;
  }
  const { ranked, knownFeatures } = loadModel().predict(cleaned || safeText);
  const top = ranked[0];
  const words = tokenize(cleaned || safeText).length || 1;
  const knownRatio = Math.min(1, knownFeatures / words);

  // Confident if the top intent is strong, OR it clearly beats the runner-up and every word was understood
  const second = ranked[1] ? ranked[1].prob : 0;
  const strong = top.prob >= CONFIDENCE_THRESHOLD && knownRatio >= MIN_KNOWN_RATIO;
  const clearWinner = top.prob >= 0.2 && top.prob >= 1.4 * second && knownRatio === 1;
  const confident = strong || clearWinner;
  if (!confident) {
    return { ...base, type: 'fallback', intent: null, confidence: +top.prob.toFixed(2),
      reply: "I'm not confident I understood that. You can rephrase, ask a question about HunarGhar, " +
             'describe a service (e.g. tailoring, cooking, tutoring, beauty, handicrafts), or use manual search.' };
  }

  const intent = intentByTag[top.label];
  const confidence = +top.prob.toFixed(2);

  if (intent.type === 'service') {
    let providers = [];
    if (deps.findProviders) {
      providers = await deps.findProviders({ category: intent.category, city, maxPrice, limit: 5 });
    }
    const where = city ? ` in ${city}` : '';
    const budget = maxPrice ? ` within PKR ${maxPrice}` : '';
    const text = providers.length
      ? `It looks like you need ${intent.category}${where}${budget}.${priceNote} Here are some providers that match:`
      : `It looks like you need ${intent.category}${where}${budget}, but I couldn't find a matching provider right now. Try manual search or clear a filter.${priceNote}`;
    return { ...base, type: 'service_match', intent: intent.tag, confidence, reply: text,
      suggestions: {
        category: intent.category,
        city, maxPrice,
        searchLink: `/search?category=${encodeURIComponent(intent.category)}` +
          (city ? `&city=${encodeURIComponent(city)}` : '') + (maxPrice ? `&maxPrice=${maxPrice}` : ''),
        providers
      } };
  }

  const responses = intent.responses;
  const answer = responses[Math.floor(Math.random() * responses.length)];
  return { ...base, type: intent.type === 'faq' ? 'faq' : 'smalltalk', intent: intent.tag, confidence, reply: answer };
}

module.exports = { reply, extractEntities, DISCLAIMER, loadModel };
