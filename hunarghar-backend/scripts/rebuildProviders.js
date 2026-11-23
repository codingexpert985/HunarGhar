'use strict';
/**
 * HunarGhar - rebuild the demo provider catalogue.
 *
 *   node scripts/rebuildProviders.js --dry   show the plan and prove the coverage (no database needed)
 *   node scripts/rebuildProviders.js         apply it to the database
 *
 * Result for EVERY one of the 10 cities x 5 categories (50 combinations):
 *   - 5 providers in total  (so "all providers" shows 5)
 *   - 3 of them verified    (so "Verified providers only" shows 3)
 *   - ratings from 2.x up to 4.8 (4.5+, 4+, 3+ and 2+ filters all find someone)
 *   - every provider has 4 services at low / mid / upper / premium prices,
 *     ALL between PKR 700 and PKR 9,000.
 *
 * What it does, in order (inside transactions, so a failure changes nothing):
 *   1. removes the demo providers made by the EARLIER helper scripts and by the smoke test
 *      (addProviders.js, addCoverage.js, and the @test.com accounts). Your original seed
 *      providers (Ayesha, Sana, ...) and any real accounts are NOT touched.
 *   2. clamps every existing service price into 700..9000 and adds a database rule for it.
 *   3. adds only the providers still missing for each city/category, with reviews.
 * It is safe to run again: when a combination is already complete nothing is added.
 * Login for every new provider: Password@123
 */
const crypto = require('crypto');
const DRY = process.argv.includes('--dry');

const PRICE_MIN = 700;
const PRICE_MAX = 9000;
const TARGET_TOTAL = 5;
const TARGET_VERIFIED = 3;

const CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Peshawar', 'Quetta', 'Multan', 'Sialkot', 'Hyderabad'];
const AREAS = {
  Karachi: ['Clifton', 'PECHS', 'Gulshan-e-Iqbal', 'North Nazimabad'], Lahore: ['Gulberg', 'Model Town', 'Johar Town', 'DHA Phase 5'],
  Islamabad: ['G-11', 'F-10', 'I-8', 'E-11'], Rawalpindi: ['Bahria Town', 'Chaklala', 'Satellite Town', 'Saddar'],
  Faisalabad: ['Peoples Colony', 'Madina Town', 'Gulberg', 'Jinnah Colony'], Peshawar: ['University Town', 'Hayatabad', 'Cantt', 'Gulbahar'],
  Quetta: ['Satellite Town', 'Brewery Road', 'Jinnah Town', 'Airport Road'], Multan: ['Gulgasht Colony', 'Cantt', 'Shah Rukn-e-Alam', 'Bosan Road'],
  Sialkot: ['Cantt', 'Model Town', 'Paris Road', 'Kashmir Road'], Hyderabad: ['Qasimabad', 'Hirabad', 'Latifabad', 'Cantt']
};

// anchors for the four price bands: low < 1500 | mid 1500-3500 | upper 3500-6000 | premium > 6000
const CATS = {
  Tailoring:   { bio: 'home-based tailor', skills: 'Stitching, alterations, bridal wear', anchors: [800, 2500, 4500, 8000],
    items: [['Alterations and repairs', 'Daily, 10am-8pm'], ['Suit stitching (per suit)', 'Mon-Sat, 10am-6pm'],
            ['Kids and casual wear stitching (set)', 'Mon-Sat, 10am-6pm'], ['Bridal and formal dress stitching', 'Book 3 weeks ahead']] },
  Handicrafts: { bio: 'handicraft maker', skills: 'Crochet, embroidery, decor', anchors: [900, 2200, 4800, 7500],
    items: [['Small handmade gifts (keychains, bookmarks)', 'Made to order (3 days)'], ['Crochet and embroidered gifts', 'Made to order (1 week)'],
            ['Custom wall hangings and home decor', 'Made to order (2 weeks)'], ['Wedding favour boxes and trousseau decor', 'Book 3 weeks ahead']] },
  Cooking:     { bio: 'home chef', skills: 'Desi cooking, baking, catering', anchors: [900, 2800, 4500, 7000],
    items: [['Snack box (samosa, rolls, pakoray)', 'Order 1 day ahead'], ['Home-cooked family meal tray', 'Order 1 day ahead'],
            ['Dessert and cake platter', 'Order 2 days ahead'], ['Party tray (serves 20)', 'Order 2 days ahead']] },
  Beauty:      { bio: 'home beautician', skills: 'Makeup, mehndi, skin care', anchors: [1000, 3000, 5000, 8000],
    items: [['Facial and threading', 'Daily, by appointment'], ['Party makeup', 'Weekends, book ahead'],
            ['Mehndi (both hands, bridal design)', 'Book 1 week ahead'], ['Full bridal makeup package', 'Book 2 weeks ahead']] },
  Tutoring:    { bio: 'home tutor', skills: 'School subjects, Quran, exam preparation', anchors: [1200, 2800, 5000, 7500],
    items: [['Quran reading for kids (monthly)', 'Mon-Fri, 3pm-5pm'], ['School tuition up to class 8 (monthly)', 'Mon-Fri, 4pm-8pm'],
            ['Matric / O-level tuition (monthly)', 'Mon-Fri, 4pm-8pm'], ['A-level and university exam prep (monthly)', 'Mon-Fri, 4pm-8pm']] }
};

