'use strict';
// Approximate city centres. Only these (rounded) coordinates are ever stored/shown,
// so a provider's exact address is never exposed (SRS SFR-17).
const CITY_COORDS = {
  karachi: [24.86, 67.01], lahore: [31.52, 74.36], islamabad: [33.68, 73.05],
  rawalpindi: [33.60, 73.04], faisalabad: [31.42, 73.08], peshawar: [34.01, 71.58],
  quetta: [30.18, 66.99], multan: [30.20, 71.47], hyderabad: [25.40, 68.37], sialkot: [32.49, 74.53]
};
function coordsFor(city) {
  const c = CITY_COORDS[String(city || '').trim().toLowerCase()];
  return c ? { latitude: c[0], longitude: c[1] } : { latitude: null, longitude: null };
}
module.exports = { CITY_COORDS, coordsFor };
