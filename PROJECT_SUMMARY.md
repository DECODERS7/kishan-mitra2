# Project Summary

## Project Purpose

Krishi Setu is a Farmer Procurement & Direct Marketplace Platform designed to address two key SIH (Smart India Hackathon) problem statements:

- **SIH26032:** Farmers face long waiting times, no information on procurement schedules, and uncertainty about procurement status at government mandis.
- **SIH26033:** Multiple intermediaries reduce farmer earnings and increase consumer prices in the agricultural supply chain.

The platform aims to:
- Provide predictable appointment-based procurement instead of uncertain waiting
- Enable direct farmer-to-buyer marketplace connections
- Offer live, trustworthy price data
- Provide AI-powered assistance for farmers

## Current Architecture

```
┌─────────────────┐
│   Frontend      │ (To be implemented separately)
│   (Future)      │
└────────┬────────┘
         │ REST API
         ↓
┌─────────────────┐
│  Express.js     │
│  Backend API    │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   Supabase      │
│  (PostgreSQL)   │
│  + Auth         │
│  + Storage      │
└─────────────────┘
```

### Current Backend Components

- **API Layer:** Express.js with REST endpoints
- **Middleware:** Authentication, RBAC, validation, error handling
- **Business Logic:** Service layer for procurement operations
- **Data Layer:** Supabase client for database operations
- **Configuration:** Environment-based configuration management

## Technology Stack

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js 4.18+
- **Database:** Supabase (PostgreSQL)
- **Validation:** Joi 17.11+
- **HTTP Client:** Axios 1.6+
- **Logging:** Morgan 1.10+
- **Environment:** dotenv 16.3+

### Development Tools
- **Package Manager:** npm
- **Version Control:** Git
- **Testing:** Custom test script (test-api.js)

## User Roles and Mapping

