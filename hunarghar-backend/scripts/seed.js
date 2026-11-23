'use strict';
/**
 * Fills the database with demo data.   npm run db:seed
 * WARNING: empties the users/categories tables first (development data only).
 *
 * Logins created:
 *   admin     admin@hunarghar.com      Admin@12345
 *   customer  sara@example.com         Password@123   (also omar@example.com, laiba@example.com)
 *   provider  ayesha@example.com       Password@123   (sana@, hina@, fatima@, zainab@, maryam@, rabia@, iqra@)
 */
const bcrypt = require('bcryptjs');
const { pool, withTransaction } = require('../src/config/db');
const { coordsFor } = require('../src/config/cities');
const { recalcProviderRating } = require('../src/services/reviewService');

const CATEGORIES = [
  ['Tailoring', 'Stitching, alterations, boutique and bridal wear'],
  ['Cooking', 'Home-cooked meals, baking and catering'],
  ['Tutoring', 'Home tuition and teaching for all levels'],
  ['Beauty', 'Makeup, mehndi, hair and skin care'],
  ['Handicrafts', 'Handmade crafts, crochet, embroidery and gifts']
];

const PROVIDERS = [
  { name: 'Ayesha Khan', email: 'ayesha@example.com', city: 'Karachi', area: 'Gulshan-e-Iqbal', status: 'verified',
    bio: 'Professional tailor with 10 years of experience in bridal and formal wear.', skills: 'Bridal stitching, alterations, embroidery',
    services: [['Tailoring', 'Bridal and formal dress stitching', 8000, 'Mon-Sat, 10am-6pm'], ['Tailoring', 'Clothing alterations and repairs', 800, 'Daily, 10am-8pm']] },
  { name: 'Sana Malik', email: 'sana@example.com', city: 'Lahore', area: 'Model Town', status: 'verified',
    bio: 'Home chef specialising in desi catering for family gatherings.', skills: 'Biryani, karahi, baking, party trays',
    services: [['Cooking', 'Biryani party tray (serves 20)', 6000, 'Order 2 days ahead'], ['Cooking', 'Custom birthday cakes', 2500, 'Order 3 days ahead']] },
  { name: 'Hina Raza', email: 'hina@example.com', city: 'Karachi', area: 'North Nazimabad', status: 'verified',
    bio: 'Experienced maths and science teacher, O-level and Matric preparation.', skills: 'Maths, physics, chemistry, Quran with tajweed',
    services: [['Tutoring', 'O-level Maths tuition (monthly)', 5000, 'Mon-Fri, 4pm-8pm'], ['Tutoring', 'Quran reading for kids (monthly)', 3000, 'Mon-Fri, 3pm-5pm']] },
  { name: 'Fatima Noor', email: 'fatima@example.com', city: 'Islamabad', area: 'F-10', status: 'verified',
    bio: 'Certified beautician offering bridal makeup and mehndi at your home.', skills: 'Bridal makeup, mehndi, hair styling',
    services: [['Beauty', 'Bridal makeup', 9000, 'Weekends, book 2 weeks ahead'], ['Beauty', 'Mehndi designs (both hands)', 3000, 'Daily, by appointment']] },
  { name: 'Zainab Ali', email: 'zainab@example.com', city: 'Lahore', area: 'Johar Town', status: 'pending',
    bio: 'Handmade crochet bags, cushion covers and gift items.', skills: 'Crochet, embroidery, macrame',
    services: [['Handicrafts', 'Crochet handbags', 1500, 'Made to order (1 week)'], ['Handicrafts', 'Embroidered cushion covers (set of 2)', 2000, 'Made to order (1 week)']] },
  { name: 'Maryam Siddiqui', email: 'maryam@example.com', city: 'Karachi', area: 'Gulistan-e-Jauhar', status: 'unverified',
    bio: 'Weekly home-cooked meal plans and frozen snacks.', skills: 'Meal prep, frozen paratha, samosa',
    services: [['Cooking', 'Weekly home meal plan', 7000, 'Mon-Sat'], ['Cooking', 'Frozen paratha and samosa (pack)', 1200, 'Daily']] },
  { name: 'Rabia Anwar', email: 'rabia@example.com', city: 'Rawalpindi', area: 'Satellite Town', status: 'verified',
    bio: 'Stitching of shalwar kameez and kurtas with quick turnaround.', skills: 'Shalwar kameez, kurta, blouse',
    services: [['Tailoring', 'Suit stitching (per suit)', 2500, 'Mon-Sat, 9am-5pm']] },
  { name: 'Iqra Shah', email: 'iqra@example.com', city: 'Hyderabad', area: 'Latifabad', status: 'unverified',
    bio: 'Parlour services at home: facials, haircuts and styling.', skills: 'Facial, haircut, hair styling',
    services: [['Beauty', 'Facial treatment', 1500, 'Daily, 11am-7pm'], ['Beauty', 'Haircut and styling', 1200, 'Daily, 11am-7pm']] }
];
const CUSTOMERS = [['Sara Ahmed', 'sara@example.com'], ['Omar Farooq', 'omar@example.com'], ['Laiba Imran', 'laiba@example.com']];

const days = (n) => new Date(Date.now() + n * 86400000).toISOString();

