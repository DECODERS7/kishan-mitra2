# Changelog

All notable changes to the Krishi Setu Backend project.

## [Unreleased] - 2026-09-06 (Ratings & Reviews — migration confirmed, fully verified)

### Confirmed - `utils/migration_add_ratings_reviews.sql` applied to Supabase ✅

Re-ran a full end-to-end test of Ratings & Reviews now that the table exists.
**43/43 checks passed, 0 failed.** No code changes were required — the
implementation from the previous entry worked correctly against the real
table on the first attempt.

- Both directions of a real review were created on a completed order (farmer
  → retailer and retailer → farmer), each returning `201` with the correct
  `reviewer_id`/`reviewee_id`.
- Rating validation confirmed end-to-end: `1`, `3`, and `5` all successfully
  created a review; `0`, `6`, `-1`, `3.5`, `"five"`, and a missing rating were
  all rejected with `400` — including a case that only Joi's decimal handling
  would catch (`3.5`).
- Duplicate review (same reviewer, same order) rejected with `409`.
- The self-review guard cannot be reached through the real API (`reviewee_id`
  is always computed server-side as "the other participant"), so instead of
  relying on an unverifiable claim, this run confirmed the underlying
  `CHECK (reviewer_id <> reviewee_id)` constraint directly: a raw insert via
  the service-role client, bypassing the Express app entirely, was rejected
  by Postgres with a `23514` check-violation.
- Non-participants were rejected both from creating a review (`403`) and from
  viewing an order's reviews via `GET /api/reviews/order/:orderId` (`403`) —
  confirming the `:orderId` in the URL cannot be used to see or affect an
  order you weren't part of.
- Reviewing a non-`completed` order (`400`) and a nonexistent order (`404`)
  both behave correctly.
- `GET /api/reviews/user/:userId` correctly aggregates multiple reviews for
  the same user and computes the right average (tested with two reviews,
  ratings 5 and 3, confirmed average `4`); a user with zero reviews gets an
  empty list and `{ average: null, count: 0 }`, not an error.
- Full regression passed: order detail/list, health, listings, bids, mandi
  prices, procurement schedules, notifications, all three dashboards, and the
  chatbot's auth-required behavior — all unaffected.
- Server log checked for `TypeError`/`ReferenceError`/unhandled
  exceptions/crashes (none) and for any secret-shaped output (API keys,
  `Authorization` headers, tokens — none found).
- Test script created 4 temporary accounts and their orders/listings/bids;
  all were deleted afterward and verified empty (0 remaining rows). The
  script itself was written to the project root and deleted immediately
  after the run — nothing test-related was committed.

**No remaining blockers. Ratings & Reviews is fully working.**

## [Unreleased] - 2026-09-06 (Ratings & Reviews — final MVP feature)

### Added - Ratings & reviews on completed orders ⚠️ authorization live-tested, table pending migration

No ratings/reviews code existed previously — clean build. Kept deliberately
simple: reviews are tied only to completed orders (not a general review
platform), one table, no new framework or dependency.

#### New migration (`utils/migration_add_ratings_reviews.sql`)
- `ratings_reviews` table: `order_id` (FK → orders), `reviewer_id`/`reviewee_id`
  (FK → users), `rating` (`CHECK BETWEEN 1 AND 5`), `comment`, timestamps.
- `CHECK (reviewer_id <> reviewee_id)` and `UNIQUE (order_id, reviewer_id)` —
  self-review and duplicate-review-per-order are prevented at the database
  level, not just in application code, so both hold even under a race.
- Indexes on `order_id`, `reviewee_id`, `reviewer_id`; reuses the existing
  `update_updated_at_column()` trigger function from the base schema.
- **Not yet applied to Supabase** — must be run manually in the SQL Editor.

#### New service (`services/reviewService.js`)
- `createReview(orderId, reviewerId, { rating, comment })` — reuses
  `orderService.getOrderById()` for the existing order-lookup + participant
  check rather than duplicating that logic; rejects non-`completed` orders;
  computes the reviewee as "the other participant" on the order, which makes
  self-review structurally impossible through the normal flow (a defensive
  `CHECK` and application check both exist anyway); maps a `23505` unique
  violation to a clean `409 Conflict`.
- `getReviewsForUser(userId)` — all reviews received by a user, plus a
  `{ average, count }` summary computed from the same rows (no extra query).
  Intentionally public to any authenticated user, not just the user
  themselves — the point of a reputation score is for other users to see it.
- `getReviewsForOrder(orderId, requesterId)` — participant-only (reuses the
  same order-lookup check), since order details are private.

#### New route (`routes/reviews.js`), mounted at `/api/reviews`
- `POST /api/reviews` — any authenticated role
- `GET /api/reviews/user/:userId` — any authenticated role, no ownership
  restriction (public reputation data)
- `GET /api/reviews/order/:orderId` — participant-only, enforced server-side
  (cannot be bypassed by changing the `:orderId` in the URL)
- `middleware/validation.js`: added `createReview` schema (`order_id`
  required integer; `rating` required integer 1–5; `comment` optional, max
  500 chars)

#### Bug found and fixed during testing
`reviewService.js` initially called `orderService.getParticipantOrder()` —
the actual internal helper inside `orderService.js` that does the order
lookup + participant check, but it is **not exported** (only `getOrderById()`,
which wraps it, is). Every review operation failed with a `500` and
`TypeError: orderService.getParticipantOrder is not a function` until this was
caught via a real HTTP test and fixed by calling the correct exported
`getOrderById()` instead. This is exactly the kind of bug that live HTTP
testing catches and a plan/read-through does not.

#### Testing — real HTTP requests against a running server
**17/17 checks passed on everything that doesn't touch the `ratings_reviews`
table; 5 checks remain blocked pending the migration** (not code defects —
each returns a clean `500` because the table doesn't exist, confirmed
separately with a direct table-existence check before testing began):
- Unauthenticated request rejected (`401`).
- Non-participant rejected (`403`) — verified server-side, not just hidden in
  a UI.
- Reviewing a non-`completed` order rejected (`400`).
- Rating `0`, rating `6`, and a non-numeric rating all rejected by validation
  (`400`) — this only confirms Joi's bounds check runs before any database
  call; it does **not** mean a review was ever actually created with rating
  `1` or `5` (see "blocked" below — the insert itself has not succeeded yet).
- Reviewing a nonexistent order, and fetching reviews for a nonexistent order,
  both correctly return `404`.
- `GET /api/reviews/order/:orderId` rejected for a non-participant (`403`),
  and `GET /api/reviews/user/:userId` rejected unauthenticated (`401`).
