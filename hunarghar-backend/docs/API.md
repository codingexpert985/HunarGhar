# HunarGhar API reference

Base URL: `http://localhost:5000/api`. JSON in, JSON out. Protected routes need the header
`Authorization: Bearer <token>` (token returned by login/register).
Every response has `success: true|false`; errors have `message` (and `details` for field errors).

## Auth
| Method & path | Who | Body | Notes |
|---|---|---|---|
| POST `/auth/register` | public | `fullName, email, password, role` (`customer`\|`provider`) | SFR-01..03. Provider gets an empty profile. |
| POST `/auth/login` | public | `email, password` | SFR-04, 07. Returns `token`, `user`, `redirectTo`. |
| POST `/auth/logout` | any | – | SFR-05. Token is revoked. |
| GET `/auth/me` | any | – | current user |

## Discovery (public)
| Method & path | Query | Notes |
|---|---|---|
| GET `/categories` | – | SFR-13 |
| GET `/providers` | `category, city, minPrice, maxPrice, minRating, sort(rating\|price_asc\|price_desc\|newest), verifiedOnly, page, limit` | SFR-13..16. Empty result → `message` + `suggestions`. |
| GET `/providers/map` | – | SFR-17. City-level markers `{latitude, longitude}` for Leaflet. |
| GET `/providers/:id` | – | profile, services, portfolio, reviews, verification status |

## Provider (role `provider`)
| Method & path | Body | Notes |
|---|---|---|
| GET `/providers/me` | – | own profile, services, portfolio, last verification request |
| PUT `/providers/me` | `bio, skills, city, area` | SFR-08 |
| POST `/providers/me/portfolio` | multipart field `image` (jpg/png/webp, ≤5 MB) | SFR-10 |
| DELETE `/providers/me/portfolio/:imageId` | – | |
| GET `/services/mine` · POST `/services` | `category, description, price, availability` | SFR-09 |
| PUT/DELETE `/services/:id` | same | owner or admin only (SFR-12) |
| POST `/verification/request` | – | SFR-38 |

## Bookings (signed in)
| Method & path | Who | Notes |
|---|---|---|
| POST `/bookings` | customer | `serviceId, requestedDatetime (ISO, future), notes?` → status `pending` (SFR-18) |
| GET `/bookings?status=` | customer/provider/admin | own bookings (SFR-19, 21) |
| GET `/bookings/:id` | participants, admin | SFR-22 |
| POST `/bookings/:id/accept` · `/reject` | provider | only while `pending` (SFR-20) |
| POST `/bookings/:id/cancel` | customer or provider | from `pending`/`accepted` (SFR-23) |
| POST `/bookings/:id/complete` | provider | from `accepted` (SFR-24) |
| GET / POST `/bookings/:id/messages` | participants | chat history / send (SFR-25..28). Admin may read only with an open message report. |

## Simulated payment
| Method & path | Notes |
|---|---|
| GET `/payments/booking/:bookingId` | service, provider, amount, `notice` (SFR-29) |
| POST `/payments/booking/:bookingId/confirm` | customer, body `{ "confirm": true }`, booking must be accepted/completed → `mock_paid` (SFR-30, 31). Every response says it is a demonstration (SFR-32). |

## Reviews & reports
| Method & path | Notes |
|---|---|
| POST `/reviews` | customer, `bookingId, rating(1-5), comment`, booking must be `completed`, one per booking (SFR-33..36) |
| GET `/reviews/provider/:providerId` | public |
| POST `/reports` | any signed-in user, `targetType(profile\|review\|message), targetId, reason` (SFR-37) |

## Admin (role `admin`)
| Method & path | Notes |
|---|---|
| GET `/verification?status=pending` | SFR-39 |
| PATCH `/verification/:id` | `{ decision: "approve"\|"reject", note? }` saves admin + time (SFR-40, 41) |
| GET `/reports?status=open` · PATCH `/reports/:id` | `{ action: "dismiss"\|"hide_content", note? }` (SFR-43) |
| GET `/admin/stats` · `/admin/users` · PATCH `/admin/users/:id/active` | dashboard helpers |
| POST `/categories` | add a new service category |

## Chatbot (public, rate-limited)
`POST /chatbot/message` `{ "message": "I need a tailor in Karachi under 3000" }`

```json
{
  "success": true, "type": "service_match", "intent": "service_tailoring", "confidence": 0.96,
  "reply": "It looks like you need Tailoring in Karachi within PKR 3000. Here are some providers that match:",
  "suggestions": { "category": "Tailoring", "city": "Karachi", "maxPrice": 3000,
                   "searchLink": "/search?category=Tailoring&city=Karachi&maxPrice=3000",
                   "providers": [ { "provider_id": "…", "name": "Ayesha Khan", "profileLink": "/providers/…" } ] },
  "disclaimer": "Note: these are automated suggestions, not a guarantee of provider quality, availability or safety.",
  "manualSearch": "/search"
}
```
`type` is `service_match`, `faq`, `smalltalk` or `fallback` (when not confident → show `manualSearch` link).
`GET /chatbot/info` returns model details.

## Socket.io (real-time chat)
```js
import { io } from "socket.io-client";
const socket = io("http://localhost:5000", { auth: { token } });
socket.emit("join_booking", bookingId, (ack) => { /* ack.ok */ });
socket.emit("send_message", { bookingId, content: "Hello" }, (ack) => { /* ack.ok / ack.error */ });
socket.on("new_message", (m) => { /* m.sender_name, m.content, m.sent_at */ });
socket.on("booking_status", ({ booking_id, status }) => {});
socket.on("connect_error", (e) => { /* show connection-status message (SFR-27) */ });
```

## Try it with curl
```bash
curl -s localhost:5000/api/providers?category=Tailoring\&city=Karachi
TOKEN=$(curl -s -X POST localhost:5000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"sara@example.com","password":"Password@123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -s localhost:5000/api/bookings -H "Authorization: Bearer $TOKEN"
curl -s -X POST localhost:5000/api/chatbot/message -H 'Content-Type: application/json' -d '{"message":"how does payment work?"}'
```
