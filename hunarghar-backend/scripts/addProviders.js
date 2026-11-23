'use strict';
/**
 * Adds 2 demo providers to EVERY supported city (10 cities -> 20 providers), each with
 *   - services at LOW, MEDIUM and PREMIUM prices, so price filters find results, and
 *   - real completed bookings + reviews, so rating filters (2+, 3+, 4+, 4.5+) find results.
 *
 *   node scripts/addProviders.js          write to the database
 *   node scripts/addProviders.js --dry    print the plan and coverage table (no database needed)
 *
 * SAFE: never deletes anything. Existing providers (same email) are UPGRADED instead of duplicated:
 * missing services are added, and reviews are added only if the provider has none.
 * Run it as often as you like. Login for all new providers: Password@123
 */
const DRY = process.argv.includes('--dry');

// [city, A:[name,emailPrefix,area], B:[name,emailPrefix,area], B's second category, B verified?]
const CITIES = [
  ['Karachi',    ['Rubina Qadir',   'rubina.qadir',   'Clifton'],         ['Nazia Hashmi',   'nazia.hashmi',   'PECHS'],          'Beauty',   true],
  ['Lahore',     ['Saima Arif',     'saima.arif',     'Gulberg'],         ['Mahnoor Sheikh', 'mahnoor.sheikh', 'DHA Phase 5'],    'Tutoring', true],
  ['Islamabad',  ['Sadia Aslam',    'sadia.aslam',    'G-11'],            ['Noreen Javed',   'noreen.javed',   'I-8'],            'Beauty',   false],
  ['Rawalpindi', ['Tahira Mehmood', 'tahira.mehmood', 'Bahria Town'],     ['Uzma Rauf',      'uzma.rauf',      'Chaklala'],       'Tutoring', true],
  ['Faisalabad', ['Nadia Bashir',   'nadia.bashir',   'Peoples Colony'],  ['Sidra Iqbal',    'sidra.iqbal',    'Madina Town'],    'Beauty',   true],
  ['Peshawar',   ['Bushra Gul',     'bushra.gul',     'University Town'], ['Mehwish Khan',   'mehwish.khan',   'Hayatabad'],      'Tutoring', false],
  ['Quetta',     ['Shazia Bibi',    'shazia.bibi',    'Satellite Town'],  ['Rukhsana Baloch','rukhsana.baloch','Brewery Road'],   'Beauty',   true],
  ['Multan',     ['Samina Qureshi', 'samina.qureshi', 'Gulgasht Colony'], ['Farah Naz',      'farah.naz',      'Cantt'],          'Tutoring', true],
  ['Sialkot',    ['Amna Tariq',     'amna.tariq',     'Cantt'],           ['Kiran Butt',     'kiran.butt',     'Model Town'],     'Beauty',   false],
  ['Hyderabad',  ['Shabana Memon',  'shabana.memon',  'Qasimabad'],       ['Aliya Soomro',   'aliya.soomro',   'Hirabad'],        'Tutoring', true]
];

// Ratings come from these review scores. Provider A is always highly rated (>= 4.5);
// provider B varies from 2.5 to 4.3, so every rating filter returns something in every city.
const A_RATINGS = [[5, 5, 4, 5, 5], [5, 4, 5, 5], [5, 5, 5], [4, 5, 5, 4, 5]];
const B_RATINGS = [[4, 4, 5, 4], [3, 4, 3, 4], [4, 3, 4], [3, 3, 4, 3], [2, 3, 2, 3]];
const COMMENTS = { 5: 'Excellent work, very professional.', 4: 'Good service, would book again.', 3: 'Okay, but a little late.', 2: 'Not what I expected.' };
const avg = (a) => Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 10) / 10;

