# API Documentation

Complete API reference for Krishi Setu Backend.

## Base URL

```
http://localhost:3000
```

## Authentication

Most endpoints require authentication via Supabase JWT token. Include the token in the Authorization header:

```
Authorization: Bearer <your-supabase-jwt-token>
```

**Note:** Authentication endpoints (OTP send/verify) are not yet implemented. Current authentication middleware expects valid Supabase JWT tokens.

## Response Format

### Success Response
```json
{
  "status": "success",
  "data": { ... }
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Error description"
}
```

## Endpoints

### Health Check

#### GET /api/health

Check server health and status.

**Authentication:** None  
**Required Role:** None  
**Parameters:** None

**Example Request:**
```bash
curl http://localhost:3000/api/health
```

**Example Response:**
```json
{
  "status": "success",
  "message": "Krishi Setu Backend is running",
  "timestamp": "2026-09-03T11:25:26.299Z",
  "environment": "development"
}
```

**Error Responses:**
- None (always returns 200)

---

### Crops

#### GET /api/crops

Get all available crops from the catalog.

**Authentication:** None  
**Required Role:** None  
**Parameters:** None

**Example Request:**
```bash
curl http://localhost:3000/api/crops
```

**Example Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "name": "Wheat",
      "unit": "quintal",
      "created_at": "2026-09-03T10:00:00.000Z"
    },
    {
      "id": 2,
      "name": "Rice",
      "unit": "quintal",
      "created_at": "2026-09-03T10:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `503 Service Unavailable` - Database not configured
  ```json
  {
    "status": "error",
    "message": "Database not configured. Please set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in environment variables."
  }
  ```

---

### Procurement Schedules

#### POST /api/procurement/schedules

Create a new procurement schedule with automatic time slot generation.

**Authentication:** Required  
**Required Role:** Official  
**Parameters:** None

**Request Body:**
```json
{
  "crop_id": 1,
  "mandi_name": "Azadpur Mandi",
  "date": "2026-09-10",
  "window_start": "09:00",
  "window_end": "17:00",
  "slot_duration_minutes": 15,
  "capacity": 5
}
```

**Validation Rules:**
- `crop_id`: Required, integer, must exist in crops table
- `mandi_name`: Required, string, 2-100 characters
- `date`: Required, ISO date format
- `window_start`: Required, HH:MM format
- `window_end`: Required, HH:MM format, must be after window_start
- `slot_duration_minutes`: Required, integer, 5-120 minutes
- `capacity`: Required, integer, minimum 1

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/procurement/schedules \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "crop_id": 1,
    "mandi_name": "Azadpur Mandi",
    "date": "2026-09-10",
    "window_start": "09:00",
    "window_end": "17:00",
    "slot_duration_minutes": 15,
    "capacity": 5
  }'
```

**Example Response:**
```json
{
  "status": "success",
  "message": "Schedule created successfully",
  "data": {
    "schedule": {
      "id": 1,
      "official_id": "uuid-of-official",
      "crop_id": 1,
      "mandi_name": "Azadpur Mandi",
      "date": "2026-09-10",
      "window_start": "09:00:00",
      "window_end": "17:00:00",
      "slot_duration_minutes": 15,
      "capacity": 5,
      "created_at": "2026-09-03T11:00:00.000Z",
      "updated_at": "2026-09-03T11:00:00.000Z"
    },
    "slots": [
      {
        "id": 1,
        "schedule_id": 1,
        "start_time": "09:00",
        "end_time": "09:15",
        "capacity": 5,
        "booked_count": 0,
        "created_at": "2026-09-03T11:00:00.000Z"
      },
      {
        "id": 2,
        "schedule_id": 1,
        "start_time": "09:15",
        "end_time": "09:30",
        "capacity": 5,
        "booked_count": 0,
        "created_at": "2026-09-03T11:00:00.000Z"
      }
    ]
  }
}
```

**Error Responses:**
- `401 Unauthorized` - No token provided or invalid token
- `403 Forbidden` - User does not have Official role
- `400 Bad Request` - Validation error
  ```json
  {
    "status": "error",
    "message": "Validation failed",
    "details": ["\"crop_id\" is required"]
  }
  ```
- `503 Service Unavailable` - Database not configured

---

#### GET /api/procurement/schedules

Get all procurement schedules with optional filtering.

**Authentication:** None (public endpoint)  
**Required Role:** None  
**Parameters:** Query parameters

**Query Parameters:**
- `crop_id` (optional): Filter by crop ID
- `date` (optional): Filter by date (YYYY-MM-DD format)

**Example Request:**
```bash
# Get all schedules
curl http://localhost:3000/api/procurement/schedules