const FIRST = ['Ayesha', 'Fatima', 'Zainab', 'Maryam', 'Hina', 'Sana', 'Rabia', 'Iqra', 'Nida', 'Amna', 'Saba', 'Hira', 'Mahnoor', 'Sidra', 'Bushra', 'Farah', 'Kiran', 'Nazia', 'Rubina', 'Samina'];
const LAST = ['Khan', 'Malik', 'Raza', 'Siddiqui', 'Anwar', 'Shah', 'Qureshi', 'Baig', 'Hashmi', 'Butt', 'Ahmed', 'Sheikh', 'Rauf'];

// review scores -> average rating
const V_RATINGS = [[[5, 5, 4, 5, 5], [5, 4, 5, 5], [5, 5, 5], [4, 5, 5, 4, 5]],   // verified #1  4.6 - 5.0
                   [[4, 4, 5, 4], [4, 4, 4], [5, 4, 4, 4]],                          // verified #2  4.0 - 4.3
                   [[3, 4, 3, 4], [4, 3, 4], [3, 3, 4, 3]]];                         // verified #3  3.3 - 3.7
const U_RATINGS = [[[5, 5, 4, 5], [4, 5, 5, 4, 5]],                                  // unverified #1 4.6 - 4.8
                   [[2, 3, 2, 3], [2, 2, 3]]];                                       // unverified #2 2.3 - 2.5
const COMMENTS = { 5: 'Excellent work, very professional.', 4: 'Good service, would book again.', 3: 'Okay, but a little late.', 2: 'Not what I expected.' };
const avg = (a) => Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 10) / 10;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
const clamp = (n) => Math.min(PRICE_MAX, Math.max(PRICE_MIN, n));
const round50 = (n) => Math.round(n / 50) * 50;

// Providers already in the database (the original seed) - used only for the --dry plan.
const SEED_ASSUMED = {
  'Karachi|Tailoring': [1, 0], 'Lahore|Cooking': [1, 0], 'Karachi|Tutoring': [1, 0], 'Islamabad|Beauty': [1, 0],
  'Rawalpindi|Tailoring': [1, 0], 'Lahore|Handicrafts': [0, 1], 'Karachi|Cooking': [0, 1], 'Hyderabad|Beauty': [0, 1]
}; // "city|category": [verified, not verified]

