'use strict';
// Price rule for every service on HunarGhar (all five categories).
const PRICE_MIN = 700;
const PRICE_MAX = 9000;
const PRICE_MESSAGE = `Prices on HunarGhar range from PKR ${PRICE_MIN} to PKR 9,000. Please enter an amount within this range.`;
module.exports = { PRICE_MIN, PRICE_MAX, PRICE_MESSAGE };