function buildProviders() {
  const out = [];
  CITIES.forEach(([city, a, b, bSecond, bVerified], i) => {
    const o = i % 3;
    out.push({
      name: a[0], email: `${a[1]}@example.com`, city, area: a[2], status: 'verified',
      bio: `Skilled home-based tailor and crafter in ${city}, taking orders for family and friends.`,
      skills: 'Suit stitching, alterations, crochet, embroidery',
      ratings: A_RATINGS[i % A_RATINGS.length],
      services: [
        ['Tailoring',   'Alterations and repairs',                    600 + o * 100,           'Daily, 10am-8pm'],
        ['Tailoring',   'Suit stitching (per suit)',                  2000 + (i % 4) * 500,    'Mon-Sat, 10am-6pm'],
        ['Tailoring',   'Bridal and formal dress stitching',          8000 + o * 1000,         'Book 3 weeks ahead'],
        ['Handicrafts', 'Small handmade gifts (keychains, bookmarks)', 800 + o * 100,          'Made to order (3 days)'],
        ['Handicrafts', 'Handmade crochet and embroidered gifts',     1500 + (i % 5) * 250,    'Made to order (1 week)'],
        ['Handicrafts', 'Custom wall hangings and home decor',        4500 + o * 500,         'Made to order (2 weeks)']
      ]
    });
    const second = bSecond === 'Beauty'
      ? [['Beauty',   'Facial and threading',                           900 + o * 200,   'Daily, by appointment'],
         ['Beauty',   'Party makeup',                                   3000 + o * 500,  'Weekends, book ahead'],
         ['Beauty',   'Full bridal makeup package',                     12000 + o * 2000, 'Book 2 weeks ahead']]
      : [['Tutoring', 'Quran reading for kids (monthly)',               1500 + o * 250,  'Mon-Fri, 3pm-5pm'],
         ['Tutoring', 'Home tuition for school students (monthly)',     3000 + o * 500,  'Mon-Fri, 4pm-8pm'],
         ['Tutoring', 'O-level / A-level exam preparation (monthly)',   7000 + o * 1000, 'Mon-Fri, 4pm-8pm']];
    out.push({
      name: b[0], email: `${b[1]}@example.com`, city, area: b[2], status: bVerified ? 'verified' : 'unverified',
      bio: `Home cook and ${bSecond === 'Beauty' ? 'beautician' : 'tutor'} in ${city}, serving local families.`,
      skills: bSecond === 'Beauty' ? 'Home cooking, party trays, makeup, mehndi' : 'Home cooking, party trays, school subjects',
      ratings: B_RATINGS[i % B_RATINGS.length],
      services: [
        ['Cooking', 'Snack box (samosa, rolls, pakoray)', 800 + o * 100,   'Order 1 day ahead'],
        ['Cooking', 'Home-cooked family meal tray',       2500 + o * 500,  'Order 1 day ahead'],
        ['Cooking', 'Party tray (serves 20)',             7000 + o * 1000, 'Order 2 days ahead'],
        ...second
      ]
    });
  });
  return out;
}

function printPlan(providers) {
  console.log(`Plan: ${providers.length} providers\n`);
  console.log('City        Provider         Status     Rating  Services (category price)');
  providers.forEach((p) => {
    console.log(`${p.city.padEnd(11)} ${p.name.padEnd(16)} ${p.status.padEnd(10)} ${String(avg(p.ratings)).padEnd(6)}  ` +
      p.services.map((s) => `${s[0].slice(0, 4)} ${s[2]}`).join(', '));
  });
  console.log('\nCoverage check per city (should show YES everywhere):');
  console.log('City        4.5+  4+    3+    2+    price<1500  1500-3500  3500-6000  6000+');
  CITIES.forEach(([city]) => {
    const ps = providers.filter((p) => p.city === city);
    const r = ps.map((p) => avg(p.ratings));
    const prices = ps.flatMap((p) => p.services.map((s) => s[2]));
    const yes = (b) => (b ? 'YES' : 'NO ').padEnd(6);
    console.log(`${city.padEnd(11)} ${yes(r.some((x) => x >= 4.5))}${yes(r.some((x) => x >= 4))}${yes(r.some((x) => x >= 3))}${yes(r.some((x) => x >= 2))}` +
      `${yes(prices.some((x) => x < 1500)).padEnd(12)}${yes(prices.some((x) => x >= 1500 && x <= 3500)).padEnd(11)}` +
      `${yes(prices.some((x) => x > 3500 && x <= 6000)).padEnd(11)}${yes(prices.some((x) => x > 6000))}`);
  });
}

