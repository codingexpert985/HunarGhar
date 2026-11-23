# Diagrams for the report (rubric criteria 4 and 5)

Paste each block into https://mermaid.live , export as PNG/PDF, and include it in your LaTeX report with `\includegraphics`.

## 1. Entity-Relationship Diagram (Database Design)
```mermaid
erDiagram
  USERS ||--o| PROVIDER_PROFILES : "is a"
  PROVIDER_PROFILES ||--o{ SERVICES : offers
  PROVIDER_PROFILES ||--o{ PORTFOLIO_IMAGES : uploads
  CATEGORIES ||--o{ SERVICES : classifies
  USERS ||--o{ BOOKINGS : "requests (customer)"
  PROVIDER_PROFILES ||--o{ BOOKINGS : receives
  SERVICES ||--o{ BOOKINGS : "booked for"
  BOOKINGS ||--o{ MESSAGES : has
  USERS ||--o{ MESSAGES : sends
  BOOKINGS ||--|| PAYMENTS : "has (simulated)"
  BOOKINGS ||--o| REVIEWS : "reviewed once"
  PROVIDER_PROFILES ||--o{ VERIFICATION_REQUESTS : submits
  USERS ||--o{ VERIFICATION_REQUESTS : "reviews (admin)"
  USERS ||--o{ REPORTS : files

  USERS { uuid user_id PK
          string full_name
          string email UK
          string password_hash
          enum role
          bool is_active }
  PROVIDER_PROFILES { uuid provider_id PK,FK
          text bio
          string city
          string area
          enum verification_status
          decimal avg_rating }
  SERVICES { uuid service_id PK
          uuid provider_id FK
          string category FK
          decimal price
          string availability }
  BOOKINGS { uuid booking_id PK
          uuid customer_id FK
          uuid provider_id FK
          uuid service_id FK
          timestamp requested_datetime
          enum status }
  MESSAGES { uuid message_id PK
          uuid booking_id FK
          uuid sender_id FK
          text content
          timestamp sent_at }
  PAYMENTS { uuid payment_id PK
          uuid booking_id FK,UK
          decimal amount
          enum mock_status }
  REVIEWS { uuid review_id PK
          uuid booking_id FK,UK
          int rating
          text comment }
  VERIFICATION_REQUESTS { uuid request_id PK
          uuid provider_id FK
          enum status
          uuid reviewed_by FK }
  REPORTS { uuid report_id PK
          uuid reporter_id FK
          string target_type
          uuid target_id
          enum status }
```

## 2. Booking state machine (Behavioural model)
```mermaid
stateDiagram-v2
  [*] --> pending : customer requests (SFR-18)
  pending --> accepted : provider accepts
  pending --> rejected : provider rejects
  pending --> cancelled : customer or provider cancels
  accepted --> cancelled : customer or provider cancels
  accepted --> completed : provider marks completed (SFR-24)
  rejected --> [*]
  cancelled --> [*]
  completed --> [*] : review allowed, completed cannot be cancelled
```

## 3. Verification state machine
```mermaid
stateDiagram-v2
  [*] --> unverified
  unverified --> pending : provider submits request
  pending --> verified : admin approves
  pending --> rejected : admin rejects
  rejected --> pending : provider re-submits
```

## 4. Sequence diagram: booking, payment and review
```mermaid
sequenceDiagram
  actor C as Customer
  actor P as Provider
  participant API as Express API
  participant DB as PostgreSQL
  C->>API: POST /bookings (service, date)
  API->>DB: validate, INSERT booking(pending) + payment(not_paid)
  API-->>C: 201 booking pending
  P->>API: POST /bookings/:id/accept
  API->>DB: UPDATE ... WHERE status='pending'
  API-->>P: accepted (409 if no longer pending)
  C->>API: POST /payments/booking/:id/confirm {confirm:true}
  API->>DB: payment.mock_status = mock_paid
  API-->>C: "DEMONSTRATION ONLY" confirmation
  P->>API: POST /bookings/:id/complete
  C->>API: POST /reviews (rating 1-5)
  API->>DB: INSERT review, recompute avg_rating (transaction)
  API-->>C: review published
```

## 5. Sequence diagram: real-time chat
```mermaid
sequenceDiagram
  participant A as Customer browser
  participant S as Socket.io server
  participant DB as PostgreSQL
  participant B as Provider browser
  A->>S: connect (auth.token = JWT)
  S->>S: verify JWT, load user
  A->>S: join_booking(bookingId)
  S->>DB: check participant of booking
  S-->>A: ack ok
  A->>S: send_message({bookingId, content})
  S->>DB: INSERT message (saved first)
  S-->>B: new_message (if online)
  S-->>A: ack ok / error (never shown as sent if not saved)
```

## 6. Sequence diagram: chatbot
```mermaid
sequenceDiagram
  actor C as Customer
  participant API as POST /chatbot/message
  participant NLP as Trained Naive Bayes model
  participant DB as PostgreSQL
  C->>API: "I need a tailor in Karachi under 3000"
  API->>API: remove e-mail / phone numbers
  API->>NLP: extract city + budget, classify intent
  alt confident service intent
    API->>DB: search providers (category, city, price)
    API-->>C: category + provider links + disclaimer
  else FAQ intent
    API-->>C: project answer + disclaimer
  else low confidence
    API-->>C: fallback message + manual search link
  end
```

## 7. System architecture (Component diagram)
```mermaid
flowchart LR
  U[Customer / Provider / Admin] --> F[React or Next.js frontend]
  F -- REST + JWT --> B[Node.js + Express API]
  F -- Socket.io --> B
  B --> D[(PostgreSQL)]
  B --> I[Cloudinary images]
  B --> M[Chatbot: Naive Bayes model.json]
  F --> L[Leaflet + OpenStreetMap tiles]
```