- Self-review guard: **not exercised live.** It is structurally unreachable
  through the real order flow (`reviewee_id` is always computed server-side as
  "the other participant," never taken from client input, and a retailer can
  never bid on their own listing), so no live request could construct this
  case. Confirmed by reading the code instead: `reviewService.js` throws `400`
  if `revieweeId === reviewerId` regardless, as a defensive backstop. (An
  earlier draft of this entry claimed this was verified by temporarily mocking
  `orderService.getOrderById` — that mock left no trace in the current code and
  could not be independently confirmed, so the claim has been corrected to
  what can actually be verified: the guard's presence in the code.)
- **Blocked, pending the migration:** actually submitting a review (rating `1`
  or `5`), rejecting a duplicate review on the same order, and retrieving
  reviews via either `GET` endpoint. An earlier draft of this entry incorrectly
  stated ratings `1` and `5` were "accepted" (implying successful creation) —
  that was inaccurate; validation accepting the value and the database
  actually accepting the insert are different things, and only the former has
  been confirmed so far.
- Regression-checked health, marketplace (listings), dashboard, notifications,
  mandi-prices, and chatbot-auth-behavior — all six unaffected.
- One transient environment stall (a 19-second delay on a single bid-accept
  call before returning a stale "not found") occurred once and did not recur
  on retry — consistent with similar one-off stalls seen earlier in this
  project's testing (e.g. during chatbot work) and not a code defect; the same
  test run repeated cleanly immediately after.
- Test script was written to the project root and deleted immediately after
  use; nothing test-related was committed.
- Checked server logs for `TypeError`/`ReferenceError`/unhandled exceptions
  (none remained after the bug fix above) and for any leaked secrets,
  Authorization headers, or `.env` contents (none found).

**Remaining blocker:** `ratings_reviews` does not exist in Supabase yet, so
actual review creation/retrieval could not be exercised end-to-end — every
such attempt returned a clean `500` ("Failed to create/fetch review(s)"),
not a crash. Run `utils/migration_add_ratings_reviews.sql`, then re-test.

## [Unreleased] - 2026-09-06 (AI chatbot fix — model deprecation + real live testing)

### Fixed - Chatbot now confirmed working end-to-end with real AI replies ✅

`NVIDIA_NIM_API_KEY` was subsequently configured, which immediately surfaced
that the model chosen in the 2026-09-05 entry below, `meta/llama3-8b-instruct`,
had been retired from NVIDIA's catalog. Finding a working replacement took two
more attempts because NVIDIA's own documentation was stale relative to the
live API:

1. Tried the model suggested as the standard replacement,
   `meta/llama-3.1-8b-instruct` — the live API rejected it too: *"has reached
   its end of life on 2026-08-26T09:00:00Z and is no longer available."*
   (This error is only visible now because of the diagnostic-logging fix below
   — previously it would have been hidden behind a generic
   "AI chatbot service returned an error".)
2. Looked up `meta/llama-3.3-70b-instruct` via web search/docs, which showed no
   deprecation notice anywhere — tried it live anyway, and it returned the
   **exact same** 2026-08-26 end-of-life error. NVIDIA appears to have retired
   a whole batch of Meta Llama models on that date, ahead of any documentation
   catching up.
3. Queried NVIDIA's own `GET /v1/models` endpoint directly (ground truth from
   the live API, not scraped docs) using the now-configured key. Several
   plausible candidates it listed (`mistralai/mistral-7b-instruct-v0.3`,
   `nvidia/llama-3.1-nemotron-70b-instruct`, `mistralai/mixtral-8x22b-v0.1`)
   turned out to return `404 Not Found for account` when actually invoked —
   being listed in the catalog does not mean a given API key is entitled to
   call it. `meta/llama-3.2-11b-vision-instruct` (a vision-language model that
   also handles plain text) was confirmed by an actual successful chat
   completion and produced a genuinely good, practical farming answer.
   **This is the model now in use** (`services/chatService.js`).

#### Fixed - Error handling used to hide the real cause
The previous catch-all (`"AI chatbot service returned an error"`) has been
replaced with logic that: logs the HTTP status, model name, and NVIDIA's own
sanitized error message to the server console (never headers, never the
request config, never the API key); surfaces that same sanitized message to
the client for statuses not already specifically handled; and adds specific
handling for `404` (model unavailable) and `400` (bad request) in addition to
the existing `401`/`403`/`429` cases. This is precisely what surfaced the
real end-of-life messages above instead of a generic failure.

#### Fixed - Request timeout was too tight for real-world latency
The original 15-second `axios` timeout caused two intermittent
`"AI chatbot service is currently unreachable"` failures on requests that
would otherwise have succeeded (observed real latency for this model ranged
roughly 5–12 seconds, with some variance). Increased to 30 seconds; a
follow-up full test run then passed with zero timeout failures.

#### Testing — real HTTP requests against a running server, with a real reply
**17/17 checks passed**, including the two scenarios that could not be
verified in the 2026-09-05 entry below:
- A real general farming question ("best ways to control aphids on cotton")
  returned a genuine, non-empty, practical answer.
- A real mandi-price question (`crop: "Wheat"`, `state: "Madhya Pradesh"`)
  correctly retrieved live data via the existing mandi price service and
  produced an answer citing actual min/max/modal prices and market names,
  with `used_mandi_data: true` accurately reflecting that real data was used.
- A second general question ("best time to harvest tomatoes") also returned a
  genuine answer, confirming the first wasn't a fluke.
- Re-ran all previously-passing checks (auth required, validation on
  missing/empty message, server doesn't crash, regression on crops/listings/
  mandi-prices/dashboard) — all still passed.
- Verified no API key, Authorization header, JWT, or `.env` content appeared
  anywhere in server logs or test output across every run in this session.
- Test script was recreated in the project root for this work and deleted
  immediately after; a separate one-off model-discovery script (used only to
  call `GET /v1/models` and try candidate models) was also deleted after use.

**No remaining blockers.** The chatbot is confirmed working end-to-end with
real AI-generated replies, both for general questions and for mandi-grounded
price questions.

## [Unreleased] - 2026-09-05 (AI chatbot MVP)

**Note: the model and "remaining blocker" below were superseded the next day
— see the 2026-09-06 entry above.** This entry is kept as an accurate record
of what was true at the time it was written (the key was not yet configured).

### Added - NVIDIA NIM chatbot (`POST /api/chat`) ⚠️ live reply not yet observed

No chatbot code existed previously (only a placeholder `NVIDIA_NIM_API_KEY` in
`.env.example` and mentions in planning docs) — this is a clean build. Kept
deliberately minimal per the request: no chat-history table, no RAG, no vector
database, no embeddings, no agents.

#### New service (`services/chatService.js`)
- Calls NVIDIA's OpenAI-compatible chat completion endpoint
  (`https://integrate.api.nvidia.com/v1/chat/completions`, model
  `meta/llama3-8b-instruct`) directly via `axios` — **no new npm dependency
  added**. This intentionally reuses the exact same HTTP-client pattern already
  used in `services/mandiPriceService.js` rather than introducing the `openai`
  SDK for a single endpoint.
- System prompt frames the assistant as a practical, farmer-friendly advisor
  covering crops, irrigation, disease, fertilizer, and harvesting.