# Filter by crop
curl http://localhost:3000/api/procurement/schedules?crop_id=1

# Filter by date
curl http://localhost:3000/api/procurement/schedules?date=2026-09-10
```

**Example Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "official_id": "uuid-of-official",
      "crop_id": 1,
      "mandi_name": "Azadpur Mandi",
      "date": "2026-09-10",
      "window_start": "09:00:00",
      "window_end": "17:00:00",
      "slot_duration_minutes": 15,
      "capacity": 5,
      "created_at": "2026-09-03T11:00:00.000Z",
      "updated_at": "2026-09-03T11:00:00.000Z",
      "crops": {
        "name": "Wheat",
        "unit": "quintal"
      },
      "users": {
        "name": "Admin Official"
      }
    }
  ]
}
```

**Error Responses:**
- `503 Service Unavailable` - Database not configured

---

### Procurement Slots

#### GET /api/procurement/slots/:scheduleId

Get all time slots for a specific schedule with availability information.

**Authentication:** None (public endpoint)  
**Required Role:** None  
**Parameters:** URL parameter

**URL Parameters:**
- `scheduleId` (required): Schedule ID

**Example Request:**
```bash
curl http://localhost:3000/api/procurement/slots/1
```

**Example Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "schedule_id": 1,
      "start_time": "09:00",
      "end_time": "09:15",
      "capacity": 5,
      "booked_count": 0,
      "available": 5,
      "created_at": "2026-09-03T11:00:00.000Z"
    },
    {
      "id": 2,
      "schedule_id": 1,
      "start_time": "09:15",
      "end_time": "09:30",
      "capacity": 5,
      "booked_count": 3,
      "available": 2,
      "created_at": "2026-09-03T11:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `503 Service Unavailable` - Database not configured

---

### Procurement Bookings

#### POST /api/procurement/bookings

Book a specific time slot for a given quantity of the slot's crop (Farmer only).
The crop itself is implicit — it comes from the slot's schedule (`crop_id`) — only
the quantity is provided by the farmer.

**Authentication:** Required  
**Required Role:** Farmer  
**Parameters:** None

**Status:** Live and verified via real HTTP testing (2026-09-05) — the
`utils/migration_add_booking_quantity.sql` migration has been applied.

**Request Body:**
```json
{
  "slot_id": 1,
  "quantity": 25
}
```

**Validation Rules:**
- `slot_id`: Required, integer, must exist and have available capacity
- `quantity`: Required, positive number

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/procurement/bookings \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"slot_id": 1, "quantity": 25}'
```

**Example Response:**
```json
{
  "status": "success",
  "message": "Slot booked successfully",
  "data": {
    "id": 1,
    "slot_id": 1,
    "farmer_id": "uuid-of-farmer",
    "quantity": 25,
    "status": "booked",
    "created_at": "2026-09-03T12:00:00.000Z",
    "updated_at": "2026-09-03T12:00:00.000Z"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - No token provided or invalid token
- `403 Forbidden` - User does not have Farmer role
- `400 Bad Request` - Validation error (missing/non-positive quantity, missing slot_id)
- `404 Not Found` - Slot does not exist
- `409 Conflict` - Slot is fully booked or farmer already booked this slot
  ```json
  {
    "status": "error",
    "message": "Slot is fully booked"
  }
  ```
- `503 Service Unavailable` - Database not configured

---

#### GET /api/procurement/bookings/me

Get all bookings for the authenticated farmer.

**Authentication:** Required  
**Required Role:** Farmer  
**Parameters:** None

**Example Request:**
```bash
curl http://localhost:3000/api/procurement/bookings/me \
  -H "Authorization: Bearer <token>"
```

**Example Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "slot_id": 1,
      "farmer_id": "uuid-of-farmer",
      "quantity": 25,
      "status": "booked",
      "created_at": "2026-09-03T12:00:00.000Z",
      "updated_at": "2026-09-03T12:00:00.000Z",
      "procurement_slots": {
        "id": 1,
        "start_time": "09:00",
        "end_time": "09:15",
        "capacity": 5,
        "booked_count": 1,
        "procurement_schedules": {
          "id": 1,
          "date": "2026-09-10",
          "mandi_name": "Azadpur Mandi",
          "crops": {
            "name": "Wheat",
            "unit": "quintal"
          },
          "window_start": "09:00",
          "window_end": "17:00"
        }
      }
    }
  ]
}
```

Only returns the authenticated farmer's own bookings — verified live that a
different farmer's bookings never appear in this list.

**Error Responses:**
- `401 Unauthorized` - No token provided or invalid token
- `403 Forbidden` - User does not have Farmer role
- `503 Service Unavailable` - Database not configured

---

#### GET /api/procurement/bookings

Get all bookings across all farmers (Official only).

**Authentication:** Required  
**Required Role:** Official  
**Query Parameters:**
- `status` (optional) - filter by booking status (`booked`, `arrived`, `completed`, `missed`)

**Example Request:**
```bash
curl http://localhost:3000/api/procurement/bookings?status=booked \
  -H "Authorization: Bearer <official-token>"
