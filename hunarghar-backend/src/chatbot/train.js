'use strict';
/**
 * Trains the chatbot model:   npm run train:chatbot
 *   Input : src/chatbot/data/intents.json        (training phrases per intent)
 *   Eval  : src/chatbot/data/test_questions.json (held-out questions NOT used in training)
 *   Output: src/chatbot/model.json               (trained Naive Bayes model)
 * The printed report can be pasted into your project report.
 */
const fs = require('fs');
const path = require('path');
const NaiveBayes = require('./naiveBayes');

const ALPHA = 0.2; // Laplace smoothing
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'intents.json'), 'utf8'));
const tests = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'test_questions.json'), 'utf8'));

const samples = [];
for (const intent of data.intents) {
  for (const p of intent.patterns) samples.push({ text: p, label: intent.tag });
}

const model = new NaiveBayes(ALPHA).train(samples);

let trainOk = 0;
for (const s of samples) if (model.predict(s.text).ranked[0].label === s.label) trainOk++;

let testOk = 0;
const wrong = [];
for (const [q, label] of tests) {
  const top = model.predict(q).ranked[0];
  if (top.label === label) testOk++;
  else wrong.push({ question: q, expected: label, got: top.label, confidence: +top.prob.toFixed(2) });
}

fs.writeFileSync(path.join(__dirname, 'model.json'), JSON.stringify(model.toJSON()));

console.log('=== HunarGhar chatbot training report ===');
console.log('Algorithm          : Multinomial Naive Bayes (unigram + bigram features, Laplace alpha=' + ALPHA + ')');
console.log('Intents (classes)  : ' + data.intents.length);
console.log('Training samples   : ' + samples.length);
console.log('Vocabulary size    : ' + model.vocab.length);
console.log('Training accuracy  : ' + ((trainOk / samples.length) * 100).toFixed(1) + '%');
console.log('Held-out test acc. : ' + ((testOk / tests.length) * 100).toFixed(1) + '%  (' + testOk + '/' + tests.length + ' unseen questions)');
if (wrong.length) { console.log('Misclassified test questions:'); console.table(wrong); }
console.log('Model saved to src/chatbot/model.json');