/** What must be added so that every city/category ends with 5 providers, 3 verified. */
function buildProviders(existing) {
  const out = [];
  let k = 0;
  CITIES.forEach((city, ci) => {
    Object.entries(CATS).forEach(([cat, c], ti) => {
      const [ev, eu] = existing[`${city}|${cat}`] || [0, 0];
      const newV = Math.max(0, TARGET_VERIFIED - ev);
      const newU = Math.max(0, TARGET_TOTAL - TARGET_VERIFIED - eu);
      const slots = [];
      for (let j = 0; j < newV; j++) slots.push({ verified: true, plans: V_RATINGS[j] });
      for (let j = 0; j < newU; j++) slots.push({ verified: false, plans: U_RATINGS[j] });
      slots.forEach((slot, j) => {
        const f = [0.9, 0.95, 1.0, 1.05, 1.1][j % 5] * (1 + ((ci % 3) - 1) * 0.03);
        const first = FIRST[k % FIRST.length];
        const last = LAST[Math.floor(k / FIRST.length) % LAST.length];
        out.push({
          name: `${first} ${last}`, city, area: AREAS[city][k % 4], cat, verified: slot.verified,
          status: slot.verified ? 'verified' : 'unverified',
          bio: `Experienced ${c.bio} in ${city}, working from home for families and friends.`, skills: c.skills,
          ratings: slot.plans[(ci + ti) % slot.plans.length],
          services: c.items.map(([desc, avail], b) => [cat, desc, clamp(round50(c.anchors[b] * f)), avail])
        });
        k++;
      });
    });
  });
  return out;
}

function printPlan(providers) {
  const all = {};
  CITIES.forEach((city) => Object.keys(CATS).forEach((cat) => { all[`${city}|${cat}`] = { n: 0, v: 0, r: [], p: [] }; }));
  Object.entries(SEED_ASSUMED).forEach(([key, [v, u]]) => { all[key].n += v + u; all[key].v += v; all[key].r.push(...Array(v + u).fill(4.5)); });
  providers.forEach((p) => {
    const e = all[`${p.city}|${p.cat}`];
    e.n++; if (p.verified) e.v++; e.r.push(avg(p.ratings)); e.p.push(...p.services.map((s) => s[2]));
  });
  console.log('City        Category     total verified  4.5+ 4+  3+  2+   price bands (<1500 | 1500-3500 | 3500-6000 | >6000)   min  max');
  let bad = 0;
  CITIES.forEach((city) => Object.keys(CATS).forEach((cat) => {
    const e = all[`${city}|${cat}`];
    const hasR = [4.5, 4, 3, 2].map((t) => e.r.some((x) => x >= t));
    const hasP = [e.p.some((x) => x < 1500), e.p.some((x) => x >= 1500 && x <= 3500), e.p.some((x) => x > 3500 && x <= 6000), e.p.some((x) => x > 6000)];
    const okCount = e.n === 5 && e.v >= 3 && e.v <= 4;
    const inRange = e.p.every((x) => x >= PRICE_MIN && x <= PRICE_MAX);
    if (!okCount || !inRange || hasR.includes(false) || hasP.includes(false)) bad++;
    const y = (b) => (b ? 'Y' : 'N');
    console.log(`${city.padEnd(11)} ${cat.padEnd(12)} ${String(e.n).padStart(3)}   ${String(e.v).padStart(3)}      ${hasR.map(y).join('    ')}     ` +
      `${hasP.map(y).join('    ')}                       ${e.p.length ? Math.min(...e.p) : '-'} ${e.p.length ? Math.max(...e.p) : '-'}`);
  }));
  console.log(`\nProviders to add: ${providers.length}.  Combinations with a problem: ${bad} of ${CITIES.length * Object.keys(CATS).length}.`);
  console.log('Expected for every combination: 5 providers in total, 3-4 verified, all ratings and price bands covered, prices 700-9000.');
}