```

**Example Response:** Same shape as `GET /api/procurement/bookings/me`, but includes
every farmer's bookings and adds a `users` field with the booking farmer's
`id`/`name`/`location`.

**Error Responses:**
- `401 Unauthorized` - No token provided or invalid token
- `403 Forbidden` - User does not have Official role (verified live: a farmer token gets 403)
- `503 Service Unavailable` - Database not configured

---

#### PUT /api/procurement/bookings/:id/status

Update the status of a booking (Official only). Rejects the change if the booking
does not exist, or if it is already `completed`/`missed` (a terminal state) —
statuses cannot be changed once a booking reaches one of those.

**Authentication:** Required  
**Required Role:** Official  
**Parameters:** URL parameter + request body

**URL Parameters:**
- `id` (required): Booking ID

**Request Body:**
```json
{
  "status": "arrived"
}
```

**Validation Rules:**
- `status`: Required, must be one of: `booked`, `arrived`, `completed`, `missed`

**Example Request:**
```bash
curl -X PUT http://localhost:3000/api/procurement/bookings/1/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "arrived"}'
```

**Example Response:**
```json
{
  "status": "success",
  "message": "Booking status updated",
  "data": {
    "id": 1,
    "slot_id": 1,
    "farmer_id": "uuid-of-farmer",
    "status": "arrived",
    "created_at": "2026-09-03T12:00:00.000Z",
    "updated_at": "2026-09-03T14:00:00.000Z"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - No token provided or invalid token
- `403 Forbidden` - User does not have Official role
- `400 Bad Request` - Validation error (invalid status value), or the booking is
  already `completed`/`missed` and cannot be changed further
- `404 Not Found` - Booking does not exist
- `503 Service Unavailable` - Database not configured

---

### Listings

**Status:** Live and verified via real HTTP testing (2026-09-05) — create, browse, bid,
accept/reject, order creation, mock payment, and completion/cancellation were all
exercised end-to-end against a running server. See CHANGELOG.md for the full test list.

#### POST /api/listings

Create a new crop listing.

**Authentication:** Required
**Required Role:** Farmer
**Request Body:**
```json
{
  "crop_id": 1,
  "quantity": 100,
  "price": 25.5,
  "location": "Nashik, Maharashtra"
}
```

**Validation Rules:**
- `crop_id`: Required, integer, must exist in crops table
- `quantity`: Required, positive number
- `price`: Required, positive number (expected price per unit)
- `location`: Optional, string, max 200 characters

**Example Response (201):**
```json
{
  "status": "success",
  "message": "Listing created successfully",
  "data": {
    "id": 1,
    "farmer_id": "uuid-of-farmer",
    "crop_id": 1,
    "quantity": 100,
    "price": 25.5,
    "location": "Nashik, Maharashtra",
    "status": "active",
    "created_at": "2026-09-04T10:00:00.000Z",
    "updated_at": "2026-09-04T10:00:00.000Z",
    "crops": { "id": 1, "name": "Wheat", "unit": "quintal" },
    "users": { "id": "uuid-of-farmer", "name": "Farmer Name", "location": "Nashik, Maharashtra" }
  }
}
```

**Error Responses:** `401`, `403` (not a farmer), `400` (validation), `503`

---

#### GET /api/listings

Browse active listings (public).

**Authentication:** None
**Query Parameters (all optional):**
- `crop_id` - filter by crop
- `location` - partial, case-insensitive match
- `min_price`, `max_price` - price range filter
- `limit`, `offset` - pagination (default limit 50)

Only listings with `status = 'active'` are returned.

**Example Request:**
```bash
curl "http://localhost:3000/api/listings?crop_id=1&location=Nashik&min_price=20&max_price=30"
```

---

#### GET /api/listings/me

Get the authenticated farmer's own listings, of any status.

**Authentication:** Required
**Required Role:** Farmer

---

#### GET /api/listings/:id

View a single listing's details (public), regardless of status.

**Authentication:** None
**Error Responses:** `404` if not found

---

#### PUT /api/listings/:id

Update a listing you own.

**Authentication:** Required
**Required Role:** Farmer (must own the listing)
**Request Body:** any of `quantity`, `price`, `location`, `status` (`active`/`inactive`); at least one field required.

**Error Responses:**
- `403` - not the owner
- `400` - listing already `sold` (immutable), or validation failure
- `404` - not found

---

#### DELETE /api/listings/:id

Deactivate (soft-delete) a listing you own. Sets `status = 'inactive'`; the row is never removed.

**Authentication:** Required
**Required Role:** Farmer (must own the listing)
**Error Responses:** `403` (not owner), `400` (already sold), `404`

---

### Bids

#### POST /api/listings/:id/bids

Place a bid on an active listing.

**Authentication:** Required
**Required Role:** Retailer
**Request Body:**
```json
{
  "quantity": 50,
  "price": 27
}
```

**Rules:**
- Listing must be `active`
- Cannot bid on your own listing
- Bid `quantity` cannot exceed the listing's quantity
- Cannot have two simultaneous `pending` bids on the same listing (`409 Conflict`)

**Error Responses:** `401`, `403` (not a retailer / own listing), `400` (inactive listing / bad quantity), `404` (listing not found), `409` (duplicate pending bid)

---

#### GET /api/listings/:id/bids

View all bids on a listing you own, ordered by price (highest first).

**Authentication:** Required
**Required Role:** Farmer (must own the listing)

---

#### GET /api/bids/me

View all bids you've placed.

**Authentication:** Required
**Required Role:** Retailer

---

#### PUT /api/bids/:id/accept

Accept a pending bid. Automatically rejects every other pending bid on the same listing, marks the listing `sold`, and creates an order.

**Authentication:** Required
**Required Role:** Farmer (must own the listing the bid was placed on)

**Example Response (200):**
```json
{
  "status": "success",
  "message": "Bid accepted and order created",
  "data": {
    "bid": { "id": 5, "status": "accepted", "...": "..." },
    "order": {
      "id": 3,
      "listing_id": 1,
      "bid_id": 5,
      "farmer_id": "uuid-of-farmer",
      "retailer_id": "uuid-of-retailer",
      "quantity": 50,
      "final_price": 27,
      "total_amount": 1350,
      "status": "confirmed"
    }
  }
}
```

**Error Responses:** `403` (not owner), `400` (listing not active / bid not pending), `404`,
`409` (rare: two accept requests for the same bid arrived concurrently — only one wins)

If any step after the bid is marked accepted fails (rejecting competitors, marking the
listing sold, or creating the order), the operation rolls back the bid and any
already-rejected competing bids back to `pending` and the listing back to `active`
before returning an error, so a retry starts from a clean, consistent state.

---

#### PUT /api/bids/:id/reject

Reject a pending bid.

**Authentication:** Required
**Required Role:** Farmer (must own the listing the bid was placed on)
**Error Responses:** `403` (not owner), `400` (bid not pending), `404`

---

### Orders & Mock Payment

Order status flow as implemented: `confirmed` (on bid acceptance) → `paid` (mock payment) → `completed` (delivery confirmed). `cancelled` is reachable from `confirmed` only (before payment), and reopens the source listing to `active`.

#### GET /api/orders/me

Get your own orders (as farmer or retailer, based on your role).

**Authentication:** Required
**Required Role:** Farmer or Retailer

---

#### GET /api/orders/:id

View a single order. Only the farmer or retailer on the order may view it.

**Authentication:** Required
**Error Responses:** `403` (not a participant), `404`

---

#### POST /api/orders/:id/pay

Simulate a mock payment for the order. Always succeeds deterministically — **no real payment gateway is used.** Only allowed once per order, and only by the buyer, while the order is `confirmed`.

**Authentication:** Required
**Required Role:** Retailer (must be the buyer on the order)

**Example Response (200):**
```json
{
  "status": "success",
  "message": "Mock payment successful",
  "data": {
    "order": { "id": 3, "status": "paid", "...": "..." },
    "payment": {
      "id": 1,
      "order_id": 3,
      "amount": 1350,
      "status": "success",
      "method": "mock",
      "paid_at": "2026-09-04T10:05:00.000Z"
    }
  }
}
```

**Error Responses:** `403` (not the buyer), `400` (order not in `confirmed` status), `409` (already paid), `404`

If the payment record is created but the subsequent order-status update fails, the
payment record is rolled back so a retry isn't permanently blocked by the one-payment-
per-order constraint.

---

#### GET /api/orders/:id/payment

View the mock payment record for an order.

**Authentication:** Required
**Error Responses:** `403` (not a participant), `404` (no payment yet, or order not found)

---

#### PUT /api/orders/:id/complete

Mark a paid order as completed (e.g. delivery confirmed). Either participant may call this.

**Authentication:** Required
**Error Responses:** `403` (not a participant), `400` (order not `paid`), `404`

---

#### PUT /api/orders/:id/cancel

Cancel an order that has not yet been paid. Reopens the source listing to `active`. Either participant may call this.

**Authentication:** Required
**Error Responses:** `403` (not a participant), `400` (order not `confirmed`, e.g. already paid), `404`

---

### Notifications

**Status:** Live and verified via real HTTP testing (2026-09-05) — creation, viewing,
mark-as-read, ownership enforcement, and every trigger listed below were all
exercised end-to-end against a running server (28/28 checks passed). Notification
creation is deliberately "fire and forget": a notification failure never breaks
the action that triggered it (failures are only logged server-side), which was
also verified directly by testing the trigger points before this table existed.

Farmers, retailers, and officials can all view and manage their own notifications
via the same two endpoints — there is no role restriction beyond authentication.

#### GET /api/notifications/me

Get the authenticated user's own notifications, newest first.

**Authentication:** Required
**Required Role:** Any (Farmer, Retailer, or Official)

**Example Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "user_id": "uuid-of-user",
      "type": "bid_accepted",
      "title": "Bid accepted",
      "message": "Your bid on listing #4 was accepted. An order has been created.",
      "related_type": "order",
      "related_id": 7,
      "is_read": false,
      "created_at": "2026-09-05T10:00:00.000Z"
    }
  ]
}
```

**Notification types currently triggered:**
| Type | When | Recipient |
|---|---|---|
| `bid_placed` | A retailer places a bid | The listing's farmer |
| `bid_accepted` | A farmer accepts a bid | The winning retailer |
| `bid_rejected` | A farmer rejects a bid, or it loses to another accepted bid | The affected retailer |
| `payment_update` | A retailer completes the mock payment | The order's farmer |
| `order_update` | An order is marked completed or cancelled | The other participant (not whoever triggered it) |
| `booking_update` | A farmer books a procurement slot | The official who owns that schedule |
| `booking_update` | An official updates a booking's status | The farmer who made that booking |

**Error Responses:** `401` (no/invalid token), `503` (database not configured)

---

#### PUT /api/notifications/:id/read

Mark one of your own notifications as read.

**Authentication:** Required
**Required Role:** Any (Farmer, Retailer, or Official) — must own the notification

**Example Request:**
```bash
curl -X PUT http://localhost:3000/api/notifications/1/read \
  -H "Authorization: Bearer <token>"