(async () => {
  try {
    const pw = await bcrypt.hash('Password@123', 10);
    const adminPw = await bcrypt.hash('Admin@12345', 10);

    await withTransaction(async (c) => {
      await c.query('TRUNCATE users, categories RESTART IDENTITY CASCADE');
      for (const [n, d] of CATEGORIES) await c.query('INSERT INTO categories (name, description) VALUES ($1,$2)', [n, d]);

      const admin = (await c.query(
        `INSERT INTO users (full_name, email, password_hash, role) VALUES ('HunarGhar Admin','admin@hunarghar.com',$1,'admin') RETURNING user_id`, [adminPw])).rows[0].user_id;

      const cust = {};
      for (const [n, e] of CUSTOMERS) {
        cust[e] = (await c.query(`INSERT INTO users (full_name, email, password_hash, role) VALUES ($1,$2,$3,'customer') RETURNING user_id`, [n, e, pw])).rows[0].user_id;
      }

      const prov = {}; const svc = {};
      for (const p of PROVIDERS) {
        const id = (await c.query(`INSERT INTO users (full_name, email, password_hash, role) VALUES ($1,$2,$3,'provider') RETURNING user_id`, [p.name, p.email, pw])).rows[0].user_id;
        prov[p.email] = id; svc[p.email] = [];
        const { latitude, longitude } = coordsFor(p.city);
        await c.query(
          `INSERT INTO provider_profiles (provider_id, bio, skills, city, area, latitude, longitude, verification_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [id, p.bio, p.skills, p.city, p.area, latitude, longitude, p.status]);
        for (const [cat, desc, price, avail] of p.services) {
          svc[p.email].push((await c.query(
            'INSERT INTO services (provider_id, category, description, price, availability) VALUES ($1,$2,$3,$4,$5) RETURNING service_id',
            [id, cat, desc, price, avail])).rows[0].service_id);
        }
        if (p.status === 'verified') {
          await c.query(`INSERT INTO verification_requests (provider_id, status, reviewed_by, reviewed_at) VALUES ($1,'approved',$2,NOW())`, [id, admin]);
        } else if (p.status === 'pending') {
          await c.query(`INSERT INTO verification_requests (provider_id, status) VALUES ($1,'pending')`, [id]);
        }
      }

      // helper: insert a booking + its simulated payment row
      async function booking(custEmail, provEmail, svcIdx, status, when, paid = false, notes = null) {
        const sid = svc[provEmail][svcIdx];
        const price = (await c.query('SELECT price FROM services WHERE service_id = $1', [sid])).rows[0].price;
        const b = (await c.query(
          `INSERT INTO bookings (customer_id, provider_id, service_id, requested_datetime, notes, status)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING booking_id`,
          [cust[custEmail], prov[provEmail], sid, when, notes, status])).rows[0].booking_id;
        await c.query(`INSERT INTO payments (booking_id, amount, mock_status, paid_at) VALUES ($1,$2,$3,$4)`,
          [b, price, paid ? 'mock_paid' : 'not_paid', paid ? new Date().toISOString() : null]);
        return b;
      }
      const review = (b, custEmail, provEmail, rating, comment) => c.query(
        'INSERT INTO reviews (booking_id, customer_id, provider_id, rating, comment) VALUES ($1,$2,$3,$4,$5)',
        [b, cust[custEmail], prov[provEmail], rating, comment]);

      const b1 = await booking('sara@example.com', 'ayesha@example.com', 0, 'completed', days(-20), true, 'Bridal lehenga, fabric provided.');
      await review(b1, 'sara@example.com', 'ayesha@example.com', 5, 'Beautiful stitching and delivered on time!');
      const b2 = await booking('sara@example.com', 'sana@example.com', 1, 'completed', days(-12), true, 'Chocolate cake for 15 people.');
      const rv2 = await review(b2, 'sara@example.com', 'sana@example.com', 4, 'Delicious cake, slightly late delivery.');
      const b3 = await booking('omar@example.com', 'hina@example.com', 0, 'completed', days(-30), true);
      await review(b3, 'omar@example.com', 'hina@example.com', 5, 'My son improved a lot in maths. Highly recommended.');
      const b4 = await booking('laiba@example.com', 'fatima@example.com', 1, 'accepted', days(5), false, 'Mehndi for my sister\'s wedding.');
      await booking('omar@example.com', 'ayesha@example.com', 1, 'pending', days(3), false, 'Need 3 suits shortened.');
      await booking('sara@example.com', 'zainab@example.com', 0, 'rejected', days(7));
      await booking('laiba@example.com', 'hina@example.com', 1, 'cancelled', days(4));

      // chat on the accepted booking
      const msgs = [
        [cust['laiba@example.com'], 'Assalam o alaikum! Can you come to Gulberg on Saturday?'],
        [prov['fatima@example.com'], 'Walaikum assalam! Yes, Saturday at 4pm works for me.'],
        [cust['laiba@example.com'], 'Perfect, please bring bridal cone designs too.']
      ];
      for (const [sender, content] of msgs) {
        await c.query('INSERT INTO messages (booking_id, sender_id, content) VALUES ($1,$2,$3)', [b4, sender, content]);
      }
      // one open report so the admin dashboard has something to show
      const rid = (await c.query(`SELECT review_id FROM reviews WHERE booking_id = $1`, [b2])).rows[0].review_id;
      await c.query(`INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES ($1,'review',$2,'I believe this review is unfair.')`, [prov['sana@example.com'], rid]);

      for (const id of Object.values(prov)) await recalcProviderRating(c, id);
    });

    console.log('Seed complete.\n  Admin    : admin@hunarghar.com / Admin@12345\n  Customer : sara@example.com / Password@123\n  Provider : ayesha@example.com / Password@123');
  } catch (e) {
    console.error('Seeding failed:', e.message);
    console.error('Did you run "npm run db:init" first?');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