async function main() {
  const providers = buildProviders();
  if (DRY) { printPlan(providers); return; }

  const bcrypt = require('bcryptjs');
  const { pool, withTransaction } = require('../src/config/db');
  const { coordsFor } = require('../src/config/cities');
  const { recalcProviderRating } = require('../src/services/reviewService');
  const hash = bcrypt.hashSync('Password@123', 10);

  const admin = (await pool.query("SELECT user_id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1")).rows[0];
  const adminId = admin ? admin.user_id : null;

  // customers who "wrote" the reviews (the demo customers; created only if missing)
  const reviewers = [];
  for (const [n, e] of [['Sara Ahmed', 'sara@example.com'], ['Omar Farooq', 'omar@example.com'], ['Laiba Imran', 'laiba@example.com']]) {
    let row = (await pool.query('SELECT user_id FROM users WHERE lower(email) = lower($1)', [e])).rows[0];
    if (!row) {
      row = (await pool.query(`INSERT INTO users (full_name, email, password_hash, role) VALUES ($1,$2,$3,'customer') RETURNING user_id`, [n, e, hash])).rows[0];
    }
    reviewers.push(row.user_id);
  }

  let created = 0; let upgraded = 0; let addedServices = 0; let addedReviews = 0;
  for (const p of providers) {
    await withTransaction(async (c) => {
      let id;
      const existing = (await c.query('SELECT user_id FROM users WHERE lower(email) = lower($1)', [p.email])).rows[0];
      if (existing) { id = existing.user_id; upgraded++; }
      else {
        id = (await c.query(`INSERT INTO users (full_name, email, password_hash, role) VALUES ($1,$2,$3,'provider') RETURNING user_id`, [p.name, p.email, hash])).rows[0].user_id;
        const { latitude, longitude } = coordsFor(p.city);
        await c.query(
          `INSERT INTO provider_profiles (provider_id, bio, skills, city, area, latitude, longitude, verification_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [id, p.bio, p.skills, p.city, p.area, latitude, longitude, p.status]);
        if (p.status === 'verified') {
          await c.query(`INSERT INTO verification_requests (provider_id, status, reviewed_by, reviewed_at) VALUES ($1,'approved',$2,NOW())`, [id, adminId]);
        }
        created++;
      }

      // services: add only the ones this provider does not have yet
      for (const [cat, desc, price, avail] of p.services) {
        const has = await c.query('SELECT 1 FROM services WHERE provider_id = $1 AND description = $2', [id, desc]);
        if (!has.rowCount) {
          await c.query('INSERT INTO services (provider_id, category, description, price, availability) VALUES ($1,$2,$3,$4,$5)', [id, cat, desc, price, avail]);
          addedServices++;
        }
      }

      // reviews: only if this provider has none yet
      const hasReviews = (await c.query('SELECT COUNT(*)::int AS n FROM reviews WHERE provider_id = $1', [id])).rows[0].n;
      if (!hasReviews) {
        const svc = (await c.query('SELECT service_id, price FROM services WHERE provider_id = $1 ORDER BY price', [id])).rows;
        for (let k = 0; k < p.ratings.length; k++) {
          const s = svc[k % svc.length];
          const when = new Date(Date.now() - (10 + k * 7) * 86400000).toISOString();
          const b = (await c.query(
            `INSERT INTO bookings (customer_id, provider_id, service_id, requested_datetime, notes, status)
             VALUES ($1,$2,$3,$4,NULL,'completed') RETURNING booking_id`, [reviewers[k % reviewers.length], id, s.service_id, when])).rows[0].booking_id;
          await c.query(`INSERT INTO payments (booking_id, amount, mock_status, paid_at) VALUES ($1,$2,'mock_paid',$3)`, [b, s.price, when]);
          await c.query('INSERT INTO reviews (booking_id, customer_id, provider_id, rating, comment) VALUES ($1,$2,$3,$4,$5)',
            [b, reviewers[k % reviewers.length], id, p.ratings[k], COMMENTS[p.ratings[k]]]);
          addedReviews++;
        }
      }
      await recalcProviderRating(c, id);
    });
  }

  console.log(`Done. New providers: ${created}, upgraded existing: ${upgraded}, services added: ${addedServices}, reviews added: ${addedReviews}.\n`);
  console.table((await pool.query(
    `SELECT city, COUNT(*)::int AS providers, MAX(avg_rating)::float AS best_rating, MIN(avg_rating)::float AS lowest_rating
       FROM provider_profiles GROUP BY city ORDER BY city`)).rows);
  await pool.end();
}

main().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