```

**Error Responses:** `401`, `403` (not your notification), `404` (not found)

---

### Dashboard

**Status:** Live and verified via real HTTP testing (2026-09-05) — 34/34 checks
passed, covering fresh-user baselines, role restrictions in both directions,
and confirming real data (listings, bids, orders, bookings, notifications)
actually appears in the right dashboard after being created.

Each endpoint is a thin aggregation of data you can already fetch individually
via other endpoints — no new tables, no new business logic, just convenient
single-call summaries for a role's home screen.

#### GET /api/dashboard/farmer

**Authentication:** Required
**Required Role:** Farmer

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "listings": [ /* same shape as GET /api/listings/me */ ],
    "bids": [ /* bids placed on any of this farmer's listings */ ],
    "orders": [ /* same shape as GET /api/orders/me */ ],
    "bookings": [ /* same shape as GET /api/procurement/bookings/me */ ],
    "notifications": [ /* same shape as GET /api/notifications/me */ ]
  }
}
```

**Error Responses:** `401`, `403` (not a farmer)

---

#### GET /api/dashboard/retailer

**Authentication:** Required
**Required Role:** Retailer

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "bids": [ /* same shape as GET /api/bids/me */ ],
    "orders": [ /* same shape as GET /api/orders/me */ ],
    "notifications": [ /* same shape as GET /api/notifications/me */ ]
  }
}
```

**Error Responses:** `401`, `403` (not a retailer)

---

#### GET /api/dashboard/official

**Authentication:** Required
**Required Role:** Official

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "bookings": [ /* same shape as GET /api/procurement/bookings */ ],
    "summary": {
      "total": 12,
      "booked": 5,
      "arrived": 3,
      "completed": 3,
      "missed": 1
    }
  }
}
```

