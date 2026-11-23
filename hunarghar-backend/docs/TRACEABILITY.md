# Requirement traceability: SRS → backend implementation
(Rubric criteria 2 & 3: "precise and traceable", "consistent with user requirements".)

| SRS requirement | Implemented by | File |
|---|---|---|
| FR-01, SFR-01..02 registration + validation | `POST /api/auth/register` | routes/auth.js |
| SFR-03 hashed passwords | bcrypt → `password_hash` | routes/auth.js |
| FR-02, SFR-04..05 sign in/out | `POST /auth/login`, `/auth/logout` (token revocation) | routes/auth.js, middleware/auth.js |
| FR-03..04, SFR-06, SFR-42 role checks on server | `authenticate`, `requireRole` | middleware/auth.js |
| FR-05, SFR-07 generic login error | "Invalid email or password" | routes/auth.js |
| FR-06, SFR-08 provider profile | `PUT /providers/me` | routes/providers.js |
| FR-07, SFR-09 service listings | `/services` CRUD | routes/services.js |
| FR-08, SFR-10 portfolio images | `POST /providers/me/portfolio` (type/size check, Cloudinary) | routes/providers.js, services/upload.js |
| FR-09, SFR-11, SFR-41 verification status shown | `verification_status` in search + profile | services/providerSearch.js |
| FR-10, SFR-12 ownership | `loadOwned()` | routes/services.js |
| FR-11, SFR-13 browse without login | public `GET /providers`, `/categories` | routes/providers.js |
| FR-12, SFR-14 filters (all must match) + sort | `searchProviders()` | services/providerSearch.js |
| FR-13, SFR-15 result fields | min_price, services[], avg_rating, status | services/providerSearch.js |
| FR-14, SFR-16 no-match message | `message` + `suggestions` | routes/providers.js |
| FR-15, SFR-17 approximate location only | city-level `latitude/longitude` | config/cities.js, `GET /providers/map` |
| FR-16..17, SFR-18..19 booking request | `POST /bookings`, `GET /bookings` | routes/bookings.js |
| FR-18, SFR-20 accept/reject only while pending | conditional `UPDATE … WHERE status='pending'` | routes/bookings.js |
| FR-19, SFR-21 status shown, persists on refresh | status column + `GET /bookings/:id` | routes/bookings.js |
| FR-20, SFR-22 unauthorised users refused | participant/admin check | routes/bookings.js |
| FR-21, SFR-23 cancel | `POST /bookings/:id/cancel` (completed cannot be cancelled) | routes/bookings.js |
| SFR-24 mark completed | `POST /bookings/:id/complete` | routes/bookings.js |
| FR-22..23, SFR-25..26 chat | REST + Socket.io, ordered by `sent_at`, sender shown | services/messageService.js, sockets/chat.js |
| FR-24, SFR-27 connection status / not shown if unsaved | ack with error; save before emit | sockets/chat.js |
| FR-25, SFR-28 conversation privacy | `canReadConversation()` | services/messageService.js |
| FR-26..29, SFR-29..32 simulated payment | `/payments/booking/:id` + `/confirm` with demo notice | routes/payments.js |
| FR-30, SFR-33..34 review rules | completed + owner + rating 1–5 | routes/reviews.js |
| FR-31, SFR-36 reviews + average on profile | `recalcProviderRating()` | services/reviewService.js |
| FR-32, SFR-35 one review per booking | `UNIQUE(booking_id)` + check | schema.sql, routes/reviews.js |
| FR-33, SFR-37, SFR-43 reports | `/reports` | routes/reports.js |
| FR-34..36, SFR-38..41 verification workflow | `/verification` | routes/verification.js |
| FR-37, SFR-42 admin only | `router.use(requireRole('admin'))` | routes/admin.js |
| FR-39..43, SFR-44..48 chatbot | trained model, fallback, disclaimer, PII scrubbing | src/chatbot/*, routes/chatbot.js |
| FR-44..46, SFR-49..51 navigation/validation messages | `redirectTo` on login; `Validator` field messages | routes/auth.js, utils/validators.js |
| NFR 4.2.1 security | bcrypt, JWT, helmet, rate limit, secrets in `.env` | app.js, config/env.js |
| NFR 4.3.3 correctness (invalid transitions rejected) | atomic conditional UPDATEs, 409 errors | routes/bookings.js |
| NFR 4.3.12 usability (error messages) | consistent `{success, message, details}` | middleware/errorHandler.js |

## Fields added to the Data Dictionary (update SRS Appendix A so the report stays consistent)
`users.is_active`, `bookings.notes`, `bookings.created_at/updated_at`, `provider_profiles.skills`, `latitude`, `longitude`, `review_count`,
`reviews.customer_id/provider_id/is_hidden/created_at`, `messages.is_hidden`, `payments.paid_at`,
`verification_requests.submitted_at/admin_note`, `reports.created_at/resolved_by/resolved_at/admin_note`, `services.is_active`, `portfolio_images.created_at`,
and two supporting tables: `categories` and `revoked_tokens`.

## Open decisions in the SRS that this backend settles (tell your team!)
* Database: **PostgreSQL** (SRS Chapter 4 lists "PostgreSQL or SQLite"; proposal says PostgreSQL/MongoDB).
* Authentication: **JWT** (not Firebase).
* Cancellation: customer or provider may cancel while `pending` or `accepted`.
* Who marks a booking completed: the **provider**.
* Payment allowed when a booking is `accepted` or `completed`.
* Admin can read a conversation only when an open report targets one of its messages.
* Minimum password length: 8 characters.