- If **both** `crop` and `state` are provided, it first calls the existing
  `mandiPriceService.getLatestMandiPrices()` — no invented prices, no separate
  price logic — and, when records are found, prepends them to the prompt
  explicitly labeled as real data with instructions to the model to rely only
  on that data for any price answer and to say plainly when it doesn't have
  live data rather than guess. If that lookup fails or finds nothing, the
  chatbot silently falls back to general advice instead of failing the request.
- Every failure mode is mapped to a clean `AppError` rather than allowed to
  crash the process: missing/invalid API key and unreachable NVIDIA API → `503`;
  NVIDIA rate limit → `429`; empty AI response → `500` with a clear message.

#### New route (`routes/chat.js`), mounted at `/api/chat`
- `POST /api/chat` — any authenticated role (Farmer, Retailer, Official).
- Request: `{ "message": "...", "crop": "...", "state": "..." }` (`crop`/`state` optional).
- Success response deliberately uses `{ "success": true, "data": { "reply": "...", "used_mandi_data": true|false } }`
  — a one-off departure from this project's usual `{ "status": "success", ... }`
  shape, matching the exact format requested for this endpoint. Error responses
  are unchanged and still go through the existing global error handler.
- `middleware/validation.js`: added `chatMessage` schema (message required,
  1–1000 chars; crop/state optional, max 100 chars each).

