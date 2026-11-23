# Build the HunarGhar backend yourself — step by step

Follow this guide in order. Each step says **what**, **why**, **how**, and **how to check it works**.
The finished code is in this project, so if you get stuck, open the file named in the step and compare.

---
## Step 0 — Install the tools
1. **Node.js 18+** (https://nodejs.org) → check `node -v`
2. **PostgreSQL 13+** (https://www.postgresql.org/download) *or* Docker (`docker compose up -d` uses the included file).
3. **VS Code** + **Postman** (or use `curl`).
4. A free **Cloudinary** account (images) — optional on day 1.

## Step 1 — Create the project
```bash
mkdir hunarghar-backend && cd hunarghar-backend
npm init -y
npm install express pg bcryptjs jsonwebtoken cors helmet morgan dotenv socket.io multer cloudinary express-rate-limit
npm install -D nodemon
mkdir -p src/{config,middleware,routes,services,sockets,utils,chatbot/data} database scripts
```
Add scripts to `package.json`: `"dev": "nodemon src/server.js"`, `"start": "node src/server.js"`.
*Why this layout?* Each folder has one job (routes = URLs, services = reusable logic, middleware = checks that run
before routes). That is the "Maintainability / Reusability" quality attribute of your SRS (4.3.6, 4.3.9).

## Step 2 — Design the database (rubric criterion 5)
1. Read **Appendix A (Data Dictionary)** of your SRS — each table there becomes a `CREATE TABLE`.
2. Write `database/schema.sql` (see the file). Key ideas:
   * `UUID` primary keys → `gen_random_uuid()`.
   * `ENUM` types for role, booking status, verification status (matches "State Variables" in the SRS).
   * Foreign keys (`REFERENCES`) to connect tables, `UNIQUE(booking_id)` in `reviews` → **one review per booking** (SFR-35).
   * `CHECK (price >= 0)` and `CHECK (rating BETWEEN 1 AND 5)` → the database itself refuses bad data.
   * Indexes on columns we filter by (`category`, `city`, `booking_id`).
3. Create the database and run the schema:
```bash
psql -U postgres -c "CREATE DATABASE hunarghar;"
node scripts/initDb.js          # reads schema.sql and executes it
```
**Check:** `psql -U postgres -d hunarghar -c "\dt"` lists 12 tables. Draw the ERD (docs/DIAGRAMS.md) for your report.

## Step 3 — Configuration and database connection
* `.env` holds secrets (`DATABASE_URL`, `JWT_SECRET`…) and is **never** committed (SRS 4.2.1) — see `.gitignore`.
* `src/config/env.js` reads `.env` with `dotenv`. `src/config/db.js` creates a `pg.Pool` and a `withTransaction()` helper.
*Why transactions?* When a booking is created we insert into `bookings` **and** `payments`. If one fails, both must be undone.

## Step 4 — Express app skeleton
`src/app.js`: create `express()`, add `helmet()` (security headers), `cors()`, `express.json()`, `morgan()` (logging),
mount routes under `/api/...`, then a 404 handler and the **central error handler**.
`src/server.js`: create an HTTP server from the app, attach Socket.io, `listen(PORT)`.
**Check:** `npm run dev` → open `http://localhost:5000/api/health` → `{"status":"ok","database":"connected"}`.

## Step 5 — Helpers every route uses
* `utils/AppError.js` — an error with an HTTP status (`badRequest`, `forbidden`, `notFound`, `conflict`).
* `utils/asyncHandler.js` — lets you write `async` routes without try/catch everywhere.
* `utils/validators.js` — the `Validator` class collects **all** field problems into one message (SFR-02, SFR-51).
* `middleware/errorHandler.js` — converts any error into `{ success:false, message }` and maps PostgreSQL error codes
  (duplicate email → 409, bad UUID → 400).

## Step 6 — Authentication with JWT (SFR-01 to SFR-07)
1. **Register**: validate input → check email not used → `bcrypt.hash(password, 10)` → insert user (and an empty
   `provider_profiles` row if role = provider). Never store or log the plain password.
2. **Login**: find user by email → `bcrypt.compare` → `jwt.sign({ sub, role, jti }, JWT_SECRET, { expiresIn })`.
   Always answer **"Invalid email or password"** whether the email or password was wrong (SFR-07).
3. **Middleware `authenticate`**: read `Authorization: Bearer <token>` → `jwt.verify` → load the user from the DB
   (so the **role is checked on the server every time**, SFR-06).
4. **Middleware `requireRole('provider')`**: blocks other roles with 403.
5. **Logout**: store the token's `jti` in `revoked_tokens`; `authenticate` rejects revoked tokens (SFR-05).

**Check (Postman):** POST `/api/auth/register` → 201 + token. POST again with same email → 409. Login with wrong password → 401.

> Firebase instead of JWT? Replace `authenticate` with `admin.auth().verifyIdToken(token)` and keep a `users` row
> keyed by the Firebase UID. Everything else stays the same. This project uses JWT.

## Step 7 — Provider profile, services and images (SFR-08 to SFR-12)
* `PUT /providers/me`: updates bio/skills/city/area. The city is converted to **approximate** coordinates from
  `config/cities.js` — we never store an exact address (SFR-17, privacy).
* `routes/services.js`: add/edit/remove listings. Validate the category exists, price ≥ 0. **Ownership check**:
  `service.provider_id === req.user.user_id` unless admin (SFR-12). "Delete" sets `is_active = false` so old bookings
  still point to a valid row.
* Images: `multer` receives the file in memory (type + size limits, SFR-10) → `services/upload.js` sends it to
  **Cloudinary** (`upload_stream`) and we save only the returned `image_url`. Without Cloudinary keys it saves to `/uploads`.
  Cloudinary setup: dashboard → copy Cloud name, API key, API secret into `.env`.

## Step 8 — Search and filters (SFR-13 to SFR-17)
`services/providerSearch.js` builds the SQL dynamically **with parameters** (`$1, $2…` — never string-concatenate user
input; that prevents SQL injection). A provider appears only if she matches *all* chosen filters (SFR-14):
`EXISTS (SELECT 1 FROM services … category … price range)` + `city ILIKE` + `avg_rating >=`.
Sorting uses a **whitelist** (`rating`, `price_asc`, …) so users cannot inject SQL into `ORDER BY`.
**Maps:** `GET /providers/map` returns `{latitude, longitude}` per provider; the frontend draws markers with Leaflet.

## Step 9 — Bookings and the state machine (SFR-18 to SFR-24)
States: `pending → accepted/rejected`, `accepted → completed`, `pending/accepted → cancelled` (diagram in DIAGRAMS.md).
The important trick is a **conditional UPDATE**:
```sql
UPDATE bookings SET status = 'accepted' WHERE booking_id = $1 AND status = 'pending'
```
If 0 rows change, someone already changed it → return **409** "no longer pending". Even if two people click at once,
the database can never reach an invalid state (Correctness, SRS 4.3.3).
Creating a booking also validates "date not in the past" and inserts a `payments` row (`not_paid`) in one transaction.

## Step 10 — Simulated payment (SFR-26 to SFR-32)
`GET /payments/booking/:id` returns service, provider, amount and the notice
*"DEMONSTRATION ONLY… No real money has been transferred."* `POST …/confirm` needs `{ "confirm": true }`
(the confirmation button), only for the booking's customer, only when the booking is accepted/completed, only once.
Not calling confirm = the customer cancelled; nothing is recorded (SFR-30).

## Step 11 — Reviews (SFR-30 to SFR-36)
Rules: your own booking, status `completed`, rating integer 1–5, one per booking. In one transaction: insert the review
and recompute `avg_rating = ROUND(AVG(rating),1)` and `review_count` for the provider.

## Step 12 — Verification and reports (SFR-34 to SFR-43)
* Provider → `POST /verification/request` (profile must have bio + city) → request `pending`, profile `pending`.
* Admin → `GET /verification` lists pending → `PATCH /verification/:id` with `approve|reject` stores `reviewed_by` and
  `reviewed_at` and updates the profile status. Every admin route is behind `requireRole('admin')` (SFR-42).
* Reports: any user reports a profile/review/message; admin lists open reports and **dismisses** or **hides** the content.

## Step 13 — Real-time chat with Socket.io (SFR-25 to SFR-28)
Two ways to send, one rule set (`services/messageService.js`):
1. `POST /bookings/:id/messages` (REST, also saves history) and
2. Socket event `send_message`.
Flow: client connects with `io(URL, { auth: { token } })` → server middleware verifies the JWT → client emits
`join_booking` (server checks the user is the customer/provider of that booking) → `send_message` → server **saves
first**, then emits `new_message` to the room `booking:<id>`. If saving fails the sender gets `ack.error` so the UI
never shows an unsent message as sent (SFR-27). Messages are ordered by `sent_at`. Admins can read a conversation only
when an open report points at one of its messages (SFR-28).
**Check:** open `http://localhost:5000/` in two different browsers, sign in as `sara@…` and `fatima@…`, pick the
*Beauty · accepted* booking and chat.

## Step 14 — The trained chatbot (FR-39 to FR-43)
Goal: answer **any question about HunarGhar** and match customers to services — with *no paid API* and a model you
can explain in your viva.

**14.1 Training data** — `src/chatbot/data/intents.json`. Each *intent* has example phrases:
* `faq` intents (about project, booking, payment, verification, tech stack, team, SRS …) + a fixed answer taken from your SRS.
* `service` intents (tailoring, cooking, tutoring, beauty, handicrafts) incl. Roman-Urdu words (*silai, khana, mehndi*).
* `smalltalk` (greeting, thanks, bye).

**14.2 Preprocessing** — `nlp.js`: lowercase → remove punctuation → remove stop-words → light stemming
(*stitching → stitch*, *services → service*) → **unigrams + bigrams**.

**14.3 Model** — `naiveBayes.js`: **Multinomial Naive Bayes**. For each intent it learns how often each word appears.
For a new sentence it computes `log P(intent) + Σ log P(word | intent)` and converts the scores to probabilities.
Laplace smoothing (α = 0.2) handles unseen words.

**14.4 Training & evaluation** — `npm run train:chatbot` writes `model.json` and prints the report:
```
Intents 35 · Training samples 402 · Vocabulary 1282
Training accuracy 98.8%   Held-out test accuracy 97.2% (69/71 unseen questions)
```
The *held-out* set `test_questions.json` contains questions that are **not** in the training data — this is the honest accuracy.

**14.5 Chat engine** — `chatbot.js`:
1. Remove emails/phone numbers (privacy, SFR-48).
2. Extract **city** (Karachi, Lahore…) and **budget** ("under 3000") with regular expressions.
3. Classify the remaining text. If the top probability is low or most words are unknown → **fallback** message with a
   manual-search link (FR-41). This is how it refuses questions it cannot answer.
4. `faq/smalltalk` → return the stored answer. `service` → query the database via `searchProviders()` and return the
   category, a search link and matching providers.
5. Every reply carries the *"not a guarantee of quality, availability or safety"* disclaimer (SFR-47).

**Improving the chatbot:** add more phrases to `intents.json` (and new questions to `test_questions.json`), run
`npm run train:chatbot` again. To add a new topic, add a new intent object — no code change needed.
*Optional upgrade:* if you later get an LLM API key, call it only when the confidence is low, sending the scrubbed text.

## Step 15 — Seed data and tests
`scripts/seed.js` creates admin, customers, providers, bookings in every status, reviews, chat messages and a report so
your demo is never empty. `npm test` runs automated chatbot tests. Test the API in Postman using docs/API.md.

## Step 16 — Connect the frontend (React/Next.js)
```js
// api.js
const API = "http://localhost:5000/api";
export async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(API + path, { method, headers: { "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) });
  const data = await res.json();
  if (!data.success) throw new Error(data.message);
  return data;
}
```
* Save the token after login (memory or `localStorage`), send it in every call. After login, `redirectTo` tells which dashboard to open.
* **Leaflet map:** `npm i react-leaflet leaflet`; fetch `/providers/map` and render a `<Marker position={[lat, lng]}>` per provider using the OpenStreetMap tile URL `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.
* **Image upload:** `FormData` with field name `image` → `POST /providers/me/portfolio` (do not set Content-Type manually).
* **Chat:** `socket.io-client` as shown in docs/API.md.
* **Chatbot:** POST the text to `/chatbot/message`, show `reply`, the provider cards from `suggestions.providers` and the `disclaimer`.

## Step 17 — Deploy (free)
Supabase (PostgreSQL) → Render/Railway (this backend) → Vercel (frontend). Environment variables are listed in the README.
Run `npm run setup` once against the Supabase URL (with `DB_SSL=true`).

## Step 18 — Security checklist (SRS 4.2.1)
- [x] passwords hashed with bcrypt   - [x] JWT + server-side role checks   - [x] parameterised SQL only
- [x] input validated                - [x] secrets in `.env`, not in Git   - [x] helmet + CORS + rate limits
- [x] HTTPS on Render/Vercel         - [x] exact locations never exposed   - [x] payments labelled simulated

## Troubleshooting
| Problem | Fix |
|---|---|
| `ECONNREFUSED 5432` | PostgreSQL not running / wrong `DATABASE_URL` |
| `database "hunarghar" does not exist` | `psql -U postgres -c "CREATE DATABASE hunarghar;"` |
| `function gen_random_uuid() does not exist` | PostgreSQL < 13 → run `CREATE EXTENSION pgcrypto;` first |
| `Chatbot model not found` | `npm run train:chatbot` |
| Supabase/Render SSL error | set `DB_SSL=true` |
| CORS error in browser | add your frontend URL to `CLIENT_URL` |
| 401 after restart | the token expired or you logged out — log in again |

## Viva questions you should be able to answer
1. Why JWT and what is inside the token? Why do we still read the role from the DB?
2. How do you stop two users from accepting/cancelling the same booking at once? (conditional UPDATE + 409)
3. How does your chatbot work and why Naive Bayes? What is its accuracy and how did you measure it?
4. What happens when the chatbot does not know the answer? (confidence threshold → fallback)
5. How is a payment "simulated" and how do you make sure users are not misled? (notice + `mock_paid` only)
6. How do you prevent SQL injection? (parameterised queries, ORDER BY whitelist)
7. How do you protect a provider's location? (city-level coordinates only)
8. Why is `UNIQUE(booking_id)` on reviews? (SFR-35)