### 1. Farmer
- **Purpose:** Primary user who sells produce and books procurement slots
- **Capabilities:**
  - Book procurement time slots for a quantity of the slot's crop
  - View own bookings (never another farmer's)
  - Create, update, and deactivate marketplace listings
  - View and accept/reject bids on own listings
  - View own orders, mark paid orders completed, cancel unpaid orders
  - View a single dashboard combining own listings, bids received, orders,
    bookings, and notifications
  - (Future) View mandi prices
- **Authentication:** Email/password (Supabase Auth). Phone + OTP deferred to Phase 2.

### 2. Retailer/Buyer
- **Purpose:** Secondary user who purchases produce from farmers
- **Capabilities:**
  - Browse and filter marketplace listings
  - Place bids on active listings
  - View own bids and own orders
  - Simulate mock payment on a confirmed order
  - Mark paid orders completed, cancel unpaid orders
  - View a single dashboard combining own bids, orders, and notifications
  - (Future) View mandi prices
- **Authentication:** Email/password (Supabase Auth). Phone + OTP deferred to Phase 2.

### 3. Official/Agent
- **Purpose:** Administrative user who manages procurement operations
- **Capabilities:**
  - Create procurement schedules
  - Generate time slots
  - View all farmer bookings (filterable by status)
  - Update booking statuses (booked → arrived → completed/missed)
  - View a simple dashboard: all bookings + a count-by-status summary
  - (Future) Charts and historical analytics
- **Authentication:** Seeded account (not self-registerable — must be created
  directly in Supabase, see SETUP.md)

## Implemented Features

### ✅ Foundation
- Express.js server with middleware stack
- CORS configuration
- JSON request/response handling
- Morgan HTTP logging
- Global error handling
- 404 route handler
- Health check endpoint

### ✅ Configuration
- Environment variable management (.env)
- Supabase client configuration (anon and service role)
- Graceful handling of missing credentials
- Application constants (roles, statuses, HTTP codes)

### ✅ Authentication & Authorization
- JWT token verification middleware
- Role-based access control (RBAC)
- User context injection
- Convenience middlewares for specific roles
- Permission checking on protected routes

### ✅ Validation
- Joi-based request validation
- Validation schemas for all endpoints
- Detailed error messages for validation failures
- Type checking and format validation

### ✅ Error Handling
- Custom AppError class
- Supabase error mapping
- Joi validation error handling
- Development vs production error responses
- Consistent error response format

### ✅ Database Schema
- Users table with role support
- Crops catalog table
- Procurement schedules table
- Procurement slots table
- Procurement bookings table
- Foreign key relationships
- Indexes for performance
- Updated_at triggers
- Listings, bids, orders, and payments tables (`utils/migration_add_marketplace_tables.sql`)
  — **live in Supabase and verified working via real HTTP testing (2026-09-05)**

### ✅ Procurement System
- **Schedule Creation:**
  - Officials can create procurement schedules
  - Define date, location, crop, time window, slot duration, capacity
  - Automatic time slot generation based on parameters

- **Slot Management:**
  - View available slots for a schedule
  - Real-time availability calculation
  - Capacity tracking per slot

- **Booking System (live-tested 2026-09-05):**
  - Farmers can book available slots for a quantity of the slot's crop
  - Overbooking prevention
  - Duplicate booking prevention
  - Farmers see only their own bookings
  - Officials can view every booking across all farmers, filterable by status

- **Status Management (live-tested 2026-09-05):**
  - Booking statuses: booked, arrived, completed, missed
  - Officials can update booking statuses
  - `completed`/`missed` are terminal — status can no longer be changed once reached
  - Updating a nonexistent booking returns a clear 404 instead of a generic error

### ✅ Crops Management
- Pre-seeded crop catalog
- Public API to fetch all crops
- Crop data includes name and unit

### ✅ Authentication (Email/Password)
- Registration (Farmer/Retailer, Official excluded from self-registration)
- Login via Supabase Auth, returns JWT session
- Logout
- `GET/PUT /api/users/me` profile management

### ✅ Marketplace — Listings (live-tested)
- Farmers create, view (own, any status), update, and deactivate (soft delete) listings
- Public browse/filter by crop, location, price range, with pagination
- Only `active` listings are browsable/biddable; `sold` listings are immutable

### ✅ Marketplace — Bidding (live-tested)
- Retailers place bids on active listings (cannot bid on own listing, cannot exceed listing quantity, no duplicate pending bids)
- Farmers view bids on their own listings, accept or reject them
- Accepting a bid auto-rejects competing pending bids and marks the listing sold
- Guarded against a farmer double-clicking "accept" on two different bids for the same listing

### ✅ Marketplace — Orders & Mock Payment (live-tested)
- Order auto-created on bid acceptance (one order per bid, enforced by a UNIQUE constraint)
- Status flow: confirmed → paid → completed, with cancel available before payment (reopens the listing)
- Deterministic mock payment (no real gateway) recorded in a dedicated `payments` table
- Participant-only visibility on orders and payments
- Best-effort compensating rollback if a multi-step operation (accept-bid, or pay-order)
  fails partway through, so the database is never left half-updated

### ✅ Notifications (live-tested end-to-end)
- Simple in-app notifications: create, view own, mark as read — no SMS/WhatsApp/push
- Triggered from: new bid, bid accepted/rejected, payment received, order
  completed/cancelled, new slot booking, booking status update
- Ownership enforced — a user can only mark their own notifications as read
- Fire-and-forget by design — a notification failure never breaks the action
  that triggered it

### ✅ Dashboard (live-tested end-to-end)
- `GET /api/dashboard/farmer` - listings, bids received, orders, procurement
  bookings, and notifications, all for the authenticated farmer
- `GET /api/dashboard/retailer` - bids placed, orders, and notifications, all
  for the authenticated retailer
- `GET /api/dashboard/official` - every procurement booking, plus a simple
  count-by-status summary computed from that same list
- Pure aggregation over existing services — no new tables, no new business
  logic, role restrictions enforced per endpoint

### ✅ AI Chatbot (live-tested end-to-end with real replies, 2026-09-06)
- `POST /api/chat` — NVIDIA NIM-powered farming assistant, any authenticated role
- Answers general farming questions (crops, irrigation, disease, fertilizer,
  harvesting) with practical, non-empty advice — confirmed with real questions
- Optional `crop`+`state` fields ground price questions in real mandi data via
  the existing `mandiPriceService` — confirmed live: a wheat/Madhya Pradesh
  question correctly cited real min/max/modal prices with `used_mandi_data: true`
- Stateless: no chat-history table, no RAG, no vector DB, no embeddings
- Current model: `meta/llama-3.2-11b-vision-instruct`, confirmed via a real
  successful API call after two other models turned out to be retired
- Errors are diagnosable server-side (status, model, sanitized NVIDIA message
  logged) without ever exposing the API key, headers, or `.env` contents

### ✅ Ratings & Reviews (fully live-tested, 2026-09-06)
- `POST /api/reviews` — review a completed order (participant only)
- `GET /api/reviews/user/:userId` — a user's received reviews + rating summary (public to any authenticated user)
- `GET /api/reviews/order/:orderId` — review(s) for an order (participant only)
- Business rules confirmed live end-to-end: only participants can review
  (both directions on the same order tested), only `completed` orders,
  rating must be an integer 1–5 (0, 6, negative, decimal, string, and missing
  all rejected), one review per reviewer per order (`409` on duplicate,
  DB-enforced via `UNIQUE(order_id, reviewer_id)`), self-review blocked at the
  database level (`CHECK(reviewer_id <> reviewee_id)`, confirmed with a direct
  insert bypassing the app layer since it's unreachable through the real API)
- Average-rating summary confirmed correct across multiple reviews for the
  same user
- 43/43 checks passed via real HTTP requests, including full regression
  across every other feature — see DATABASE_SCHEMA.md and CHANGELOG.md

### ✅ API Testing
- Automated test script
- Basic endpoint validation
- Error response testing

## Pending Features

### 🚧 User Management
- User listing (for officials)
- Profile image upload

### 🚧 Marketplace Extras
- Image upload to Supabase Storage for listings
- Partial-quantity fulfillment across multiple accepted bids

### 🚧 External Integrations
- ✅ Agmarknet/data.gov.in live mandi price integration is implemented (`GET /api/mandi-prices`) — see API_DOCUMENTATION.md
- ✅ NVIDIA NIM chatbot is implemented and live-tested with real replies (`POST /api/chat`) — see API_DOCUMENTATION.md
- Price caching mechanism (currently calls the live API directly, no local cache table)
- Scheduled price sync jobs

### 🚧 Phone OTP Authentication
- Deferred to Phase 2; current auth is email/password only

### 🚧 Dashboard Analytics (beyond the basic dashboards already implemented)
- Price trend charts
- Time-series/historical analytics
- Active-listings-across-all-farmers summary (official dashboard currently
  covers bookings only, per the current simple scope)

### 🚧 Additional Features
- Search functionality
- Advanced filtering

## Current Project Status

### Development Phase: Foundation Complete ✅

**Completed Components:**
- Backend infrastructure
- Database schema design
- Core procurement functionality
- Authentication middleware
- Validation framework
- Error handling system

**Ready for:**
- Supabase database setup
- User authentication implementation
- Marketplace development
- External API integrations

### Dependencies Status
- ✅ All npm packages installed
- ✅ Server starts successfully
- ✅ Supabase credentials configured and all tables (base + marketplace) created

### Testing Status
- ✅ Health check endpoint tested
- ✅ Error handling validated
- ✅ Middleware functionality verified
- ✅ Marketplace flow (listing → bid → accept → order → mock payment → complete/cancel)
  live-tested end-to-end via real HTTP requests, including 10+ negative/authorization
  cases (2026-09-05, 41/41 checks passed — see CHANGELOG.md)
- ✅ Procurement flow (schedule → slot → booking → official status update)
  live-tested end-to-end via real HTTP requests (2026-09-05, 23/23 checks
  passed after the booking-quantity migration was applied — see CHANGELOG.md)
- ✅ Notifications (create, view, mark-as-read, all 6 trigger types, ownership
  enforcement) live-tested end-to-end via real HTTP requests (2026-09-05,
  28/28 checks passed after the notifications-table migration was applied —
  see CHANGELOG.md)
- ✅ Dashboard (Farmer/Retailer/Official, fresh-user baseline, role restrictions,
  data-reflects-reality checks) live-tested end-to-end via real HTTP requests
  (2026-09-05, 34/34 checks passed — see CHANGELOG.md)

### Integration Readiness
- ✅ REST API structure defined
- ✅ Authentication middleware ready
- ✅ Response format standardized
- ✅ Error responses consistent
- ✅ CORS configured for frontend integration

## Next Development Steps

1. **Database Setup:**
   - Create Supabase project
   - Run database schema SQL
   - Seed initial data
   - Create test users

2. **Authentication Implementation:**
   - Implement OTP send/verify endpoints
   - Complete user registration flow
   - Test authentication middleware

3. **Marketplace Development:**
   - Implement listing CRUD
   - Add image upload functionality
   - Create browsing/filtering APIs

4. **External Integrations:**
   - Integrate Agmarknet API
   - Implement price caching
   - ~~Add NVIDIA NIM chatbot~~ — done, see "AI Chatbot" under Implemented Features above

## Project Limitations

### Current Limitations
- No frontend implemented
- Payment is mock/simulated only — no real payment gateway (by design for this phase)
- No real-time updates (no WebSocket)
- No partial-quantity fulfillment (accepting a bid sells the entire listing)
- No image upload for listings

### Known Issues
- Server returns 503 errors when Supabase not configured
- No automated testing beyond basic script
- No API rate limiting
- No request logging beyond Morgan

### Security Considerations
- Environment variables not committed (as intended)
- RBAC implemented but not tested with real users
- No input sanitization beyond Joi validation
- No SQL injection protection (relies on Supabase)
- No CORS restrictions (currently open)

## Deployment Considerations

### Current Deployment Readiness: Low
- Requires Supabase credentials
- Database schema needs to be executed
- No production configuration
- No environment-specific settings
- No logging configuration for production

### Production Requirements
- Secure credential management
- Database backups
- Rate limiting
- HTTPS enforcement
- Error monitoring
- Performance monitoring
- Load balancing (if needed)

## Conclusion

The Krishi Setu backend foundation is complete and ready for the next phase of development. The current implementation provides a solid architecture with proper separation of concerns, middleware stack, and business logic layer. The procurement system is fully implemented and ready for testing once Supabase credentials are provided and the database is set up.

The project is well-positioned for rapid development of remaining features (authentication, marketplace, bidding, external integrations) with a clear path forward and established patterns for API development.
