'use strict';
/**
 * Tiny NLP toolkit (no external dependencies) used by the chatbot.
 * Pipeline: lowercase -> strip punctuation -> tokenise -> stop-word removal
 *           -> light stemming -> unigrams + bigrams.
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'am', 'was', 'be', 'to', 'of', 'in', 'on', 'at', 'for',
  'and', 'or', 'it', 'its', 'this', 'that', 'there', 'can', 'could', 'would', 'please',
  'me', 'my', 'we', 'you', 'your', 'do', 'does', 'did', 'will', 'shall', 'with', 'by', 'any',
  'i', 'what', 'how', 'who', 'which', 'why', 'when', 'where', 'tell', 'about', 'want', 'get'
]);

function stem(w) {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** Remove e-mails, phone numbers and long digit strings (privacy, SFR-48). */
function scrubPersonalInfo(text) {
  return String(text || '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, ' ')
    .replace(/(\+?\d[\d\s-]{7,}\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .map(stem);
}

/** Feature list = unigrams + bigrams of the processed tokens. */
function features(text) {
  const t = tokenize(text);
  const out = [...t];
  for (let i = 0; i < t.length - 1; i++) out.push(t[i] + '_' + t[i + 1]);
  return out;
}

module.exports = { tokenize, features, scrubPersonalInfo, stem };
