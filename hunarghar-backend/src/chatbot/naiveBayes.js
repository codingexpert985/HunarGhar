'use strict';
const { features } = require('./nlp');

/** Multinomial Naive Bayes text classifier with Laplace smoothing. */
class NaiveBayes {
  constructor(alpha = 0.5) {
    this.alpha = alpha;
    this.classes = [];
    this.logPrior = {};
    this.wordCounts = {};   // class -> {feature: count}
    this.totals = {};       // class -> total feature count
    this.vocab = [];
  }

  train(samples) { // samples: [{text, label}]
    const labelDocs = {};
    const vocab = new Set();
    this.wordCounts = {};
    this.totals = {};
    for (const { text, label } of samples) {
      labelDocs[label] = (labelDocs[label] || 0) + 1;
      this.wordCounts[label] = this.wordCounts[label] || {};
      this.totals[label] = this.totals[label] || 0;
      for (const f of features(text)) {
        vocab.add(f);
        this.wordCounts[label][f] = (this.wordCounts[label][f] || 0) + 1;
        this.totals[label] += 1;
      }
    }
    this.classes = Object.keys(labelDocs);
    this.vocab = [...vocab];
    const n = samples.length;
    this.logPrior = {};
    for (const c of this.classes) this.logPrior[c] = Math.log(labelDocs[c] / n);
    return this;
  }

  /** Returns [{label, prob}] sorted by probability (softmax of log scores). */
  predict(text) {
    const feats = features(text);
    const V = this.vocab.length;
    const vocabSet = this._vocabSet || (this._vocabSet = new Set(this.vocab));
    const known = feats.filter((f) => vocabSet.has(f));
    const scores = this.classes.map((c) => {
      let s = this.logPrior[c];
      for (const f of known) {
        const cnt = this.wordCounts[c][f] || 0;
        s += Math.log((cnt + this.alpha) / (this.totals[c] + this.alpha * V));
      }
      return { label: c, score: s };
    });
    const max = Math.max(...scores.map((s) => s.score));
    const exps = scores.map((s) => Math.exp(s.score - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    const ranked = scores
      .map((s, i) => ({ label: s.label, prob: exps[i] / sum }))
      .sort((a, b) => b.prob - a.prob);
    return { ranked, knownFeatures: known.length, totalFeatures: feats.length };
  }

  toJSON() {
    return {
      alpha: this.alpha, classes: this.classes, logPrior: this.logPrior,
      wordCounts: this.wordCounts, totals: this.totals, vocab: this.vocab
    };
  }

  static fromJSON(j) {
    const nb = new NaiveBayes(j.alpha);
    Object.assign(nb, j);
    return nb;
  }
}

module.exports = NaiveBayes;