`summary` is computed directly from `bookings` (no separate query) — a total
count plus one count per booking status.

**Error Responses:** `401`, `403` (not an official)

---

### AI Chatbot

**Status:** Fully implemented and live-tested end-to-end (2026-09-06),
including real AI-generated replies. `NVIDIA_NIM_API_KEY` is configured and
working. 17/17 automated checks passed via real HTTP requests: authentication,
validation, two general farming questions, one mandi-price-grounded question,
and regression checks on unrelated endpoints.

#### POST /api/chat

Ask the farming assistant a question. Uses NVIDIA NIM (an OpenAI-compatible
chat completion API) via a direct `axios` call — no new npm dependency was
added; this reuses the same HTTP-client pattern as `services/mandiPriceService.js`.

**Current model:** `meta/llama-3.2-11b-vision-instruct`

Two other models were tried and rejected during implementation, both because
they no longer exist on NVIDIA's catalog (confirmed via live API responses,
not just documentation, which was stale in both cases):
- `meta/llama3-8b-instruct` — reached end-of-life
- `meta/llama-3.1-8b-instruct` — reached end-of-life on 2026-08-26

Several other models appear in NVIDIA's `GET /v1/models` listing but return a
`404 Not Found for account` when actually invoked (e.g.
`mistralai/mistral-7b-instruct-v0.3`, `nvidia/llama-3.1-nemotron-70b-instruct`,
`mistralai/mixtral-8x22b-v0.1`) — being listed does not mean a given API key is
entitled to call it. `meta/llama-3.2-11b-vision-instruct` was confirmed by an
actual successful chat completion call and is what's currently wired in.

