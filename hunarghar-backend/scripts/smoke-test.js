'use strict';
/**
 * HunarGhar end-to-end smoke test (no frontend needed).
 *
 * 1. Start the server in one terminal:   npm run dev
 * 2. Run this in a second terminal:      node scripts/smoke-test.js
 *
 * It creates fresh test users (random emails), walks through the whole system and prints
 * PASS / FAIL for each rule from the SRS. It needs the seeded admin account (npm run db:seed).
 * Uses Node's built-in fetch (Node 18+).
 */
const BASE = process.env.BASE_URL || 'http://localhost:5000';
const API = `${BASE}/api`;
let pass = 0;
let fail = 0;
const failures = [];

async function call(method, path, { token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON body */ }
  return { status: res.status, data };
}
const info = (r) => `-> got HTTP ${r.status}: ${r.data.message || JSON.stringify(r.data).slice(0, 120)}`;
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}  ${detail}`); }
}
const section = (t) => console.log(`\n=== ${t} ===`);
const is4xx = (r) => r.status >= 400 && r.status < 500;

(async () => {
  // ---------------------------------------------------------------- server up
  section('0. Server and database');
  try {
    const h = await fetch(`${API}/health`);
    const d = await h.json();
    check('Health endpoint says database is connected', d.database === 'connected', JSON.stringify(d));
  } catch {
    console.log(`\nCannot reach the server at ${BASE}.\nStart it first in another terminal with:  npm run dev`);
    process.exit(1);
  }

  const uid = Date.now().toString(36);
  const pw = 'Password@123';
  const custEmail = `cust_${uid}@test.com`;
  const cust2Email = `cust2_${uid}@test.com`;
  const provEmail = `prov_${uid}@test.com`;

  // ---------------------------------------------------------------- auth
  section('1. Registration and authentication (SFR-01 to SFR-07)');
  let r = await call('POST', '/auth/register', { body: { fullName: 'Test Customer', email: custEmail, password: pw, role: 'customer' } });
  check('Register customer -> 201 and token', r.status === 201 && !!r.data.token, info(r));
  const custToken = r.data.token;

  r = await call('POST', '/auth/register', { body: { fullName: 'Test Customer', email: custEmail, password: pw, role: 'customer' } });
  check('Duplicate email is rejected -> 409', r.status === 409, info(r));

  r = await call('POST', '/auth/register', { body: { fullName: 'Short Pw', email: `x_${uid}@test.com`, password: '123', role: 'customer' } });
  check('Too-short password is rejected -> 400', r.status === 400, info(r));

  r = await call('POST', '/auth/register', { body: { fullName: 'Bad Email', email: 'not-an-email', password: pw, role: 'customer' } });
  check('Invalid email format is rejected -> 400', r.status === 400, info(r));

  r = await call('POST', '/auth/register', { body: { fullName: 'Sneaky', email: `adm_${uid}@test.com`, password: pw, role: 'admin' } });
  check('Nobody can self-register as admin -> 400', r.status === 400, info(r));

  r = await call('POST', '/auth/register', { body: { fullName: 'Test Customer Two', email: cust2Email, password: pw, role: 'customer' } });
  const cust2Token = r.data.token;
  check('Register second customer', r.status === 201 && !!cust2Token, info(r));

  r = await call('POST', '/auth/register', { body: { fullName: 'Test Provider', email: provEmail, password: pw, role: 'provider' } });
  check('Register provider -> 201 and token', r.status === 201 && !!r.data.token, info(r));
  const provToken = r.data.token;
  const provId = r.data.user && r.data.user.user_id;

  r = await call('POST', '/auth/login', { body: { email: custEmail, password: 'wrong-password' } });
  check('Wrong password -> 401 with a generic message (SFR-07)', r.status === 401 && r.data.message === 'Invalid email or password', info(r));

  r = await call('POST', '/auth/login', { body: { email: `nobody_${uid}@test.com`, password: pw } });
  check('Unknown email gives the SAME generic message', r.status === 401 && r.data.message === 'Invalid email or password', info(r));

  r = await call('POST', '/auth/login', { body: { email: custEmail, password: pw } });
  check('Login works and returns redirectTo for the role', r.status === 200 && !!r.data.token && /customer/.test(r.data.redirectTo || ''), info(r));

  r = await call('GET', '/auth/me', { token: custToken });
  check('GET /auth/me with token -> 200', r.status === 200 && r.data.user && r.data.user.email === custEmail, info(r));

  r = await call('GET', '/auth/me');
  check('GET /auth/me without token -> 401', r.status === 401, info(r));

  // ---------------------------------------------------------------- roles
  section('2. Role-based access (SFR-06, SFR-42)');
  r = await call('GET', '/admin/stats', { token: custToken });
  check('Customer cannot open admin stats -> 403', r.status === 403, info(r));
  r = await call('GET', '/admin/stats');
  check('Visitor cannot open admin stats -> 401', r.status === 401, info(r));
  r = await call('POST', '/services', { token: custToken, body: { category: 'Tailoring', description: 'x', price: 100 } });
  check('Customer cannot create a service -> 403', r.status === 403, info(r));

  // ---------------------------------------------------------------- provider
  section('3. Provider profile and services (SFR-08 to SFR-12)');
  r = await call('PUT', '/providers/me', { token: provToken, body: { bio: 'Experienced tailor working from home.', skills: 'Stitching, alterations', city: 'Karachi', area: 'Gulshan' } });
  check('Provider saves profile', r.status === 200, info(r));

  r = await call('POST', '/services', { token: provToken, body: { category: 'Tailoring', description: 'Suit stitching (test)', price: 1500, availability: 'Mon-Fri 10-5' } });
  check('Provider adds a service -> 201', r.status === 201 && r.data.service, info(r));
  const serviceId = r.data.service && r.data.service.service_id;

  r = await call('POST', '/services', { token: provToken, body: { category: 'Tailoring', description: 'No price' } });
  check('Service without price is rejected -> 400', r.status === 400, info(r));
  r = await call('POST', '/services', { token: provToken, body: { category: 'Tailoring', description: 'Negative', price: -5 } });
  check('Negative price is rejected -> 400', r.status === 400, info(r));

  // ---------------------------------------------------------------- discovery
  section('4. Search and discovery (SFR-13 to SFR-17)');
  r = await call('GET', '/categories');
  check('Visitor can list categories (no login)', r.status === 200, info(r));

  r = await call('GET', '/providers?category=Tailoring&city=Karachi&limit=50');
  check('Filter by category + city finds the new provider',
    r.status === 200 && Array.isArray(r.data.providers) && r.data.providers.some((p) => p.provider_id === provId), info(r));

  r = await call('GET', '/providers?category=Tailoring&city=Nowhereville');
  check('No match -> empty list and a helpful message (SFR-16)',
    r.status === 200 && r.data.providers.length === 0 && !!r.data.message, info(r));

  r = await call('GET', '/providers?minRating=5&maxPrice=1');
  check('Combined filters return only providers matching ALL of them', r.status === 200 && r.data.providers.length === 0, info(r));

  r = await call('GET', '/providers/map');
  check('Map endpoint returns city-level markers', r.status === 200 && Array.isArray(r.data.markers), info(r));
  check('Map markers contain NO street address (SFR-17)',
    r.status === 200 && r.data.markers.every((m) => !('address' in m) && !('street' in m)), '');

  // ---------------------------------------------------------------- booking
  section('5. Booking workflow (SFR-18 to SFR-24)');
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  r = await call('POST', '/bookings', { token: custToken, body: { serviceId, requestedDatetime: yesterday } });
  check('Booking in the past is rejected -> 400', r.status === 400, info(r));

  r = await call('POST', '/bookings', { token: custToken, body: { requestedDatetime: tomorrow } });
  check('Booking without a service is rejected -> 400', r.status === 400, info(r));

  r = await call('POST', '/bookings', { token: provToken, body: { serviceId, requestedDatetime: tomorrow } });
  check('A provider cannot create a booking -> 403', r.status === 403, info(r));

  r = await call('POST', '/bookings', { token: custToken, body: { serviceId, requestedDatetime: tomorrow, notes: 'Smoke test booking' } });
  check('Valid booking -> 201 with status "pending"', r.status === 201 && r.data.booking && r.data.booking.status === 'pending', info(r));
  const bookingId = r.data.booking && r.data.booking.booking_id;

  r = await call('GET', '/bookings', { token: provToken });
  check('Provider sees the new booking in their list', r.status === 200 && r.data.bookings.some((b) => b.booking_id === bookingId), info(r));

  r = await call('GET', `/bookings/${bookingId}`, { token: cust2Token });
  check('A different customer cannot view the booking -> 403 (SFR-22)', r.status === 403, info(r));

  r = await call('POST', `/bookings/${bookingId}/accept`, { token: custToken });
  check('Customer cannot accept their own booking -> 403', r.status === 403, info(r));

  r = await call('POST', `/bookings/${bookingId}/accept`, { token: provToken });
  check('Provider accepts -> status "accepted"', r.status === 200 && r.data.booking.status === 'accepted', info(r));

  r = await call('POST', `/bookings/${bookingId}/accept`, { token: provToken });
  check('Accepting a second time is refused -> 409 (SFR-20)', r.status === 409, info(r));

  r = await call('GET', `/bookings/${bookingId}`, { token: custToken });
  check('Status is still "accepted" when read again (persisted)', r.status === 200 && r.data.booking.status === 'accepted', info(r));

  // ---------------------------------------------------------------- chat (REST)
  section('6. Chat messages over REST (SFR-25 to SFR-28)');
  r = await call('POST', `/bookings/${bookingId}/messages`, { token: custToken, body: { content: 'Hello from customer' } });
  check('Customer sends a message -> 201', r.status === 201, info(r));
  r = await call('POST', `/bookings/${bookingId}/messages`, { token: custToken, body: { content: '   ' } });
  check('Empty message is rejected -> 4xx', is4xx(r), info(r));
  r = await call('POST', `/bookings/${bookingId}/messages`, { token: provToken, body: { content: 'Hello from provider' } });
  check('Provider replies -> 201', r.status === 201, info(r));
  r = await call('GET', `/bookings/${bookingId}/messages`, { token: provToken });
  check('Messages come back in order with sender names',
    r.status === 200 && r.data.messages.length >= 2 && r.data.messages[0].content === 'Hello from customer' && !!r.data.messages[0].sender_name, info(r));
  r = await call('GET', `/bookings/${bookingId}/messages`, { token: cust2Token });
  check('Outsider cannot read the conversation -> 403', r.status === 403, info(r));
  r = await call('POST', `/bookings/${bookingId}/messages`, { token: cust2Token, body: { content: 'Intruder' } });
  check('Outsider cannot send a message -> 4xx', is4xx(r), info(r));

  // ---------------------------------------------------------------- payment
  section('7. Simulated payment (SFR-26 to SFR-32)');
  r = await call('GET', `/payments/booking/${bookingId}`, { token: custToken });
  check('Payment page shows amount and a DEMONSTRATION notice',
    r.status === 200 && r.data.payment.amount == 1500 && /DEMONSTRATION|simulated/i.test(r.data.payment.notice), info(r));
  check('Payment starts as "not_paid"', r.data.payment && r.data.payment.payment_status === 'not_paid', '');

  r = await call('POST', `/payments/booking/${bookingId}/confirm`, { token: cust2Token, body: { confirm: true } });
  check('Another customer cannot pay for this booking -> 403', r.status === 403, info(r));

  r = await call('POST', `/payments/booking/${bookingId}/confirm`, { token: custToken, body: { confirm: true } });
  check('Customer confirms -> "mock_paid" and marked simulated',
    r.status === 200 && r.data.payment.payment_status === 'mock_paid' && r.data.payment.isSimulated === true, info(r));

  // ---------------------------------------------------------------- reviews
  section('8. Completion and reviews (SFR-24, SFR-33 to SFR-36)');
  r = await call('POST', '/reviews', { token: custToken, body: { bookingId, rating: 5, comment: 'Great' } });
  check('Review before completion is refused -> 409', r.status === 409, info(r));

  r = await call('POST', `/bookings/${bookingId}/complete`, { token: custToken });
  check('Customer cannot mark the booking completed -> 403', r.status === 403, info(r));
  r = await call('POST', `/bookings/${bookingId}/complete`, { token: provToken });
  check('Provider marks the booking "completed"', r.status === 200 && r.data.booking.status === 'completed', info(r));

  r = await call('POST', `/bookings/${bookingId}/cancel`, { token: custToken });
  check('A completed booking cannot be cancelled -> 409 (SFR-23)', r.status === 409, info(r));

  r = await call('POST', '/reviews', { token: custToken, body: { bookingId, rating: 6, comment: 'Too high' } });
  check('Rating 6 is rejected -> 400', r.status === 400, info(r));
  r = await call('POST', '/reviews', { token: cust2Token, body: { bookingId, rating: 5, comment: 'Not mine' } });
  check('Another customer cannot review it -> 403', r.status === 403, info(r));
  r = await call('POST', '/reviews', { token: custToken, body: { bookingId, rating: 5, comment: 'Excellent work' } });
  check('Valid review -> 201', r.status === 201, info(r));
  r = await call('POST', '/reviews', { token: custToken, body: { bookingId, rating: 4, comment: 'Second try' } });
  check('Second review for same booking is refused -> 409 (SFR-35)', r.status === 409, info(r));

  r = await call('GET', `/providers/${provId}`);
  check('Provider average rating updated to 5',
    r.status === 200 && Number(r.data.provider.avg_rating) === 5 && r.data.reviews.length === 1, info(r));

  // ---------------------------------------------------------------- verification
  section('9. Provider verification by admin (SFR-34 to SFR-42)');
  r = await call('POST', '/auth/login', { body: { email: 'admin@hunarghar.com', password: 'Admin@12345' } });
  check('Seeded admin can log in (run "npm run db:seed" if this fails)', r.status === 200 && !!r.data.token, info(r));
  const adminToken = r.data.token;

  r = await call('POST', '/verification/request', { token: provToken });
  check('Provider submits for verification -> 201 pending', r.status === 201 && r.data.request.status === 'pending', info(r));
  const requestId = r.data.request && r.data.request.request_id;

  r = await call('POST', '/verification/request', { token: provToken });
  check('Submitting twice is refused -> 409', r.status === 409, info(r));

  r = await call('GET', '/verification?status=pending', { token: provToken });
  check('Provider cannot see the admin verification list -> 403', r.status === 403, info(r));

  r = await call('GET', '/verification?status=pending', { token: adminToken });
  check('Admin sees the pending request', r.status === 200 && r.data.requests.some((x) => x.request_id === requestId), info(r));

  r = await call('PATCH', `/verification/${requestId}`, { token: adminToken, body: { decision: 'approve', note: 'Smoke test' } });
  check('Admin approves -> provider "verified"', r.status === 200 && r.data.verification_status === 'verified', info(r));

  r = await call('PATCH', `/verification/${requestId}`, { token: adminToken, body: { decision: 'reject' } });
  check('Deciding twice is refused -> 409', r.status === 409, info(r));

  r = await call('GET', `/providers/${provId}`);
  check('Public profile now shows verification status "verified"', r.status === 200 && r.data.provider.verification_status === 'verified', info(r));

  // ---------------------------------------------------------------- reports
  section('10. Reports and moderation (SFR-37, SFR-43)');
  r = await call('POST', '/reports', { token: cust2Token, body: { targetType: 'profile', targetId: provId, reason: 'Smoke test report' } });
  check('Signed-in user reports a profile -> 201 status "open"', r.status === 201 && r.data.report.status === 'open', info(r));
  const reportId = r.data.report && r.data.report.report_id;
  r = await call('POST', '/reports', { body: { targetType: 'profile', targetId: provId, reason: 'x' } });
  check('Visitor cannot report -> 401', r.status === 401, info(r));
  r = await call('GET', '/reports?status=open', { token: adminToken });
  check('Admin sees the open report', r.status === 200 && r.data.reports.some((x) => x.report_id === reportId), info(r));
  r = await call('PATCH', `/reports/${reportId}`, { token: adminToken, body: { action: 'dismiss', note: 'Test only' } });
  check('Admin resolves (dismisses) the report', r.status === 200, info(r));

  r = await call('GET', '/admin/stats', { token: adminToken });
  check('Admin dashboard statistics load', r.status === 200 && !!r.data.stats, info(r));

  // ---------------------------------------------------------------- chatbot
  section('11. AI chatbot (FR-39 to FR-43, SFR-44 to SFR-48)');
  r = await call('POST', '/chatbot/message', { body: { message: 'What is HunarGhar?' } });
  check('Answers a project question (FAQ)', r.status === 200 && r.data.type === 'faq' && !!r.data.reply, info(r));
  check('Every answer carries the "not a guarantee" notice (SFR-47)', !!r.data.disclaimer, '');

  r = await call('POST', '/chatbot/message', { body: { message: 'Is the payment real money?' } });
  check('Explains that payment is simulated', r.status === 200 && /simulat/i.test(r.data.reply || ''), info(r));

  r = await call('POST', '/chatbot/message', { body: { message: 'I need a tailor in Karachi under 3000' } });
  check('Service request is matched to Tailoring',
    r.status === 200 && r.data.type === 'service_match' && r.data.suggestions.category === 'Tailoring', info(r));
  check('Suggests real providers from the database',
    Array.isArray(r.data.suggestions && r.data.suggestions.providers) && r.data.suggestions.providers.length > 0, '');

  r = await call('POST', '/chatbot/message', { body: { message: 'mujhe darzi chahiye' } });
  check('Understands Roman Urdu ("mujhe darzi chahiye")', r.status === 200 && r.data.type === 'service_match', info(r));

  r = await call('POST', '/chatbot/message', { body: { message: 'tell me a joke about cricket' } });
  check('Unknown question -> fallback with manual-search link (SFR-46)', r.status === 200 && r.data.type === 'fallback' && !!r.data.manualSearch, info(r));

  r = await call('POST', '/chatbot/message', { body: { message: '' } });
  check('Empty chatbot message is rejected -> 400', r.status === 400, info(r));

  r = await call('GET', '/chatbot/info');
  check('Chatbot model info available', r.status === 200 && r.data.intents > 0, info(r));

  // ---------------------------------------------------------------- logout
  section('12. Sign out (SFR-05)');
  r = await call('POST', '/auth/logout', { token: custToken });
  check('Logout -> 200', r.status === 200, info(r));
  r = await call('GET', '/auth/me', { token: custToken });
  check('The same token no longer works after logout -> 401', r.status === 401, info(r));

  // ---------------------------------------------------------------- summary
  console.log('\n==============================================');
  console.log(`  RESULT:  ${pass} passed,  ${fail} failed`);
  if (fail) {
    console.log('\n  Failed checks:');
    failures.forEach((f) => console.log('   - ' + f));
    console.log('\n  Copy the FAIL lines above and send them to get help.');
  } else {
    console.log('  All checks passed. The backend behaves as the SRS requires.');
  }
  console.log('==============================================');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('\nTest script crashed:', e); process.exit(1); });
