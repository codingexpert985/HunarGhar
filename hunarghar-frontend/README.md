# HunarGhar Frontend

React 18 + Vite + Tailwind CSS frontend for the HunarGhar backend (Socket.io chat, Leaflet/OpenStreetMap map).

## Run it
```bash
# 1. start the backend first (in the backend folder):  npm run setup && npm run dev   -> http://localhost:5000
# 2. in this folder:
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:5000
npm run dev                 # -> http://localhost:5173
```
Demo logins (from the backend seed): `sara@example.com` / `Password@123` (customer), `ayesha@example.com` / `Password@123` (provider), `admin@hunarghar.com` / `Admin@12345` (admin).
For deployment: `npm run build`, host `dist/` on Vercel, set `VITE_API_URL` to your Render/Railway URL, and add the Vercel URL to `CLIENT_URL` in the backend `.env`.

## Pages and SRS coverage
| Route | Screen (SRS 3.1.1) | Requirements |
|---|---|---|
| `/` | Home page, category tiles, assistant prompt | FR-44, SFR-49 |
| `/register`, `/login` | Registration and sign-in | FR-01..05, SFR-01..07 |
| `/search` | Search with filters, sort, paging, map view | FR-11..15, SFR-13..17 |
| `/providers/:id` | Provider profile, services, portfolio, reviews, report, book | FR-09, FR-13, SFR-15, SFR-18, SFR-37 |
| `/assistant` | AI chatbot with fallback and disclaimer | FR-39..43, SFR-44..48 |
| `/customer/dashboard` | Customer bookings with status filter | FR-19, SFR-19, SFR-21 |
| `/bookings/:id` | Booking status actions, live chat, review | FR-16..25, FR-30, SFR-20..28, SFR-33..36 |
| `/bookings/:id/payment` | Simulated payment, clearly labelled demo | FR-26..29, SFR-29..32 |
| `/provider/dashboard` | Bookings, profile, services, portfolio, verification | FR-06..10, SFR-08..12, SFR-38 |
| `/admin/dashboard` | Verification queue, reports, users, categories | FR-33..38, SFR-39..43 |

Role-based navigation (SFR-50) and route guards are in `components/Layout.jsx` and `components/Guards.jsx`; the server still enforces every role check.
Field-level validation messages (SFR-51) come straight from the backend's error details.