**Authentication:** Required
**Required Role:** Any (Farmer, Retailer, or Official)

**Request Body:**
```json
{
  "message": "What is the best fertilizer schedule for wheat?",
  "crop": "Wheat",
  "state": "Madhya Pradesh"
}
```

**Validation Rules:**
- `message`: Required, string, 1–1000 characters
- `crop`: Optional, string, max 100 characters
- `state`: Optional, string, max 100 characters

**Behavior:**
- Answers general farming questions (crops, irrigation, plant diseases,
  fertilizers, harvesting, etc.) with practical, farmer-friendly advice —
  confirmed live with real questions about aphid control on cotton and tomato
  harvest timing, both returning genuinely useful, non-empty answers.
- If **both** `crop` and `state` are provided, the endpoint first calls the
  existing mandi price service (`GET /api/mandi-prices` logic) to fetch real,
  current price data for that crop/state, and includes it in the prompt as
  explicitly-labeled real data. The AI is instructed to base any price answer
  only on that real data and never invent a number — if it can't find matching
  mandi data, it says so plainly instead of guessing. **Confirmed live:** asking
  about wheat prices in Madhya Pradesh returned `used_mandi_data: true` with an
  answer citing real min/max/modal prices and market names sourced from
  data.gov.in.
- If the mandi lookup fails for any reason (no matching records, AGMARKNET key
  issue, etc.), the chatbot silently falls back to a general-knowledge answer
  rather than failing the whole request.

**Example Response (200) — actual response observed in testing:**
```json
{
  "success": true,
  "data": {
    "reply": "According to the current mandi data fetched from data.gov.in, the prices of wheat in Madhya Pradesh are as follows:\n\n- The minimum price of wheat is ₹2,400 (in Mandla's Krishi Upaj Mandi Samiti Bichhiya market).\n- The maximum price of wheat is ₹2,765 (in Rajgarh's Biaora APMC market)...",
    "used_mandi_data": true
  }
}
```

Note: this endpoint's success response uses `{ "success": true, "data": {...} }`
rather than this project's usual `{ "status": "success", "data": {...} }` — a
deliberate one-off to match the exact shape requested for this feature. Error
responses still go through the existing global error handler and use the
project's standard `{ "status": "error", "message": "..." }` shape.

**Error Responses:**
- `401 Unauthorized` - No token provided or invalid token
- `400 Bad Request` - Validation error (missing/empty/overlong message), or
  NVIDIA rejected the request as malformed
- `503 Service Unavailable` - `NVIDIA_NIM_API_KEY` not configured or invalid,
  the selected model is unavailable, or the NVIDIA API is unreachable
  ```json
  {
    "status": "error",
    "message": "AI chatbot is not configured. Please set NVIDIA_NIM_API_KEY in environment variables."
  }
  ```
- `429 Too Many Requests` - NVIDIA API rate limit exceeded
- `500 Internal Server Error` - Unexpected error (e.g. empty AI response)