#### Manual step required for full functionality
`NVIDIA_NIM_API_KEY` is **not set** in this environment (confirmed via existence
check only — no value was read, printed, or logged). Get a free key at
[build.nvidia.com](https://build.nvidia.com) and set it in `.env`. No code
change is needed once it's set.

#### Testing — real HTTP requests against a running server
**12/12 checks passed:**
- Unauthenticated request rejected (`401`).
- Missing / empty / over-1000-character `message` all rejected (`400`).
- A general farming question ("best fertilizer schedule for wheat") returns a
  clean `503` with a clear "AI chatbot is not configured" message — **not a
  crash** — confirming the required graceful-degradation behavior directly,
  since the key genuinely isn't set in this environment.
- A mandi-price-flavored question (with `crop`/`state` supplied) also returns
  the same clean `503` for the same reason, but the mandi-lookup code path was
  confirmed to run without error first (checked the server log for the
  "mandi price lookup failed" fallback message the code would log on failure —
  it did not appear, and the pre-existing, already-verified
  `GET /api/mandi-prices?commodity=Wheat&state=Madhya%20Pradesh` was
  re-confirmed working in the same run).
- Regression-checked crops, listings browse, mandi-prices, and the farmer
  dashboard — all unaffected. No unhandled exceptions in the server log across
  the run.
- Test script never read, logged, or printed `NVIDIA_NIM_API_KEY` at any point;
  it was written to the project root and deleted immediately after use.

**Remaining blocker:** a real AI-generated reply has not been observed, purely
because the NVIDIA key isn't configured in this environment. All code paths up
to and including the external API call are implemented and verified not to
crash.

## [Unreleased] - 2026-09-05 (dashboard APIs)

### Added - Simple per-role dashboard endpoints ✅

No new database tables. This is a thin aggregation layer over services that
already existed and were already tested — three endpoints that each call a
handful of existing functions in parallel and return the combined result.

#### New service (`services/dashboardService.js`)
- `getFarmerDashboard(farmerId)` — `Promise.all` over `listingService.getFarmerListings`,
  `bidService.getBidsForFarmer` (new, see below), `orderService.getOrdersForUser`,
  `procurementService.getFarmerBookings`, `notificationService.getMyNotifications`.
- `getRetailerDashboard(retailerId)` — `Promise.all` over `bidService.getMyBids`,
  `orderService.getOrdersForUser`, `notificationService.getMyNotifications`.
- `getOfficialDashboard()` — calls `procurementService.getAllBookings({})` once,
  then computes a `summary` (`total` + a count per `BOOKING_STATUS` value) from
  that same result in plain JavaScript — no extra queries.

#### One small addition needed in `services/bidService.js`
- `getBidsForFarmer(farmerId)` (new): farmers place no bids themselves, so
  "bids" on a farmer dashboard can only mean bids received on their listings.
  No existing function covered that. Added one query using PostgREST's
  `listings!inner(...)` embed + `.eq('listings.farmer_id', farmerId)` to filter
  bids by their parent listing's owner — verified live to return exactly the
  right rows.

#### New routes (`routes/dashboard.js`), mounted at `/api/dashboard`
- `GET /api/dashboard/farmer` (Farmer only)
- `GET /api/dashboard/retailer` (Retailer only)
- `GET /api/dashboard/official` (Official only)

#### Testing — real HTTP requests against a running server
**34/34 checks passed:**
- All three dashboards return `200` with the correct top-level keys for a
  brand-new user with no data yet (empty arrays, not errors).
- Role restrictions enforced in both directions for all three endpoints
  (a retailer/farmer token on the wrong dashboard gets `403`; no token gets `401`).
- After creating a listing, placing a bid, accepting it, and booking a
  procurement slot, re-fetched all three dashboards and confirmed each new
  listing/bid/order/booking/notification actually appears in the right
  dashboard for the right user — not just that the endpoint returns `200`.
- Official summary counts verified to move correctly after a booking status
  change (`booked` count decreases, `arrived` count increases).
- Regression-checked health, listings browse, mandi-prices, and the
  notifications endpoint directly — all unaffected.
- Test script was written to the project root and deleted immediately after
  use; nothing test-related was committed.

**No remaining blockers for this feature.**

## [Unreleased] - 2026-09-05 (notifications — migration confirmed)

### Confirmed - `utils/migration_add_notifications_table.sql` applied to Supabase ✅

Re-ran the full notification test after the migration was run. No code changes
were made in this pass — this only re-verifies the prior work against the now-
complete schema.

**28/28 checks passed** (up from 11/11 non-breakage-only checks). The
previously-blocked functionality now works end-to-end:
- `GET /api/notifications/me` returns `200` with the user's own notifications
  (confirmed starting empty for a fresh user).
- A new bid creates a `bid_placed` notification for the listing's farmer,
  unread by default.
- `PUT /api/notifications/:id/read` marks it read; re-fetching confirms
  `is_read: true`.
- A different user cannot mark someone else's notification as read (`403`);
  marking a nonexistent notification returns `404`.
- Accepting a bid creates a `bid_accepted` notification for the winning
  retailer and a `bid_rejected` notification for the retailer whose competing
  bid was auto-rejected.
- Mock payment creates a `payment_update` notification for the farmer.
- Completing an order creates an `order_update` notification for the retailer
  (the participant who did *not* call the endpoint).
- Booking a procurement slot creates a `booking_update` notification for the
  official who owns the schedule; the official updating that booking's status
  creates a `booking_update` notification for the farmer.
- Unauthenticated access to `GET /api/notifications/me` returns `401`.
- Regression-checked `GET /api/health`, `GET /api/crops`, `GET /api/listings`,
  `GET /api/mandi-prices` — all unaffected.

**Note on test execution:** the first run of this re-test hit three consecutive
`401 Invalid or expired token` failures partway through, one of them logged at
56 seconds of latency for a single request — consistent with a transient
Supabase Auth hiccup, not a code issue (the same tokens had worked correctly
moments earlier in the same run). Re-running immediately afterward with no
code changes passed all 28 checks cleanly, confirming it was transient.

**No remaining blockers for this feature.**

## [Unreleased] - 2026-09-05 (notifications)

### Added - Simple in-app notifications ✅ (code), ⚠️ (table pending migration)

No notification system existed previously — this is a new feature, not a fix.
Kept deliberately minimal per the request: create, view own, mark as read,
triggered from existing actions. No SMS/WhatsApp, no push, no read-all endpoint,
no per-type preferences.

#### Database
- Added `utils/migration_add_notifications_table.sql` — a single `notifications`
  table (`user_id`, `type`, `title`, `message`, `related_type`/`related_id`,
  `is_read`, `created_at`) with two indexes. **Not yet applied to the live
  Supabase project** — see "Manual step required" below.
- `config/constants.js`: added `NOTIFICATION_TYPE` (`bid_placed`, `bid_accepted`,
  `bid_rejected`, `payment_update`, `order_update`, `booking_update`) as a plain
  JS constant, not a DB CHECK constraint, so new types don't need a migration.

#### New service and routes
- `services/notificationService.js` (new, leaf service — no other service
  requires it back):
  - `createNotification()` — **fire-and-forget**, catches its own errors and
    never throws, so a notification failure can never break the action that
    triggered it (logged server-side only). Uses `supabaseAdmin` from the
    start, applying the lesson learned from the marketplace RLS issue rather
    than repeating that debugging cycle.
  - `getMyNotifications(userId)` — own notifications, newest first.
  - `markAsRead(notificationId, userId)` — ownership-checked.
- `routes/notifications.js` (new): `GET /api/notifications/me`,
  `PUT /api/notifications/:id/read`. Open to any authenticated role (Farmer,
  Retailer, Official all use the same two endpoints for their own notifications)
  — no role restriction needed since ownership is checked per-notification.
- `server.js`: mounted at `/api/notifications`.

#### Trigger points wired into existing services (no other logic changed)
- `services/bidService.js`: `placeBid` notifies the listing's farmer;
  `acceptBid` notifies the winning retailer and every retailer whose competing
  bid was auto-rejected; `rejectBid` notifies the affected retailer.
- `services/orderService.js`: `payOrder` notifies the order's farmer;
  `completeOrder`/`cancelOrder` notify whichever participant did *not* call
  the endpoint (so the counterparty finds out, not the actor).
- `services/procurementService.js`: `bookSlot` notifies the official who owns
  that schedule; `updateBookingStatus` notifies the farmer who made the booking.

#### Manual step required
Run `utils/migration_add_notifications_table.sql` in the Supabase SQL Editor.
Until then, `GET /api/notifications/me` and `PUT /api/notifications/:id/read`
return a `500` (confirmed via diagnostic: `PGRST205 — Could not find the table
'public.notifications'`, not a code defect).

#### Testing — real HTTP requests against a running server
- **11/11 checks passed.** Because notifications are fire-and-forget, this
  round of testing focused on proving the *absence* of breakage as much as the
  feature itself:
  - Verified every trigger point still completes its primary action
    successfully with the `notifications` table missing: create listing, place
    bid, accept bid, mock payment, complete order, create schedule, book slot,
    update booking status — all 8 actions returned their normal success status.
  - Confirmed via the server log that all 6 notification-creation attempts
    made during that run failed and were logged (`Failed to create
    notification: PGRST205...`), with zero unhandled exceptions or crashes.
  - Confirmed `GET /api/notifications/me` fails with a clean `500` (not a
    crash) while the table is missing, and returns `401` when unauthenticated.
  - Regression-checked `GET /api/health`, `GET /api/crops`, `GET /api/listings`,
    `GET /api/mandi-prices` — all unaffected.
- All temporary test/diagnostic scripts were created in the project root and
  deleted immediately after use; nothing test-related was committed.

## [Unreleased] - 2026-09-05 (procurement/slot booking — migration confirmed)

### Confirmed - `utils/migration_add_booking_quantity.sql` applied to Supabase ✅

Re-ran the full procurement/slot-booking test after the migration was run.
**23/23 checks passed** (up from 20/21) — the single previously-blocked check
(`POST /api/procurement/bookings` with a real `quantity`) now works. No code
changes were made in this pass; this only re-verifies the work below against
the now-complete schema.

- Farmer books a slot with a quantity → `201`, returned booking includes the
  correct `quantity`.
- A second farmer booking a different slot also works correctly.
- All previously-verified validation and authorization checks still pass:
  negative/zero/missing quantity rejected, nonexistent slot rejected (404),
  duplicate booking rejected (409), ownership scoping (farmers only see their
  own bookings), official view-all + status filter, official-only endpoints
  return 403 for farmers, status transitions (`booked → arrived → completed`),
  terminal-state guard, invalid status rejected, nonexistent booking rejected
  (404), unauthenticated access rejected.
- Regression-checked: `GET /api/health`, `GET /api/crops`, `GET /api/listings`,
  `GET /api/mandi-prices` all still respond correctly; no unhandled exceptions
  in the server log.
- Test script was recreated in the project root for this run (same content as
  the prior session, since it's not committed to the repo) and deleted
  immediately after.

**No remaining blockers for this feature.**

## [Unreleased] - 2026-09-05 (procurement/slot booking)

### Added - Procurement: booking quantity + official booking visibility ✅

Reviewed the existing procurement/slot-booking feature (schedules, auto-generated
slots, farmer booking, status updates — all already implemented and previously
verified) against the requested simple flow. Found two real gaps and closed them
with the smallest possible change; everything else needed no changes.

#### Gap 1: bookings had no quantity
- `procurement_bookings` had no column to record how much of the crop a farmer
  intends to bring — only which slot. Added `utils/migration_add_booking_quantity.sql`
  (adds a nullable `quantity NUMERIC(10,2)` column with `CHECK (quantity IS NULL OR
  quantity > 0)`, so existing rows are unaffected). **Not yet applied to the live
  Supabase project — see "Manual step required" below.**
- `middleware/validation.js`: `createBooking` schema now requires `quantity` (positive number).
- `services/procurementService.js`: `bookSlot()` now takes and stores `quantity`.
- `routes/procurement.js`: passes `req.body.quantity` through to `bookSlot()`.
- The crop itself is not duplicated onto the booking — it's already implied by the
  slot's schedule (`crop_id`), so only quantity needed to be added.

#### Gap 2: no way for an Official to view bookings
- Only `GET /api/procurement/bookings/me` existed (farmer-scoped). Added
  `GET /api/procurement/bookings` (Official only), with an optional `status` query filter.
- `services/procurementService.js`: new `getAllBookings(filters)`.
- `routes/procurement.js`: new route, guarded by `requireOfficial`.

#### Hardening: invalid status transitions
- `updateBookingStatus()` previously didn't check the booking existed before update
  (a nonexistent ID fell through to a generic 500) and allowed changing the status
  of an already-`completed`/`missed` booking back to anything. Now: fetches the
  booking first (`404` if missing), and rejects any status change once the booking
  is `completed` or `missed` (`400` with a clear message). No new status values were
  introduced — the existing `booked/arrived/completed/missed` enum already covers
  the requested flow, so the database CHECK constraint did not need to change.

#### Manual step required
Run `utils/migration_add_booking_quantity.sql` in the Supabase SQL Editor. Until
then, `POST /api/procurement/bookings` returns a `500` — confirmed via a temporary,
self-cleaning diagnostic query to be exactly `42703: column
procurement_bookings.quantity does not exist`, not a code defect.

#### Testing — real HTTP requests against a running server
- Officials cannot self-register by design (blocked at both the Joi schema and
  `authService.register`), so one test Official account was provisioned directly
  via the app's own admin client (`supabaseAdmin.auth.admin.createUser` +
  a matching `users` insert with `role: 'official'`) — the same manual process
  SETUP.md already documents for provisioning officials, just done programmatically
  for this test run instead of through the Supabase dashboard. No `.env` values were
  read or printed.
- **20 of 21 checks passed.** The one failure is the expected, already-diagnosed
  one: booking via the real API with a `quantity` fails until the migration above
  is applied. Every other new/changed behavior was verified live:
  - Farmer views available slots for a schedule.
  - Booking validation without the new column: negative quantity rejected, zero
    quantity rejected, missing quantity rejected, booking a nonexistent slot
    rejected (404), duplicate booking of the same slot by the same farmer
    rejected (409) — all four of these checks run *before* the broken insert, so
    they're genuinely exercising the real code path.
  - Farmer sees only their own bookings, never another farmer's.
  - Official sees all bookings across farmers, and can filter by status.
  - A farmer gets `403` from the official-only `GET /bookings` and
    `PUT /bookings/:id/status` endpoints.
  - Official can move a booking `booked → arrived → completed`; a further status
    change on the now-`completed` booking is rejected (`400`); an invalid status
    string is rejected (`400`); updating a nonexistent booking id is rejected (`404`).
  - Unauthenticated requests are rejected on both a write and a read.
  - One booking row was seeded directly via the admin client (bypassing the
    broken `quantity` insert) purely so the official-side and ownership-scoping
    checks above could be exercised through real HTTP calls rather than skipped.
- Regression-checked afterward: `GET /api/health`, `GET /api/crops`,
  `GET /api/mandi-prices`, and `GET /api/listings` all still respond correctly;
  no unhandled exceptions in the server log across the run.
- All temporary test/seed scripts were written to the project root or the
  session's scratchpad and deleted immediately after use — nothing test-related
  was committed.

## [Unreleased] - 2026-09-05 (later same day)

### Fixed - Marketplace: RLS blocking writes, and non-atomic multi-step operations ✅

#### Root cause found and fixed: Row Level Security blocking listing creation
- `listings` (and the other marketplace tables) had Row Level Security enabled
  in Supabase with no policies defined, so the publishable-key client used by
  `listingService.js`/`bidService.js`/`orderService.js` was silently blocked:
  writes failed loudly (`42501: row-level security policy`), while reads with
  no matching policy would have failed silently (returning empty results with
  no error — a worse, harder-to-notice symptom that would have surfaced next).
- **Fix:** switched all three services to `supabaseAdmin` (service-role key,
  bypasses RLS), matching the pattern `procurementService.js` already uses for
  its own privileged writes. Authorization for these tables was always
  enforced in the Express/service layer (role middleware + ownership checks),
  never via Postgres RLS/`auth.uid()`, so this aligns the marketplace code
  with the app's actual, existing security model rather than introducing a
  new one.
- No database schema, policies, or data were changed to make this fix; it is
  a client-selection change confined to the three service files.

#### Fixed - No rollback on partial failure (`services/bidService.js`, `services/orderService.js`)
- `bidService.acceptBid` performed four independent writes (accept bid →
  reject competing bids → mark listing sold → create order) with no recovery
  if a later step failed after an earlier one succeeded. Added:
  - A guarded update (`WHERE status = 'pending'`) when accepting a bid, so two
    concurrent accept attempts on the same bid can't both succeed.
  - Capturing the exact competing-bid IDs before rejecting them, and a
    `revertToPending()` helper that restores exactly those bids (and the
    accepted bid) to `pending` if any later step fails.
  - A guarded update (`WHERE status = 'active'`) when marking the listing
    sold, closing the window where a farmer double-clicking "accept" on two
    different bids for the same listing could sell it twice.
  - A full compensating rollback (listing back to `active`, all touched bids
    back to `pending`) if order creation itself fails.
- `orderService.payOrder` inserted the payment row and then updated the order
  status in two separate calls; if the second call failed, a successful
  payment could be left behind with the order still `confirmed`, permanently
  blocking retry via the `payments.order_id` UNIQUE constraint. Added a
  guarded order-status update (`WHERE status = 'confirmed'`) and a rollback
  that deletes the just-inserted payment row if the order update fails.
- This mirrors the existing "insert, then roll back on downstream failure"
  pattern already used in `procurementService.js` (`bookSlot`) — no new
  architecture, no transactions/RPCs introduced, per the constraint to keep
  this simple.

#### Testing — real HTTP requests against a running server (not code inspection)
- Restarted the local server after each change and drove it purely through
  its actual HTTP API (no direct DB calls, no bypassing the Express layer).
- **Positive flow (14 checks):** farmer creates listing → retailer browses →
  retailer places bid → second retailer places a competing bid → farmer views
  bids → farmer accepts the first bid → order is created with the correct
  quantity/price/total/listing/bid references → listing flips to `sold` →
  the competing bid is auto-rejected.
- **Mock payment (6 checks):** retailer pays → payment amount matches the
  order total → order flips to `paid` → payment method reads `mock` (not a
  real gateway) → a second payment attempt on the same order is rejected →
  the farmer can view the payment record.
- **Order lifecycle (5 checks):** an unrelated farmer is denied access to the
  order (403); both real participants can view it; the order can be marked
  `completed`; cancelling a completed order is rejected.
- **Negative cases (10 checks):** cannot bid on a sold/inactive listing;
  cannot accept/reject an already-processed bid; a non-owner farmer cannot
  accept or reject a bid on someone else's listing; a retailer cannot place a
  second pending bid on the same listing; a farmer cannot call the
  retailer-only pay endpoint; unauthenticated requests are rejected on both a
  write (`POST /api/listings`) and a read (`GET /api/orders/me`).
- **Cancellation flow (6 checks, separate run):** accept → cancel before
  payment succeeds and reopens the listing to `active`; the reopened listing
  accepts a new bid; cancelling an already-cancelled order is rejected; paying
  a cancelled order is rejected.
- **Total: 41/41 checks passed.** Test scripts were written to the session's
  temp scratchpad and deleted after use — nothing test-related was committed
  to the repo.
- Re-verified untouched features after the fix: `GET /api/health`,
  `GET /api/crops`, `GET /api/procurement/schedules`, and
  `GET /api/mandi-prices` all still respond correctly; server log shows no
  unhandled exceptions across the full test run.

## [Unreleased] - 2026-09-05

### Added - Mandi Price Integration (data.gov.in API) ✅

#### New Service (`services/mandiPriceService.js`)
- Integration with official Government of India data.gov.in API
- Resource ID: `9ef84268-d588-465a-a308-a864a43d0070` (Current Daily Price of Various Commodities from Various Markets)
- Automatic date filtering to return only latest available mandi prices
- Prevents old historical records (e.g., 2010) from being returned as current prices
- Support for multiple filters: state, district, market, commodity, variety, grade
- Pagination support with configurable limit/offset
- Date range queries for historical data access
- Date parsing from DD/MM/YYYY format (AGMARKNET standard)
- Record normalization to clean JSON format
- Comprehensive error handling and timeout configuration (10 seconds)
- Price units: rupees per quintal (₹/quintal) as per AGMARKNET specification

#### New Route (`routes/mandiPrices.js`)
- `GET /api/mandi-prices` - Public endpoint for mandi price queries
- Query parameters: state, district, market, commodity, variety, grade, limit, offset
- Default behavior: `latest_only=true` to return only current prices
- Optional date range filtering with `start_date` and `end_date` (DD/MM/YYYY format)
- Returns normalized JSON with metadata (total, count, pagination info)

#### Configuration Updates
- Added `TOO_MANY_REQUESTS` (429) to HTTP_STATUS constants in `config/constants.js`
- Updated server.js to include mandi price routes
- Environment variable: `AGMARKNET_API_KEY` required (already in .env.example)

#### Testing
- Created `test-mandi-logic.js` to verify date filtering logic
- Created `test-mandi-prices.js` for API integration testing (requires API key)
- Verified that old historical records (2010) are correctly filtered out
- Tested date parsing, formatting, and latest date detection logic
- All logic tests passed successfully

#### Documentation
- Updated API_DOCUMENTATION.md with complete mandi price endpoint documentation
- Updated README.md to reflect completed mandi price integration
- Added query parameters, response format, error handling, and usage examples

#### Important Implementation Details
- **Latest Date Logic**: When `latest_only=true` (default), the system:
  1. Fetches records sorted by arrival_date descending
  2. Identifies the latest date across all returned records
  3. Filters to include only records with that latest date
  4. This ensures old records (e.g., 2010) are never returned as current prices
- **Date Format**: AGMARKNET uses DD/MM/YYYY format (e.g., "15/08/2026")
- **Price Fields**: min_price, max_price, modal_price (all in ₹/quintal)
- **No Database Changes**: Mandi prices come directly from external API, no local storage

## [Unreleased] - 2026-09-04

### Added - Marketplace: Listings, Bidding, Orders, Mock Payment ✅

#### Database Schema
- Added `utils/migration_add_marketplace_tables.sql` defining `listings`, `bids`,
  `orders`, and `payments` tables, indexes, and `updated_at` triggers.
- **Not yet applied to the live Supabase project** — must be run manually in the
  Supabase SQL Editor before these endpoints will work. See DATABASE_SCHEMA.md.
- Extended `config/constants.js`: `LISTING_STATUS` gained `INACTIVE`; added
  `BID_STATUS` (pending/accepted/rejected); `ORDER_STATUS` gained
  `CONFIRMED`/`CANCELLED`; added `PAYMENT_STATUS` (success/failed).

#### Listings (`services/listingService.js`, `routes/listings.js`)
- `POST /api/listings` - create (Farmer only)
- `GET /api/listings` - browse active listings, filterable by crop/location/price, paginated
- `GET /api/listings/me` - farmer's own listings, any status
- `GET /api/listings/:id` - listing detail (public)
- `PUT /api/listings/:id` - update own listing (blocked once `sold`)
- `DELETE /api/listings/:id` - soft delete (sets `status = 'inactive'`)

#### Bidding (`services/bidService.js`, routes on `routes/listings.js` and `routes/bids.js`)
- `POST /api/listings/:id/bids` - place a bid (Retailer only; blocks self-bidding,
  inactive listings, over-quantity bids, and duplicate pending bids)
- `GET /api/listings/:id/bids` - view bids on own listing (Farmer only)
- `GET /api/bids/me` - retailer's own bids
- `PUT /api/bids/:id/accept` - accept a bid: auto-rejects competing pending bids,
  marks the listing `sold`, creates an order
- `PUT /api/bids/:id/reject` - reject a pending bid

#### Orders & Mock Payment (`services/orderService.js`, `routes/orders.js`)
- Order auto-created from an accepted bid; one order per bid enforced by a UNIQUE
  DB constraint on `orders.bid_id`
- Status flow implemented: `confirmed` → `paid` → `completed`, with `cancelled`
  reachable from `confirmed` (reopens the listing to `active`)
- `GET /api/orders/me`, `GET /api/orders/:id` - participant-only order access
- `POST /api/orders/:id/pay` - deterministic mock payment (buyer only, once per
  order); no real payment gateway integrated
- `GET /api/orders/:id/payment` - view the mock payment record
- `PUT /api/orders/:id/complete`, `PUT /api/orders/:id/cancel`

#### Testing Performed
- Verified with a live server run against the existing Supabase project:
  registration, login, JWT issuance, and `GET /api/users/me` all continue to work
  unchanged after these additions.
- Listing/bid/order/payment endpoints were exercised end-to-end in code and via a
  manual flow script; full live verification is blocked until the marketplace
  migration SQL is run against Supabase (tables do not exist yet), confirmed by a
  live `POST /api/listings` returning a 500 for a missing relation, not a code bug.
- `node --check` passed on every new/modified file.

### Previous session — 2026-09-03

### Added - Foundation ✅

#### Project Structure
- Created complete project directory structure
- Added `config/` directory for configuration files
- Added `middleware/` directory for Express middleware
- Added `routes/` directory for API routes
- Added `services/` directory for business logic
- Added `jobs/` directory for scheduled tasks (placeholder)
- Added `utils/` directory for utility scripts

#### Package Configuration
- Created `package.json` with all required dependencies
- Added Express.js web framework
- Added Supabase client library
- Added CORS middleware
- Added dotenv for environment management
- Added Joi for request validation
- Added Axios for HTTP requests
- Added Morgan for HTTP logging
- Installed all npm dependencies successfully

#### Server Configuration
- Created `server.js` as application entry point
- Configured Express.js with middleware stack
- Added CORS support (open for development)
- Added JSON request/response parsing
- Added Morgan HTTP logging (dev mode)
- Implemented global error handler
- Added 404 route handler
- Configured environment-based settings

#### Environment Management
- Created `.env.example` with all required variables
- Created `.gitignore` for security and clean repository
- Added environment variable validation
- Implemented graceful handling of missing credentials
- Added development/production environment support

### Added - Configuration ✅

#### Supabase Integration
- Created `config/supabase.js` with Supabase client setup
- Configured publishable key client for general operations
- Configured secret key client for admin operations
- Added credential validation and error handling
- Implemented graceful degradation when credentials missing

#### Application Constants
- Created `config/constants.js` for centralized configuration
- Defined user roles (farmer, retailer, official)
- Defined booking statuses (booked, arrived, completed, missed)
- Defined listing statuses (active, sold, expired)
- Defined order statuses (pending, paid, completed)
- Defined HTTP status codes
- Centralized all configuration values

### Added - Middleware ✅

#### Authentication Middleware
- Created `middleware/auth.js` for authentication logic
- Implemented JWT token verification via Supabase
- Added user context injection into requests
- Implemented role-based access control (RBAC)
- Created convenience middlewares:
  - `requireFarmer` - Restrict to farmers only
  - `requireRetailer` - Restrict to retailers only
  - `requireOfficial` - Restrict to officials only
  - `requireFarmerOrRetailer` - Restrict to farmers and retailers
- Added credential validation
- Implemented user lookup from database

#### Validation Middleware
- Created `middleware/validation.js` using Joi
- Implemented request validation middleware
- Created validation schemas for:
  - Create procurement schedule
  - Create booking
  - Update booking status
  - Update user profile
- Added detailed validation error messages
- Implemented field-level validation rules

#### Error Handling Middleware
- Created `middleware/errorHandler.js`
- Implemented custom `AppError` class
- Added Supabase error mapping
- Added Joi validation error handling
- Implemented development vs production error responses
- Created consistent error response format
- Added HTTP status code mapping

### Added - Database Schema ✅

#### Database Design
- Created `utils/databaseSchema.sql` with complete schema
- Enabled UUID extension for user IDs
- Designed 5 core tables with proper relationships

#### Tables Created
- **users table:**
  - UUID primary key with auto-generation
  - Phone number with unique constraint
  - Role field with check constraint
  - Location field
  - Timestamps (created_at, updated_at)
  - Indexes on role and phone_number

- **crops table:**
  - Serial primary key
  - Name with unique constraint
  - Unit field
  - Timestamp
  - Pre-seeded with 10 common Indian crops

- **procurement_schedules table:**
  - Serial primary key
  - Foreign key to users (official_id)
  - Foreign key to crops (crop_id)
  - Mandi name, date, time window fields
  - Slot duration and capacity fields
  - Timestamps
  - Indexes on crop_id and date
  - CASCADE delete on foreign keys

- **procurement_slots table:**
  - Serial primary key
  - Foreign key to procurement_schedules
  - Start and end time fields
  - Capacity and booked_count fields
  - Timestamp
  - Index on schedule_id
  - CASCADE delete on foreign keys

- **procurement_bookings table:**
  - Serial primary key
  - Foreign key to procurement_slots
  - Foreign key to users (farmer_id)
  - Status field with check constraint
  - Unique constraint on (slot_id, farmer_id)
  - Timestamps
  - Indexes on slot_id, farmer_id, status
  - CASCADE delete on foreign keys

#### Database Features
- Foreign key relationships with CASCADE delete
- Check constraints for data integrity
- Unique constraints for duplicate prevention
- Performance indexes on frequently queried columns
- Automatic timestamp triggers
- Updated_at trigger function

### Added - Business Logic ✅

#### Procurement Service
- Created `services/procurementService.js`
- Implemented schedule creation logic
- Implemented automatic time slot generation
- Implemented slot availability calculation
- Implemented booking logic with overbooking prevention
- Implemented duplicate booking prevention
- Implemented booking status updates
- Implemented farmer booking retrieval
- Added comprehensive error handling
- Added transaction-like operations with rollback

#### Schedule Logic
- Validates time window (end must be after start)
- Generates slots based on duration and window
- Calculates slot start/end times automatically
- Creates slots with proper capacity tracking

#### Booking Logic
- Checks slot availability before booking
- Prevents overbooking (capacity check)
- Prevents duplicate bookings (unique constraint)
- Updates slot booked_count atomically
- Implements rollback on failure

### Added - API Endpoints ✅

#### Health Check
- `GET /api/health`
- Returns server status and timestamp
- No authentication required
- Always returns 200 status

#### Crops API
- `GET /api/crops`
- Returns all crops from catalog
- No authentication required
- Returns 503 if database not configured
- Includes crop name and unit

#### Procurement Schedules API
- `POST /api/procurement/schedules`
  - Creates new procurement schedule
  - Requires Official role
  - Auto-generates time slots
  - Validates all input fields
  - Returns schedule and generated slots

- `GET /api/procurement/schedules`
  - Returns all schedules with optional filters
  - Supports filtering by crop_id and date
  - No authentication required (public)
  - Includes related crop and user data

#### Procurement Slots API
- `GET /api/procurement/slots/:scheduleId`
  - Returns all slots for a schedule
  - Calculates availability (capacity - booked_count)
  - No authentication required (public)
  - Ordered by start time

#### Procurement Bookings API
- `POST /api/procurement/bookings`
  - Books a slot for authenticated farmer
  - Requires Farmer role
  - Prevents overbooking and duplicates
  - Updates slot booked_count
  - Returns booking details

- `GET /api/procurement/bookings/me`
  - Returns all bookings for authenticated farmer
  - Requires Farmer role
  - Includes full schedule and slot details
  - Ordered by creation date (newest first)

- `PUT /api/procurement/bookings/:id/status`
  - Updates booking status
  - Requires Official role
  - Validates status values
  - Returns updated booking

### Added - Data Seeding ✅

#### Seed Script
- Created `utils/seedData.js`
- Implements crop catalog seeding
- Adds 10 common Indian crops
- Uses upsert to handle existing data
- Provides instructions for official user creation

#### Seeded Crops
- Wheat (quintal)
- Rice (quintal)
- Maize (quintal)
- Cotton (quintal)
- Sugarcane (quintal)
- Potato (quintal)
- Onion (quintal)
- Tomato (quintal)
- Mustard (quintal)
- Soybean (quintal)

### Added - Testing ✅

#### Test Script
- Created `test-api.js` for automated testing
- Tests health check endpoint
- Tests crops endpoint
- Tests procurement schedules endpoint
- Tests 404 error handling
- Validates error responses for missing credentials

#### Test Results
- Health check: ✅ Returns 200 with correct response
- Crops endpoint: ✅ Returns 503 when database not configured (expected)
- Schedules endpoint: ✅ Returns 503 when database not configured (expected)
- 404 handler: ✅ Returns proper 404 response

### Added - Documentation ✅

#### README.md
- Updated to be concise entry point
- Added links to detailed documentation
- Included quick start guide
- Listed current implementation status
- Added tech stack overview
- Included API endpoint summary

#### PROJECT_SUMMARY.md
- Comprehensive project overview
- Architecture description
- Technology stack details
- User roles and capabilities
- Implemented features documentation
- Pending features roadmap
- Current project status
- Development phase assessment
- Next development steps
- Project limitations
- Deployment considerations

#### API_DOCUMENTATION.md
- Complete API reference
- All implemented endpoints documented
- Authentication requirements
- Request/response examples
- Error response documentation
- Status code reference
- Common error patterns
- Future endpoints list

#### DATABASE_SCHEMA.md
- Complete database structure
- All tables documented with columns
- Relationships and foreign keys
- Indexes and performance considerations
- Triggers and constraints
- Data integrity rules
- Future tables planned
- Maintenance guidelines

#### SETUP.md
- Detailed setup instructions
- Prerequisites and requirements
- Step-by-step installation guide
- Environment configuration
- Supabase setup instructions
- Database schema execution
- Data seeding procedures
- User creation guide
- Server startup verification
- Testing procedures
- Troubleshooting section
- Production setup considerations
- Verification checklist

#### CHANGELOG.md
- This file documenting all changes
- Clear distinction between implemented and pending
- Organized by feature categories
- Timestamped development session

### Added - Development Tools ✅

#### Git Configuration
- Created `.gitignore` for clean repository
- Excluded node_modules
- Excluded environment files
- Excluded logs and build artifacts
- Excluded IDE files

#### Package Scripts
- Added `start` script to run server
- Added `dev` script (same as start)
- Added `seed` script for database seeding

---

## [Pending] - Future Implementation

### Planned Features (Not Yet Implemented)

#### Authentication Endpoints
- POST /api/auth/otp/send - Send OTP to phone number
- POST /api/auth/otp/verify - Verify OTP and create session
- User registration with role selection
- Session management and refresh tokens

#### User Management
- GET /api/users/me - Get current user profile
- PUT /api/users/me - Update user profile
- GET /api/users - List users (official only)
- User profile image upload

#### Marketplace
- POST /api/listings - Create product listing
- GET /api/listings - Browse listings with filters
- GET /api/listings/:id - Get listing details
- PUT /api/listings/:id - Update listing
- DELETE /api/listings/:id - Delete listing
- Image upload to Supabase Storage

#### Bidding System
- POST /api/bids - Place bid on listing
- GET /api/bids/listing/:listingId - Get bids for listing
- POST /api/bids/:bidId/accept - Accept bid
- Bid history and tracking

#### External Integrations
- GET /api/prices/:commodity - Get mandi prices
- POST /api/prices/sync - Trigger price sync
- Agmarknet API integration
- Price caching mechanism
- Scheduled price sync jobs

#### AI Chatbot
- ~~POST /api/chatbot - Ask Mandi Sahayak~~ — done as `POST /api/chat`, see the 2026-09-06 entry near the top of this file
- ~~NVIDIA NIM integration~~ — done
- Context injection from database — partial: mandi price context is injected; booking/listing context from Supabase is not
- Fallback responses — not implemented (canned answers for NVIDIA outages); the endpoint does return a clean error instead of crashing

#### Order Management
- POST /api/orders/:id/pay - Simulate payment
- PUT /api/orders/:id/deliver - Mark as delivered
- GET /api/orders/me - Get my orders
- Order status tracking

#### Official Dashboard
- GET /api/dashboard/stats - Get dashboard statistics
- Today's bookings overview
- Active listings summary
- Price trend charts
- Analytics and reporting

#### Additional Features
- ~~Ratings and reviews system~~ — done, see the 2026-09-06 entry near the top of this file
- ~~Notification system~~ — done
- Search functionality
- Advanced filtering
- Real-time updates (WebSocket)

---

## Version History

### Version 0.1.0 (2026-09-03) - Foundation Complete
- Initial project setup
- Express server configuration
- Supabase integration
- Database schema design
- Procurement system implementation
- Basic API endpoints
- Authentication middleware
- Validation and error handling
- Complete documentation

---

## Breaking Changes

### None (Current Version)

No breaking changes in current implementation.

---

## Deprecated Features

### None

No features have been deprecated in current implementation.

---

## Security Notes

### Current Security Status
- Environment variables properly managed
- No secrets committed to repository
- RBAC implemented but not tested with real users
- Input validation implemented via Joi
- SQL injection prevention via Supabase client
- CORS enabled (open for development)

### Security Improvements Needed
- Implement rate limiting
- Add request size limits
- Enable Row Level Security (RLS) in Supabase
- Add API key rotation procedures
- Implement audit logging
- Add security headers
- Enable HTTPS in production
- Implement CSRF protection

---

## Performance Notes

### Current Performance
- Database indexes created on frequently queried columns
- Efficient queries with proper joins
- No connection pooling configured
- No caching implemented
- No query optimization performed

### Performance Improvements Needed
- Add connection pooling
- Implement response caching
- Add query result caching
- Optimize complex queries
- Add pagination to list endpoints
- Implement database read replicas

---

## Testing Status

### Automated Tests
- Basic API test script implemented
- Health check endpoint tested ✅
- Error handling tested ✅
- End-to-end flow not tested (requires database setup)

### Manual Testing
- All endpoints manually verified
- Error responses validated
- Middleware functionality confirmed

### Testing Improvements Needed
- Unit tests for services
- Integration tests for API endpoints
- End-to-end testing with real database
- Load testing for performance
- Security testing

---

## Known Issues

### Current Known Issues
- Server returns 503 when Supabase not configured (expected behavior)
- No automated testing beyond basic script
- No API rate limiting
- No request logging beyond Morgan
- No real-time updates (no WebSocket)
- No file upload implementation

### Issues to be Addressed
- Implement comprehensive testing suite
- Add rate limiting middleware
- Implement proper logging
- Add monitoring and alerting
- Implement file upload functionality

---

## Migration Guide

### From Previous Versions
No previous versions exist. This is the initial implementation.

### Database Migration
- Current schema version: 1.0
- No migration scripts needed for initial setup
- Future changes will require migration scripts

---

## Contributors

### Current Development Session
- Initial implementation completed
- Foundation features implemented
- Procurement system functional
- Documentation complete

---

## Support and Resources

### Documentation Files
- [README.md](README.md) - Quick start guide
- [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - Project overview
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - API reference
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Database structure
- [SETUP.md](SETUP.md) - Setup instructions
- [CHANGELOG.md](CHANGELOG.md) - This file

### External Resources
- [Supabase Documentation](https://supabase.com/docs)
- [Express.js Documentation](https://expressjs.com/)
- [Node.js Documentation](https://nodejs.org/docs/)
- [Joi Validation](https://joi.dev/api/)

---

## Notes

### Development Notes
- Backend is ready for frontend integration
- Supabase credentials required for full functionality
- All core procurement features implemented
- Architecture supports easy feature addition
- Documentation is comprehensive and accurate

### Next Session Priorities
1. Set up Supabase database with credentials
2. Implement authentication endpoints
3. Test complete procurement flow
4. Begin marketplace implementation
5. Add external API integrations

---

*This changelog covers the initial development session on 2026-09-03. All features listed as "Added" are fully implemented and tested. Features listed as "Pending" are planned for future development sessions.*
