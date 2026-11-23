# HunarGhar — Backend + Trained Chatbot

Backend for **HunarGhar – Home-Based Women's Services Platform** (Software Engineering CEP, NED University).
Implements the SRS (FR-01…FR-46, SFR-01…SFR-51) with **Node.js + Express, PostgreSQL, JWT auth, Socket.io chat,
Cloudinary image storage, OpenStreetMap-ready location data** and a **locally trained chatbot** that answers any
question about the HunarGhar project and matches customers to service categories/providers.

## Quick start (5 commands)

```bash
# 1. Install Node.js 18+ and PostgreSQL 13+   (or run:  docker compose up -d   for PostgreSQL)
npm install
# 2. Create the database once (skip if you used docker compose)
#    psql -U postgres -c "CREATE DATABASE hunarghar;"
cp .env.example .env     # then check DATABASE_URL and JWT_SECRET inside .env
npm run setup        # = create tables + load demo data + train the chatbot
npm run dev          # API + demo page on http://localhost:5000
```

Open **http://localhost:5000** — a demo page to try the chatbot and the live Socket.io chat without any frontend.

| Role     | Login                      | Password       |
|----------|----------------------------|----------------|
| Admin    | admin@hunarghar.com        | Admin@12345    |
| Customer | sara@example.com           | Password@123   |
| Provider | ayesha@example.com         | Password@123   |

Other seeded users: omar@ / laiba@ (customers), sana@ hina@ fatima@ zainab@ maryam@ rabia@ iqra@ (providers), all `@example.com`.

## npm scripts

| Command | What it does |
|---|---|
| `npm run setup` | `db:init` + `db:seed` + `train:chatbot` |
| `npm run db:init` / `db:reset` | create tables / drop everything and recreate |
| `npm run db:seed` | demo users, providers, bookings, reviews, chat, reports |
| `npm run train:chatbot` | train the chatbot model and print an accuracy report |
| `npm test` | chatbot unit tests (no database needed) |
| `npm run dev` / `npm start` | run with auto-reload / run normally |

## Folder structure

```
src/
  server.js            HTTP + Socket.io bootstrap
  app.js               Express app, middleware, route mounting
  config/              env.js, db.js (pg pool + transactions), cities.js (approx. map coordinates)
  middleware/          auth.js (JWT + roles), errorHandler.js
  routes/              auth, categories, providers, services, bookings, payments, reviews,
                       verification, reports, admin, chatbot
  services/            providerSearch (filters), messageService, reviewService, upload (Cloudinary/local)
  sockets/chat.js      real-time chat events
  chatbot/             nlp.js, naiveBayes.js, train.js, chatbot.js, model.json,
                       data/intents.json (training data), data/test_questions.json (held-out test set)
  utils/               AppError, asyncHandler, validators
database/schema.sql    PostgreSQL schema (SRS Appendix A)
scripts/               initDb.js, seed.js
public/                demo page for chatbot + live chat
docs/                  STEP_BY_STEP_GUIDE.md, API.md, DIAGRAMS.md, TRACEABILITY.md, report_snippets.tex
tests/                 chatbot tests
```

## Deploy (all free tiers, as in the proposal)
* **Database:** Supabase → Project Settings → Database → copy the URI into `DATABASE_URL`, set `DB_SSL=true`, run `npm run setup` once from your laptop.
* **Backend:** Render or Railway → New Web Service from your GitHub repo → build `npm install` → start `npm start` → add every variable from `.env`.
* **Images:** create a free Cloudinary account and fill the three `CLOUDINARY_*` variables (otherwise images are saved to `/uploads`, which free hosts erase on restart).
* Set `CLIENT_URL` to your Vercel frontend URL so CORS allows it.

Read **docs/STEP_BY_STEP_GUIDE.md** to learn how to build every part yourself, and **docs/API.md** for the endpoints to give your frontend teammates.
