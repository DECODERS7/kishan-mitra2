# Kisan mitra Backend

Backend for Kisan mitra - Farmer Procurement & Direct Marketplace Platform.

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment (copy .env.example to .env)
cp .env.example .env

# Start server
npm start
```

## Documentation

- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Project overview, architecture, and implementation status
- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** - Complete API reference with examples
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Database structure and relationships
- **[SETUP.md](SETUP.md)** - Detailed setup and configuration guide
- **[CHANGELOG.md](CHANGELOG.md)** - Implementation history and current status

## Current Implementation

✅ **Implemented:**
- Express.js backend with middleware (CORS, JSON, Morgan)
- Supabase configuration and client setup
- Role-based access control (Farmer, Retailer, Official)
- Email/password authentication (Supabase Auth)
- User registration and login
- User profile management
- Procurement schedule management
- Automatic time slot generation
- Slot booking system with quantity — live-tested
- Official booking visibility (view all bookings, filter by status) — live-tested
- Booking status management with terminal-state guard (`completed`/`missed` are final) — live-tested
- Crops catalog API
- Health check endpoint
- Input validation (Joi)
- Error handling
- Database schema (SQL)
- Marketplace listings (CRUD, browse/filter, soft delete) — live-tested
- Bidding system (place, view, accept, reject) — live-tested, including
  auto-rejection of competing bids and blocking bids on sold/inactive listings
- Orders (auto-created on bid acceptance) with confirmed → paid → completed
  flow, plus cancel-before-payment (reopens the listing) — live-tested
- Mock payment simulation (no real gateway), one payment per order enforced —
  live-tested
- Mandi price integration using official data.gov.in API with latest date filtering
- Notifications for bid/order/payment/booking events — live-tested end-to-end
- Per-role dashboards (Farmer/Retailer/Official) — live-tested end-to-end
- AI chatbot (`POST /api/chat`, NVIDIA NIM, model `meta/llama-3.2-11b-vision-instruct`)
  — fully live-tested including real AI replies and mandi-grounded answers
- Ratings & reviews for completed orders — fully live-tested including real
  create/fetch operations, the duplicate-review and self-review DB
  constraints, and the average-rating summary (43/43 checks)

✅ **Marketplace end-to-end flow verified (2026-09-05):** farmer creates listing →
retailer bids → farmer accepts (competing bids auto-rejected, listing marked sold,
order created) → retailer pays (mock) → order completed. 41/41 automated checks
passed via real HTTP requests against a running server, including negative cases
(unauthorized access, duplicate bids/payments, invalid state transitions). See
CHANGELOG.md for the full test breakdown.

✅ **Procurement/slot-booking flow verified (2026-09-05):** farmer views slots →
books a slot with a quantity → views own bookings; official views all bookings
(filterable by status) → updates booking status, with completed/missed bookings
locked from further changes. 23/23 automated checks passed via real HTTP
requests. See CHANGELOG.md for the full test breakdown.

✅ **Notifications flow verified end-to-end (2026-09-05):** a new bid, bid
accepted/rejected, mock payment, order completed, new slot booking, and booking
status update each create the expected notification for the right recipient;
users can view their own notifications and mark them read (with ownership
enforced); every triggering action (place/accept/reject bid, pay/complete
order, book a slot, update booking status) continues to work normally.
28/28 automated checks passed via real HTTP requests. See CHANGELOG.md for the
full test breakdown.

✅ **Dashboard endpoints verified end-to-end (2026-09-05):** each role's
dashboard returns the correct empty state for a brand-new user, enforces role
restrictions in both directions, and — after creating real listings, bids,
orders, and bookings — correctly reflects that data for the right user.
34/34 automated checks passed via real HTTP requests. See CHANGELOG.md for the
full test breakdown.

✅ **AI chatbot fully verified end-to-end (2026-09-06):** authentication,
request validation, and two real general farming questions and one real
mandi-price question all returned genuine, non-empty AI replies from NVIDIA
NIM. The mandi-price question correctly retrieved real data via the existing
mandi price service and grounded its answer in it (`used_mandi_data: true`,
correct prices cited, source clearly attributed). 17/17 automated checks
passed via real HTTP requests. Two dead models were discovered and replaced
along the way — `meta/llama3-8b-instruct` and `meta/llama-3.1-8b-instruct`
have both reached end-of-life on NVIDIA's catalog; the currently live model
confirmed via a real API call is `meta/llama-3.2-11b-vision-instruct`. See
CHANGELOG.md for the full test breakdown and model-selection story.

✅ **Ratings & reviews fully verified end-to-end (2026-09-06):** the
`ratings_reviews` migration has been run in Supabase. A farmer and a retailer
each successfully reviewed the other after a completed order; rating
validation accepted 1–5 and rejected 0, 6, negative, decimal, string, and
missing values; a duplicate review on the same order was rejected (`409`,
DB-enforced); a direct raw-insert attempt confirmed the database itself
blocks `reviewer_id = reviewee_id` (`CHECK` constraint, not just an app-layer
check); non-participants were rejected from both reviewing and viewing an
order's reviews; and the average-rating summary was confirmed correct across
two reviews. 43/43 automated checks passed via real HTTP requests, with zero
failures and no code changes needed. Full regression (health, marketplace,
bids/orders, mandi prices, procurement, notifications, dashboards, chatbot)
also passed. See CHANGELOG.md for the full test breakdown.

🚧 **Pending:**
- Phone OTP authentication (deferred to Phase 2)

## API Endpoints

### Public
- `GET /api/health` - Server health check
- `GET /api/crops` - Get all crops

### Authentication
- `POST /api/auth/register` - Register new user (Farmer/Retailer only)
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout user (requires authentication)

### User Profile (Requires Authentication)
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update current user profile

### Procurement (Requires Authentication)
- `POST /api/procurement/schedules` - Create schedule (Official only)
- `GET /api/procurement/schedules` - Get schedules with filters
- `GET /api/procurement/slots/:scheduleId` - Get slots for a schedule
- `POST /api/procurement/bookings` - Book a slot with a quantity (Farmer only)
- `GET /api/procurement/bookings/me` - Get my bookings (Farmer only)
- `GET /api/procurement/bookings` - Get all bookings, filterable by status (Official only)
- `PUT /api/procurement/bookings/:id/status` - Update booking status (Official only)

### Marketplace — Listings (see API_DOCUMENTATION.md for full details)
- `POST /api/listings` - Create a listing (Farmer only)
- `GET /api/listings` - Browse active listings (public, filterable)
- `GET /api/listings/me` - My own listings, any status (Farmer only)
- `GET /api/listings/:id` - Listing details (public)
- `PUT /api/listings/:id` - Update own listing (Farmer only)
- `DELETE /api/listings/:id` - Deactivate own listing (Farmer only)

### Marketplace — Bidding
- `POST /api/listings/:id/bids` - Place a bid (Retailer only)
- `GET /api/listings/:id/bids` - View bids on own listing (Farmer only)
- `GET /api/bids/me` - My own bids (Retailer only)
- `PUT /api/bids/:id/accept` - Accept a bid, creates an order (Farmer only)
- `PUT /api/bids/:id/reject` - Reject a bid (Farmer only)

### Marketplace — Orders & Mock Payment
- `GET /api/orders/me` - My own orders (Farmer or Retailer)
- `GET /api/orders/:id` - Order details (participant only)
- `POST /api/orders/:id/pay` - Simulate a mock payment (Retailer/buyer only)
- `GET /api/orders/:id/payment` - View mock payment record (participant only)
- `PUT /api/orders/:id/complete` - Mark a paid order completed (participant)
- `PUT /api/orders/:id/cancel` - Cancel an unpaid order (participant)

### Mandi Prices (Public)
- `GET /api/mandi-prices` - Get current/latest mandi prices from data.gov.in API

### Notifications (Requires Authentication, any role)
- `GET /api/notifications/me` - Get my own notifications
- `PUT /api/notifications/:id/read` - Mark a notification as read (owner only)

### Dashboard (Requires Authentication, role-specific)
- `GET /api/dashboard/farmer` - Listings, bids, orders, bookings, notifications (Farmer only)
- `GET /api/dashboard/retailer` - Bids, orders, notifications (Retailer only)
- `GET /api/dashboard/official` - All bookings + summary counts by status (Official only)

### AI Chatbot (Requires Authentication, any role)
- `POST /api/chat` - Ask a farming question; optionally include `crop` and
  `state` to ground price questions in real mandi data

### Ratings & Reviews (Requires Authentication)
- `POST /api/reviews` - Review a completed order you participated in
- `GET /api/reviews/user/:userId` - Get a user's received reviews + rating summary (any authenticated role)
- `GET /api/reviews/order/:orderId` - Get review(s) for an order (participant only)

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** Supabase (PostgreSQL)
- **Validation:** Joi
- **Logging:** Morgan

## Status

⚠️ **Note:** This backend requires Supabase credentials to be fully functional. The server will start without credentials but database-dependent endpoints will return appropriate error messages.

**Database Status:**
- ✅ Base schema (users, crops, procurement_*) created in Supabase
- ✅ Marketplace tables (listings, bids, orders, payments) created and verified working
- ✅ `procurement_bookings.quantity` column added and verified working
- ✅ `notifications` table created and verified working
- ✅ `ratings_reviews` table created and fully verified working
- ✅ Seed script ready and verified
- ⚠️ Crop seeding requires manual execution (security restrictions)
- ⚠️ User creation requires manual execution or API registration; Official accounts
  specifically cannot self-register at all (by design) and must be created directly
  in Supabase — see SETUP.md
- ℹ️ RLS is enabled on the marketplace tables with no policies; the API uses the
  service-role client (`supabaseAdmin`) for those tables since authorization is
  enforced in the application layer, not via RLS. See DATABASE_SCHEMA.md.

**Authentication Status:**
- ✅ Email/password authentication implemented
- ✅ Role-based access control (Farmer, Retailer, Official)
- ✅ Official self-registration prevention
- ⚠️ Requires Supabase email provider configuration
- ⚠️ Phone OTP authentication deferred to Phase 2

**External API Status:**
- ✅ `AGMARKNET_API_KEY` configured and working (`GET /api/mandi-prices`)
- ✅ `NVIDIA_NIM_API_KEY` configured and working (`POST /api/chat`) — real AI
  replies confirmed live using model `meta/llama-3.2-11b-vision-instruct`

See [SETUP.md](SETUP.md) for complete configuration instructions.

## License

ISC