**Diagnosability:** on any upstream NVIDIA error, the server logs the HTTP
status, the model name, and NVIDIA's own (sanitized) error message body to the
console — enough to diagnose the real cause without ever logging API keys,
Authorization headers, or request config. The client-facing error message for
unmapped statuses also includes this same sanitized detail rather than a
generic "something went wrong."

**Performance note:** real responses from this model took roughly 5–12 seconds
in testing. The internal request timeout is set to 30 seconds to avoid
false "unreachable" failures on slower responses (an earlier 15-second timeout
caused intermittent failures on otherwise-successful requests).

---

### Ratings & Reviews

**Status:** Fully implemented and live-tested end-to-end (2026-09-06) — the
`ratings_reviews` migration has been run in Supabase and 43/43 checks passed
via real HTTP requests, including actually creating reviews, the
duplicate-review `409`, the self-review database constraint, retrieval, and
the rating summary. See DATABASE_SCHEMA.md for the table definition.

Lets the two participants on a **completed** order (farmer and retailer) rate
and review each other — a simple reputation signal, not a general review
platform.

#### POST /api/reviews

Submit a review for a completed order you were a participant in.

**Authentication:** Required
**Required Role:** Any (Farmer, Retailer, or Official)

**Request Body:**
```json
{
  "order_id": 12,
  "rating": 5,
  "comment": "Smooth transaction, produce as described."
}
```

**Validation Rules:**
- `order_id`: Required, integer
- `rating`: Required, integer, 1–5
- `comment`: Optional, string, max 500 characters

**Business Rules (all live-tested against the real table):**
- You must be a participant (farmer or retailer) on the order — a
  non-participant is rejected even if they know the `order_id`, enforced
  server-side, not just by hiding the button in a UI.
- The order must be `completed` — reviewing a `confirmed`/`paid`/`cancelled`
  order is rejected.
- Rating must be an integer 1–5; `0`, `6`, negative numbers, decimals, strings,
  and a missing rating are all rejected. Ratings 1–5 were confirmed to
  actually create a review, not just pass validation.
- The reviewee is always "the other participant" on the order (farmer reviews
  the retailer, retailer reviews the farmer) — confirmed live in both
  directions on the same order. This makes self-review structurally
  impossible through the real API (no request can supply an arbitrary
  `reviewee_id`); the underlying `CHECK (reviewer_id <> reviewee_id)`
  constraint was separately confirmed by attempting a raw insert that
  bypasses the app layer entirely, which the database rejected.
- One review per reviewer per order — a second attempt is rejected with
  `409`, enforced by a database `UNIQUE(order_id, reviewer_id)` constraint
  (not just an application-layer check, so it holds even under a race).

**Example Response (201):**
```json
{
  "status": "success",
  "message": "Review submitted successfully",
  "data": {
    "id": 1,
    "order_id": 12,
    "reviewer_id": "uuid-of-reviewer",
    "reviewee_id": "uuid-of-reviewee",
    "rating": 5,
    "comment": "Smooth transaction, produce as described.",
    "created_at": "2026-09-06T10:00:00.000Z",
    "updated_at": "2026-09-06T10:00:00.000Z",
    "reviewer": { "id": "uuid-of-reviewer", "name": "...", "location": "..." },
    "reviewee": { "id": "uuid-of-reviewee", "name": "...", "location": "..." }
  }
}
```

**Error Responses:**
- `401 Unauthorized` - No token provided or invalid token
- `400 Bad Request` - Validation error (rating out of 1–5, comment too long),
  order not `completed`, or (defensively) reviewer equals reviewee
- `403 Forbidden` - Not a participant on the order
- `404 Not Found` - Order does not exist
- `409 Conflict` - You have already reviewed this order

---

#### GET /api/reviews/user/:userId

Get all reviews **received** by a user, plus a simple rating summary computed
from those same rows (no extra query) — this is deliberately public reputation
data, not restricted to viewing your own reviews, since the point is to let
other users decide whether to trade with someone.