async function insertMany(c, table, cols, rows) {
  if (!rows.length) return;
  const params = [];
  const tuples = rows.map((r) => '(' + r.map((v) => { params.push(v); return '$' + params.length; }).join(',') + ')');
  await c.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${tuples.join(',')}`, params);
}

async function main() {
  if (DRY) { printPlan(buildProviders(SEED_ASSUMED)); return; }

  const bcrypt = require('bcryptjs');
  const { pool, withTransaction } = require('../src/config/db');
  const { coordsFor } = require('../src/config/cities');
  const { recalcProviderRating } = require('../src/services/reviewService');
  const hash = bcrypt.hashSync('Password@123', 10);

  // ---------------------------------------------------------------- 1. clean old generated demo data
  const OLD_EMAILS = ['rubina.qadir', 'nazia.hashmi', 'saima.arif', 'mahnoor.sheikh', 'sadia.aslam', 'noreen.javed', 'tahira.mehmood', 'uzma.rauf',
    'nadia.bashir', 'sidra.iqbal', 'bushra.gul', 'mehwish.khan', 'shazia.bibi', 'rukhsana.baloch', 'samina.qureshi', 'farah.naz',
    'amna.tariq', 'kiran.butt', 'shabana.memon', 'aliya.soomro'].map((e) => `${e}@example.com`);
  const oldRegex = '^[a-z]+\\.[a-z]+\\.[a-z]+\\.[a-z]+@example\\.com$';   // earlier addCoverage.js emails (4 parts)
  const doomed = (await pool.query(
    `SELECT user_id FROM users
      WHERE email LIKE '%@test.com'
         OR (role = 'provider' AND (email = ANY($1::text[]) OR email ~ $2))`, [OLD_EMAILS, oldRegex])).rows.map((r) => r.user_id);

  if (doomed.length) {
    await withTransaction(async (c) => {
      const ids = doomed;
      const txt = ids.map(String);
      const inBookings = '(SELECT booking_id FROM bookings WHERE provider_id = ANY($1::uuid[]) OR customer_id = ANY($1::uuid[]))';
      await c.query('DELETE FROM reports WHERE reporter_id = ANY($1::uuid[]) OR target_id::text = ANY($2::text[])', [ids, txt]);
      await c.query(`DELETE FROM messages WHERE booking_id IN ${inBookings} OR sender_id = ANY($1::uuid[])`, [ids]);
      await c.query(`DELETE FROM reviews  WHERE booking_id IN ${inBookings}`, [ids]);
      await c.query(`DELETE FROM payments WHERE booking_id IN ${inBookings}`, [ids]);
      await c.query('DELETE FROM bookings WHERE provider_id = ANY($1::uuid[]) OR customer_id = ANY($1::uuid[])', [ids]);
      await c.query('DELETE FROM verification_requests WHERE provider_id = ANY($1::uuid[])', [ids]);
      await c.query('DELETE FROM portfolio_images WHERE provider_id = ANY($1::uuid[])', [ids]);
      await c.query('DELETE FROM services WHERE provider_id = ANY($1::uuid[])', [ids]);
      await c.query('DELETE FROM provider_profiles WHERE provider_id = ANY($1::uuid[])', [ids]);
      await c.query('DELETE FROM users WHERE user_id = ANY($1::uuid[])', [ids]);
    });
  }
  console.log(`1/3 Removed ${doomed.length} old generated demo accounts.`);

  // ---------------------------------------------------------------- 2. price rule 700..9000
  const lo = await pool.query('UPDATE services SET price = $1 WHERE price < $1', [PRICE_MIN]);
  const hi = await pool.query('UPDATE services SET price = $1 WHERE price > $1', [PRICE_MAX]);
  await pool.query('ALTER TABLE services DROP CONSTRAINT IF EXISTS services_price_range');
  await pool.query(`ALTER TABLE services ADD CONSTRAINT services_price_range CHECK (price BETWEEN ${PRICE_MIN} AND ${PRICE_MAX})`);
  console.log(`2/3 Price rule PKR ${PRICE_MIN}-${PRICE_MAX} applied (raised ${lo.rowCount}, lowered ${hi.rowCount} existing prices).`);

  // ---------------------------------------------------------------- 3. add what is missing
  const ex = await pool.query(
    `SELECT p.city, s.category,
            COUNT(DISTINCT p.provider_id) FILTER (WHERE p.verification_status = 'verified')::int AS v,
            COUNT(DISTINCT p.provider_id) FILTER (WHERE p.verification_status <> 'verified')::int AS u
       FROM provider_profiles p JOIN services s ON s.provider_id = p.provider_id AND s.is_active = TRUE
      GROUP BY p.city, s.category`);
  const existing = {};
  ex.rows.forEach((r) => { existing[`${r.city}|${r.category}`] = [r.v, r.u]; });
  const providers = buildProviders(existing);

  const admin = (await pool.query("SELECT user_id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1")).rows[0];
  const adminId = admin ? admin.user_id : null;
  const reviewers = [];
  for (const [n, e] of [['Sara Ahmed', 'sara@example.com'], ['Omar Farooq', 'omar@example.com'], ['Laiba Imran', 'laiba@example.com']]) {
    let row = (await pool.query('SELECT user_id FROM users WHERE lower(email) = lower($1)', [e])).rows[0];
    if (!row) row = (await pool.query(`INSERT INTO users (full_name, email, password_hash, role) VALUES ($1,$2,$3,'customer') RETURNING user_id`, [n, e, hash])).rows[0];
    reviewers.push(row.user_id);
  }

  let added = 0;
  for (const p of providers) {
    const id = crypto.randomUUID();
    const email = `${slug(p.name.split(' ')[0])}.${slug(p.name.split(' ')[1])}.${slug(p.city)}.${slug(p.cat)}.${crypto.randomBytes(2).toString('hex')}@example.com`;
    await withTransaction(async (c) => {
      await insertMany(c, 'users', ['user_id', 'full_name', 'email', 'password_hash', 'role'], [[id, p.name, email, hash, 'provider']]);
      const { latitude, longitude } = coordsFor(p.city);
      await insertMany(c, 'provider_profiles', ['provider_id', 'bio', 'skills', 'city', 'area', 'latitude', 'longitude', 'verification_status'],
        [[id, p.bio, p.skills, p.city, p.area, latitude, longitude, p.status]]);
      if (p.verified) {
        await c.query(`INSERT INTO verification_requests (provider_id, status, reviewed_by, reviewed_at) VALUES ($1,'approved',$2,NOW())`, [id, adminId]);
      }
      const svc = p.services.map(([cat, desc, price, avail]) => ({ id: crypto.randomUUID(), cat, desc, price, avail }));
      await insertMany(c, 'services', ['service_id', 'provider_id', 'category', 'description', 'price', 'availability'],
        svc.map((s) => [s.id, id, s.cat, s.desc, s.price, s.avail]));
      const bk = p.ratings.map((rating, r) => {
        const s = svc[r % svc.length];
        const when = new Date(Date.now() - (10 + r * 7) * 86400000).toISOString();
        return { id: crypto.randomUUID(), cust: reviewers[r % reviewers.length], s, when, rating };
      });
      await insertMany(c, 'bookings', ['booking_id', 'customer_id', 'provider_id', 'service_id', 'requested_datetime', 'notes', 'status'],
        bk.map((b) => [b.id, b.cust, id, b.s.id, b.when, null, 'completed']));
      await insertMany(c, 'payments', ['booking_id', 'amount', 'mock_status', 'paid_at'], bk.map((b) => [b.id, b.s.price, 'mock_paid', b.when]));
      await insertMany(c, 'reviews', ['booking_id', 'customer_id', 'provider_id', 'rating', 'comment'],
        bk.map((b) => [b.id, b.cust, id, b.rating, COMMENTS[b.rating]]));
      await recalcProviderRating(c, id);
    });
    added++;
    if (added % 25 === 0) console.log(`    ... ${added} of ${providers.length} added`);
  }
  console.log(`3/3 Added ${added} providers.\n`);

  const r = await pool.query(
    `SELECT p.city, s.category,
            COUNT(DISTINCT p.provider_id)::int AS providers,
            COUNT(DISTINCT p.provider_id) FILTER (WHERE p.verification_status = 'verified')::int AS verified,
            MIN(s.price)::int AS min_price, MAX(s.price)::int AS max_price
       FROM provider_profiles p JOIN services s ON s.provider_id = p.provider_id AND s.is_active = TRUE
      GROUP BY p.city, s.category ORDER BY p.city, s.category`);
  console.table(r.rows);
  const bad = r.rows.filter((x) => x.providers < 4 || x.verified < 3);
  console.log(bad.length ? `Check these combinations: ${bad.map((x) => x.city + '/' + x.category).join(', ')}` : 'Every city and category has at least 4 providers and 3 verified.');
  await pool.end();
}

main().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