**Authentication:** Required (any authenticated role may view any user's reviews)

**Example Response (200):**
```json
{
  "status": "success",
  "data": {
    "reviews": [
      {
        "id": 1,
        "order_id": 12,
        "reviewer_id": "uuid-of-reviewer",
        "reviewee_id": "uuid-of-this-user",
        "rating": 5,
        "comment": "Smooth transaction, produce as described.",
        "created_at": "2026-09-06T10:00:00.000Z",
        "reviewer": { "id": "...", "name": "...", "location": "..." }
      }
    ],
    "summary": { "average": 5, "count": 1 }
  }
}
```

`summary.average` is `null` when `count` is `0`.

**Error Responses:** `401` (no/invalid token)

---

#### GET /api/reviews/order/:orderId

Get the review(s) left on a specific order. Unlike the user-reputation
endpoint above, this is **participant-only** — order details are private.

**Authentication:** Required
**Error Responses:** `401`, `403` (not a participant — verified server-side,
cannot be bypassed by changing the `:orderId` in the URL), `404` (order not found)

---

## Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (no/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (duplicate, overbooking) |
| 500 | Internal Server Error |
| 503 | Service Unavailable (database not configured) |

## Common Error Patterns

### Authentication Errors
```json
{
  "status": "error",
  "message": "No token provided"
}
```

### Authorization Errors
```json
{
  "status": "error",
  "message": "Insufficient permissions"
}
```

### Validation Errors
```json
{
  "status": "error",
  "message": "Validation failed",
  "details": ["\"crop_id\" is required"]
}
```

### Database Configuration Errors
```json
{
  "status": "error",
  "message": "Supabase not configured. Please set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY in environment variables."
}
```

## Notes

- All timestamps are in ISO 8601 format
- IDs are integers for database records, UUIDs for user references
- The API uses standard HTTP methods and status codes
- Rate limiting is not currently implemented
- CORS is enabled for all origins (development mode)
- Real-time updates are not supported (no WebSocket)

## Future Endpoints

The following endpoints are planned but not yet implemented:

- `POST /api/auth/otp/send` - Send OTP to phone number (Phase 2, deferred)
- `POST /api/auth/otp/verify` - Verify OTP and login (Phase 2, deferred)
- Dashboard analytics/charts beyond the simple dashboards already implemented
  (see `GET /api/dashboard/*` above)
- Real payment gateway integration (current payment flow is mock-only by design)

---

### Mandi Prices

#### GET /api/mandi-prices

Get current/latest mandi (market) prices from the official Government of India data.gov.in API.

**Authentication:** None  
**Required Role:** None  
**API Key Required:** Yes (AGMARKNET_API_KEY in environment variables)

**Query Parameters (all optional):**
- `state` - Filter by state name
- `district` - Filter by district name  
- `market` - Filter by market/mandi name
- `commodity` - Filter by commodity name
- `variety` - Filter by variety
- `grade` - Filter by grade
- `limit` - Maximum records to return (default: 50, max: 1000)
- `offset` - Records to skip for pagination (default: 0)
- `latest_only` - Return only latest date records (default: true)
- `start_date` - Filter by start date in DD/MM/YYYY format (disables latest_only)
- `end_date` - Filter by end date in DD/MM/YYYY format (disables latest_only)

**Default Behavior:** Returns only the latest available mandi price records by default. Old historical records (e.g., from 2010) are automatically filtered out.

**Example Request:**
```bash
# Get latest mandi prices (no filters)
curl http://localhost:3000/api/mandi-prices

# Get latest wheat prices in Madhya Pradesh
curl "http://localhost:3000/api/mandi-prices?commodity=Wheat&state=Madhya%20Pradesh"

# Get prices for a specific date range
curl "http://localhost:3000/api/mandi-prices?commodity=Wheat&start_date=01/08/2026&end_date=15/08/2026&latest_only=false"
```

**Example Response:**
```json
{
  "status": "success",
  "data": [
    {
      "state": "Madhya Pradesh",
      "district": "Indore",
      "market": "Indore Mandi",
      "commodity": "Wheat",
      "variety": "Other",
      "grade": "Medium",
      "arrival_date": "15/08/2026",
      "min_price": 2400,
      "max_price": 2600,
      "modal_price": 2500
    }
  ],
  "meta": {
    "total": 15000,
    "count": 1,
    "limit": 50,
    "offset": 0,
    "latest_only": true,
    "date_range": null
  }
}
```

**Price Units:** All prices are in rupees per quintal (₹/quintal) as per AGMARKNET specification.

**Date Format:** Dates are in DD/MM/YYYY format (e.g., "15/08/2026").

**Error Responses:**
- `503 Service Unavailable` - AGMARKNET_API_KEY not configured
- `429 Too Many Requests` - API rate limit exceeded
- `503 Service Unavailable` - No response from data.gov.in API
- `500 Internal Server Error` - Other API errors

**Important Notes:**
- This endpoint uses the official data.gov.in API (Resource ID: 9ef84268-d588-465a-a308-a864a43d0070)
- The API provides daily wholesale minimum, maximum, and modal prices from AGMARKNET
- By default, only the latest available price records are returned to avoid historical data
- To access historical data, explicitly set `latest_only=false` and provide date range filters
- The API requires a valid AGMARKNET_API_KEY from data.gov.in
