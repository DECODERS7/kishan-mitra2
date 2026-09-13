# Database Schema

Complete database structure for Krishi Setu Backend.

## Overview

The database uses PostgreSQL via Supabase with 11 tables supporting user management, crop catalog, procurement operations, the farmer-buyer marketplace (listings, bids, orders, mock payments), notifications, and ratings/reviews.

**Migration status:** all 11 tables (`users`, `crops`, `procurement_schedules`, `procurement_slots`, `procurement_bookings`, `listings`, `bids`, `orders`, `payments`, `notifications`, `ratings_reviews`) are live in Supabase and verified working via real HTTP requests against the running API.

**Row Level Security note:** `listings`, `bids`, `orders`, `payments`, `notifications`, and `ratings_reviews` have RLS enabled in Supabase with no policies defined. The app does not rely on RLS/`auth.uid()` for authorization on these tables — authorization is enforced entirely in the Express service layer (role middleware + explicit ownership checks). Accordingly, `services/listingService.js`, `services/bidService.js`, `services/orderService.js`, `services/notificationService.js`, and `services/reviewService.js` all use the `supabaseAdmin` (service-role) client, which bypasses RLS, matching the pattern already used by `procurementService.js`. If you ever add RLS policies to these tables intending them to be enforced, note that they currently have no effect on API behavior since the service-role key bypasses them.

**Dashboard note:** `GET /api/dashboard/*` (`routes/dashboard.js`, `services/dashboardService.js`) adds no new tables or columns — it's a read-only aggregation layer that calls existing service functions (listings, bids, orders, procurement bookings, notifications) and returns their results together. The one new query added to support it, `bidService.getBidsForFarmer()`, reads from the existing `bids` table filtered by its parent listing's `farmer_id` (via a `listings!inner` embed) — no schema change.

**AI chatbot note:** `POST /api/chat` (`routes/chat.js`, `services/chatService.js`) adds no database tables at all — per the requirement, there is no chat-history table, no RAG, no vector database, no embeddings. The chatbot is stateless: each request calls NVIDIA NIM directly and, when a `crop`+`state` pair is given, reads real price data through the existing `mandiPriceService` (itself backed by the external data.gov.in API, not a local table). Nothing about this feature is persisted anywhere in Supabase. This remains true after the 2026-09-06 fix (model swap, better error diagnostics, longer timeout) — no schema changes were made or needed.

## Tables

### 1. users

Stores user profiles with role-based access control.

**Purpose:** Manage user accounts and roles for Farmers, Retailers, and Officials.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique user identifier |
| phone_number | VARCHAR(15) | UNIQUE, NOT NULL | User's phone number |
| name | VARCHAR(100) | | User's full name |
| role | VARCHAR(20) | NOT NULL, CHECK IN ('farmer', 'retailer', 'official') | User role for RBAC |
| location | VARCHAR(200) | | User's location (district, state) |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Account creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- One-to-many with `procurement_schedules` (as official_id)
- One-to-many with `procurement_bookings` (as farmer_id)

**Indexes:**
- `idx_users_role` on `role` column
- `idx_users_phone` on `phone_number` column

**Triggers:**
- `update_users_updated_at` - Automatically updates `updated_at` on row update

**Constraints:**
- `users_phone_number_key` - UNIQUE constraint on phone_number
- `users_role_check` - CHECK constraint ensuring valid role values

---

### 2. crops

Pre-seeded catalog of agricultural crops.

**Purpose:** Provide a standardized list of crops for the platform.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing crop ID |
| name | VARCHAR(100) | UNIQUE, NOT NULL | Crop name (e.g., "Wheat", "Rice") |
| unit | VARCHAR(20) | NOT NULL | Unit of measurement (e.g., "quintal") |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Record creation timestamp |

**Relationships:**
- One-to-many with `procurement_schedules` (as crop_id)

**Pre-seeded Data:**
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

**Constraints:**
- `crops_name_key` - UNIQUE constraint on name

---

### 3. procurement_schedules

Stores procurement schedules created by officials.

**Purpose:** Define when and where procurement will happen for specific crops.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing schedule ID |
| official_id | UUID | FOREIGN KEY → users(id), ON DELETE CASCADE | ID of official who created schedule |
| crop_id | INTEGER | FOREIGN KEY → crops(id), ON DELETE CASCADE | ID of crop being procured |
| mandi_name | VARCHAR(100) | NOT NULL | Name of the mandi/market |
| date | DATE | NOT NULL | Date of procurement |
| window_start | TIME | NOT NULL | Start time of procurement window |
| window_end | TIME | NOT NULL | End time of procurement window |
| slot_duration_minutes | INTEGER | NOT NULL | Duration of each time slot in minutes |
| capacity | INTEGER | NOT NULL | Maximum bookings per slot |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Schedule creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one with `users` (via official_id)
- Many-to-one with `crops` (via crop_id)
- One-to-many with `procurement_slots` (via schedule_id)

**Indexes:**
- `idx_procurement_schedules_crop` on `crop_id` column
- `idx_procurement_schedules_date` on `date` column

**Triggers:**
- `update_procurement_schedules_updated_at` - Automatically updates `updated_at` on row update

**Constraints:**
- `procurement_schedules_official_id_fkey` - FOREIGN KEY to users
- `procurement_schedules_crop_id_fkey` - FOREIGN KEY to crops

**Business Logic:**
- Time slots are automatically generated based on window_start, window_end, and slot_duration_minutes
- window_end must be after window_start (validated in application layer)

---

### 4. procurement_slots

Auto-generated time slots for procurement schedules.

**Purpose:** Provide specific time windows for farmers to book appointments.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing slot ID |
| schedule_id | INTEGER | FOREIGN KEY → procurement_schedules(id), ON DELETE CASCADE | Parent schedule ID |
| start_time | TIME | NOT NULL | Slot start time |
| end_time | TIME | NOT NULL | Slot end time |
| capacity | INTEGER | NOT NULL | Maximum bookings for this slot |
| booked_count | INTEGER | DEFAULT 0 | Current number of bookings |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Slot creation timestamp |

**Relationships:**
- Many-to-one with `procurement_schedules` (via schedule_id)
- One-to-many with `procurement_bookings` (via slot_id)

**Indexes:**
- `idx_procurement_slots_schedule` on `schedule_id` column

**Constraints:**
- `procurement_slots_schedule_id_fkey` - FOREIGN KEY to procurement_schedules

**Business Logic:**
- Slots are generated automatically when a schedule is created
- `available` = `capacity` - `booked_count` (calculated in application layer)
- Booking is prevented when `booked_count` >= `capacity`

---

### 5. procurement_bookings

Stores farmer bookings for procurement slots.

**Purpose:** Track which farmers have booked which slots and their status.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing booking ID |
| slot_id | INTEGER | FOREIGN KEY → procurement_slots(id), ON DELETE CASCADE | Booked slot ID |
| farmer_id | UUID | FOREIGN KEY → users(id), ON DELETE CASCADE | Farmer who made the booking |
| quantity | NUMERIC(10,2) | NULLABLE, CHECK (quantity IS NULL OR quantity > 0) | Quantity of the slot's crop the farmer intends to bring. Added via `utils/migration_add_booking_quantity.sql`, applied and verified working. |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'booked', CHECK IN ('booked', 'arrived', 'completed', 'missed') | Booking status |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Booking creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one with `procurement_slots` (via slot_id)
- Many-to-one with `users` (via farmer_id)

**Indexes:**
- `idx_procurement_bookings_slot` on `slot_id` column
- `idx_procurement_bookings_farmer` on `farmer_id` column
- `idx_procurement_bookings_status` on `status` column

**Triggers:**
- `update_procurement_bookings_updated_at` - Automatically updates `updated_at` on row update

**Constraints:**
- `procurement_bookings_slot_id_fkey` - FOREIGN KEY to procurement_slots
- `procurement_bookings_farmer_id_fkey` - FOREIGN KEY to users
- `procurement_bookings_slot_id_farmer_id_key` - UNIQUE constraint on (slot_id, farmer_id) - prevents duplicate bookings
- `procurement_bookings_status_check` - CHECK constraint for valid status values

**Status Workflow:**
1. `booked` - Initial status when slot is booked
2. `arrived` - Farmer has arrived at mandi
3. `completed` - Procurement completed successfully
4. `missed` - Farmer missed the appointment

**Business Logic:**
- One farmer cannot book the same slot twice (enforced by UNIQUE constraint)
- Booking increments `booked_count` in parent slot
- Status can only be updated by Officials
- Once a booking reaches `completed` or `missed` (terminal states), its status can no
  longer be changed (enforced in `services/procurementService.js`, not the database)
- Farmers can only ever see their own bookings (`GET /bookings/me`); only Officials can
  see every farmer's bookings (`GET /bookings`)

---

## Database Extensions

### uuid-ossp

Provides UUID generation functions.

**Purpose:** Generate UUID primary keys for user records.

**Functions Used:**
- `uuid_generate_v4()` - Generate random UUID

---

## Indexes Summary

| Index Name | Table | Column(s) | Purpose |
|------------|-------|------------|---------|
| idx_users_role | users | role | Fast role-based queries |
| idx_users_phone | users | phone_number | Fast phone number lookups |
| idx_procurement_schedules_crop | procurement_schedules | crop_id | Filter schedules by crop |
| idx_procurement_schedules_date | procurement_schedules | date | Filter schedules by date |
| idx_procurement_slots_schedule | procurement_slots | schedule_id | Get slots for a schedule |
| idx_procurement_bookings_slot | procurement_bookings | slot_id | Get bookings for a slot |
| idx_procurement_bookings_farmer | procurement_bookings | farmer_id | Get bookings for a farmer |
| idx_procurement_bookings_status | procurement_bookings | status | Filter bookings by status |
| idx_listings_farmer | listings | farmer_id | Get a farmer's listings |
| idx_listings_crop | listings | crop_id | Filter listings by crop |
| idx_listings_status | listings | status | Filter active/sold/inactive listings |
| idx_bids_listing | bids | listing_id | Get bids for a listing |
| idx_bids_retailer | bids | retailer_id | Get a retailer's bids |
| idx_bids_status | bids | status | Filter bids by status |
| idx_orders_farmer | orders | farmer_id | Get a farmer's orders |
| idx_orders_retailer | orders | retailer_id | Get a retailer's orders |
| idx_orders_listing | orders | listing_id | Look up the order for a listing |
| idx_orders_status | orders | status | Filter orders by status |
| idx_payments_order | payments | order_id | Look up the payment for an order |
| idx_notifications_user | notifications | user_id | Get a user's notifications |
| idx_notifications_user_unread | notifications | user_id, is_read | Filter unread notifications |
| idx_ratings_reviews_order | ratings_reviews | order_id | Get review(s) for an order |
| idx_ratings_reviews_reviewee | ratings_reviews | reviewee_id | Get reviews received by a user |
| idx_ratings_reviews_reviewer | ratings_reviews | reviewer_id | Look up a reviewer's existing review on an order |

---

## Relationships Diagram

```
users (1) ----< (N) procurement_schedules (1) ----< (N) procurement_slots (1) ----< (N) procurement_bookings
 |                                                           ^
 |                                                           |
 +--------------------------- (N) procurement_bookings -----+
                                (as farmer_id)

crops (1) ----< (N) procurement_schedules
crops (1) ----< (N) listings

users (1) ----< (N) listings (as farmer_id)
listings (1) ----< (N) bids
users (1) ----< (N) bids (as retailer_id)
bids (1) ---- (1) orders            -- one order per accepted bid (UNIQUE bid_id)
listings (1) ----< (N) orders
orders (1) ---- (1) payments        -- one mock payment per order (UNIQUE order_id)

users (1) ----< (N) notifications (as user_id)

orders (1) ----< (N) ratings_reviews       -- up to 2 (one per reviewer, UNIQUE order_id+reviewer_id)
users (1) ----< (N) ratings_reviews (as reviewer_id)
users (1) ----< (N) ratings_reviews (as reviewee_id)
```

**Legend:**
- `1 ----< N` - One-to-many relationship
- Foreign keys create referential integrity
- ON DELETE CASCADE ensures cleanup when parent records are deleted

---

## Data Integrity

### Foreign Key Constraints
All foreign key relationships use `ON DELETE CASCADE` to ensure data consistency:
- Deleting a user deletes their schedules and bookings
- Deleting a crop deletes related schedules
- Deleting a schedule deletes all its slots
- Deleting a slot deletes all its bookings

### Check Constraints
- `users.role` - Only allows 'farmer', 'retailer', 'official'
- `procurement_bookings.status` - Only allows 'booked', 'arrived', 'completed', 'missed'

### Unique Constraints
- `users.phone_number` - One phone number per user
- `crops.name` - One crop name per crop
- `procurement_bookings(slot_id, farmer_id)` - One booking per farmer per slot

---

## Triggers

### update_updated_at_column()

**Function:** Automatically updates the `updated_at` timestamp when a row is modified.

**Applied to:**
- `users` table
- `procurement_schedules` table
- `procurement_bookings` table

**Behavior:**
```sql
CREATE TRIGGER update_table_updated_at 
BEFORE UPDATE ON table_name
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();
```

---

### 6. listings

Marketplace crop listings created by farmers.

**Purpose:** Let a farmer offer a quantity of a crop for sale at an expected price.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing listing ID |
| farmer_id | UUID | FOREIGN KEY → users(id), ON DELETE CASCADE | Farmer who owns the listing |
| crop_id | INTEGER | FOREIGN KEY → crops(id), ON DELETE RESTRICT | Crop being listed |
| quantity | NUMERIC(10,2) | NOT NULL, CHECK (quantity > 0) | Quantity offered |
| price | NUMERIC(10,2) | NOT NULL, CHECK (price > 0) | Expected/asking price per unit |
| location | VARCHAR(200) | | Listing location (district, state) |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK IN ('active','inactive','sold','expired') | Listing lifecycle status |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

**Business Logic:**
- Only the owning farmer can update or deactivate a listing (enforced in `services/listingService.js`).
- Only `active` listings accept bids.
- A listing is set to `sold` automatically when one of its bids is accepted; it becomes immutable at that point.
- `DELETE /api/listings/:id` is a soft delete — it sets `status = 'inactive'`, rows are never removed.

**Indexes:** `idx_listings_farmer`, `idx_listings_crop`, `idx_listings_status`
**Triggers:** `update_listings_updated_at`

---

### 7. bids

Retailer bids placed against a listing.

**Purpose:** Let a retailer offer a price/quantity for a farmer's listing.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing bid ID |
| listing_id | INTEGER | FOREIGN KEY → listings(id), ON DELETE CASCADE | Listing being bid on |
| retailer_id | UUID | FOREIGN KEY → users(id), ON DELETE CASCADE | Retailer placing the bid |
| quantity | NUMERIC(10,2) | NOT NULL, CHECK (quantity > 0) | Quantity requested (≤ listing quantity) |
| price | NUMERIC(10,2) | NOT NULL, CHECK (price > 0) | Offered price per unit |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'pending', CHECK IN ('pending','accepted','rejected') | Bid status |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

**Business Logic:**
- A retailer cannot bid on their own listing, or on a listing that is not `active`.
- A retailer cannot have two simultaneous `pending` bids on the same listing.
- Accepting a bid (`PUT /api/bids/:id/accept`) automatically rejects every other `pending` bid on the same listing.

**Indexes:** `idx_bids_listing`, `idx_bids_retailer`, `idx_bids_status`
**Triggers:** `update_bids_updated_at`

---

### 8. orders

Created automatically when a farmer accepts a bid.

**Purpose:** Track the sale agreed between a farmer and a retailer through to payment and completion.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing order ID |
| listing_id | INTEGER | FOREIGN KEY → listings(id), ON DELETE RESTRICT | Source listing |
| bid_id | INTEGER | FOREIGN KEY → bids(id), UNIQUE, ON DELETE RESTRICT | Accepted bid (unique — one order per bid) |
| farmer_id | UUID | FOREIGN KEY → users(id), ON DELETE RESTRICT | Seller |
| retailer_id | UUID | FOREIGN KEY → users(id), ON DELETE RESTRICT | Buyer |
| quantity | NUMERIC(10,2) | NOT NULL, CHECK (quantity > 0) | Quantity from the accepted bid |
| final_price | NUMERIC(10,2) | NOT NULL, CHECK (final_price > 0) | Price per unit from the accepted bid |
| total_amount | NUMERIC(12,2) | NOT NULL, CHECK (total_amount > 0) | `quantity * final_price` |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'confirmed', CHECK IN ('pending','confirmed','paid','completed','cancelled') | Order lifecycle status |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

**Status Workflow (as implemented):**
1. `confirmed` — set automatically when the order is created from an accepted bid.
2. `paid` — set after a successful mock payment (`POST /api/orders/:id/pay`).
3. `completed` — set after either participant confirms completion (`PUT /api/orders/:id/complete`), only allowed from `paid`.
4. `cancelled` — either participant may cancel while still `confirmed` (i.e. before payment); the source listing is reopened to `active`.

The `pending` value is reserved in the CHECK constraint for future use (e.g. an order awaiting farmer confirmation before the current flow's `confirmed` step) but is not produced by the current code path.

**Indexes:** `idx_orders_farmer`, `idx_orders_retailer`, `idx_orders_listing`, `idx_orders_status`
**Triggers:** `update_orders_updated_at`
**Constraints:** UNIQUE on `bid_id` prevents duplicate orders for the same accepted bid.

---

### 9. payments

Mock/simulated payments only — no real payment gateway is integrated.

**Purpose:** Represent a deterministic, simulated payment against an order for demo purposes.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing payment ID |
| order_id | INTEGER | FOREIGN KEY → orders(id), UNIQUE, ON DELETE CASCADE | Order being paid (one payment per order) |
| amount | NUMERIC(12,2) | NOT NULL, CHECK (amount > 0) | Amount paid (equals order.total_amount) |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'success', CHECK IN ('success','failed') | Mock payment result |
| method | VARCHAR(20) | NOT NULL, DEFAULT 'mock' | Always `'mock'` — no real gateway |
| paid_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | When the mock payment was recorded |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Row creation timestamp |

**Business Logic:**
- `POST /api/orders/:id/pay` always succeeds deterministically (no real gateway, no failure simulation) and can only be called once per order (enforced by the UNIQUE constraint on `order_id`).
- Only the buyer (retailer) on the order can trigger payment.

**Indexes:** `idx_payments_order`

---

### 10. notifications

**Status: live in Supabase, verified working end-to-end via real HTTP requests (2026-09-05).**

Per-user notifications generated as a side effect of other actions.

**Purpose:** Let farmers, retailers, and officials see a simple feed of relevant
events (new bid, bid accepted/rejected, payment received, order completed/cancelled,
new slot booking, booking status change) without any external delivery channel.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing notification ID |
| user_id | UUID | NOT NULL, FOREIGN KEY → users(id), ON DELETE CASCADE | Recipient |
| type | VARCHAR(50) | NOT NULL | One of the `NOTIFICATION_TYPE` values in `config/constants.js` (e.g. `bid_placed`, `bid_accepted`, `bid_rejected`, `payment_update`, `order_update`, `booking_update`) — not DB-enforced, kept as a plain string to avoid a CHECK constraint that has to be updated every time a new type is added |
| title | VARCHAR(200) | NOT NULL | Short heading |
| message | TEXT | NOT NULL | Human-readable detail |
| related_type | VARCHAR(50) | NULLABLE | What kind of thing this notification is about (`listing`, `bid`, `order`, `booking`) — informational only, no FK (points to different tables depending on type) |
| related_id | INTEGER | NULLABLE | ID of that thing |
| is_read | BOOLEAN | NOT NULL, DEFAULT false | Whether the recipient has read it |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Creation timestamp |

**Business Logic:**
- Notification creation is **fire-and-forget**: `notificationService.createNotification()`
  catches its own errors and never throws, so a notification failure (e.g. the
  table doesn't exist, or a transient DB error) never breaks the bid/order/booking
  action that triggered it. Failures are only logged server-side. This was
  deliberately chosen over making notifications part of any transaction — they are
  a side effect, not a core requirement, and the app must keep working if this
  feature has a problem.
- A user can only view and mark-as-read their own notifications (`user_id` must
  match the authenticated user).
- No SMS/WhatsApp/push delivery — in-app only, matching the hackathon scope.

**Indexes:** `idx_notifications_user`, `idx_notifications_user_unread`

---

### 11. ratings_reviews

**Status: live in Supabase and fully verified (2026-09-06).** The migration
(`utils/migration_add_ratings_reviews.sql`) has been run. 43/43 checks passed
via real HTTP requests, including actually creating reviews in both
directions on a completed order, the duplicate-review `409`, the
`CHECK (reviewer_id <> reviewee_id)` constraint (verified with a direct
insert attempt bypassing the app layer), rating validation (1–5 accepted;
0, 6, negative, decimal, string, and missing all rejected), retrieval, and
the average-rating summary across multiple reviews.

Lets the two participants on a completed order rate and review each other.

**Purpose:** A simple reputation signal for the marketplace — not a general
review platform, not tied to listings directly (only to completed orders).

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing review ID |
| order_id | INTEGER | NOT NULL, FOREIGN KEY → orders(id), ON DELETE CASCADE | The completed order this review is about |
| reviewer_id | UUID | NOT NULL, FOREIGN KEY → users(id), ON DELETE CASCADE | Who wrote the review |
| reviewee_id | UUID | NOT NULL, FOREIGN KEY → users(id), ON DELETE CASCADE | Who is being reviewed (the other order participant) |
| rating | INTEGER | NOT NULL, CHECK (rating BETWEEN 1 AND 5) | Star rating |
| comment | TEXT | NULLABLE | Optional free-text review (max 500 chars, enforced by Joi validation) |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

**Business Logic:**
- Only a participant (farmer or retailer) on the order may review it — enforced
  by reusing `orderService.getOrderById()`, the same ownership check used
  elsewhere for orders.
- Only `completed` orders can be reviewed.
- The reviewee is always "the other participant" on the order, which makes
  self-review structurally impossible through the normal flow; a `CHECK
  (reviewer_id <> reviewee_id)` constraint and an application-layer check both
  defend against it anyway, in case that assumption ever changes.
- One review per reviewer per order, enforced by `UNIQUE (order_id,
  reviewer_id)` — a database constraint, not just an application check, so it
  holds even under a race between two near-simultaneous requests.
- `GET /api/reviews/user/:userId` (aggregate reputation) is intentionally
  public to any authenticated user — the point of a reputation system is for
  other users to see it before trading. `GET /api/reviews/order/:orderId`
  (order-level detail) is participant-only, since order details are private.

**Indexes:** `idx_ratings_reviews_order`, `idx_ratings_reviews_reviewee`, `idx_ratings_reviews_reviewer`
**Triggers:** `update_ratings_reviews_updated_at`
**Constraints:** `CHECK (rating BETWEEN 1 AND 5)`, `CHECK (reviewer_id <> reviewee_id)`, `UNIQUE (order_id, reviewer_id)`

---

## Future Tables (Not Yet Implemented)

The following tables are still planned but not yet created:

- `mandi_price_cache` - Cached mandi price data (Agmarknet integration; current
  implementation calls the live API directly, no local cache table)

(`ratings_reviews` was previously listed here — its schema is now fully
defined in `utils/migration_add_ratings_reviews.sql` and documented in table
#11 above; it's designed and code-complete, just not yet applied to Supabase.)

---

## Migration Notes

### Current Schema Version
- Version: 1.0
- Date: 2026-09-03
- Status: Foundation complete

### Deployment Steps
1. Run the complete SQL script in Supabase SQL Editor
2. Verify all tables are created
3. Run seed script to populate crops table
4. Create official user manually via SQL

### Backup Strategy
- Use Supabase's built-in backup features
- Export schema regularly using `pg_dump`
- Test restoration procedures

---

## Performance Considerations

### Query Optimization
- Indexes are placed on frequently filtered columns
- Foreign key columns are indexed for JOIN performance
- Composite index on (slot_id, farmer_id) for duplicate prevention

### Scaling Considerations
- Current schema suitable for hackathon/demo scale
- Consider partitioning for large-scale production
- Add connection pooling for high concurrency
- Implement read replicas for reporting queries

---

## Security Considerations

### Data Protection
- User phone numbers are indexed but should be treated as sensitive
- Role-based access enforced at application layer
- UUIDs for user IDs prevent enumeration attacks

### Access Control
- Database access via Supabase secret key only
- Publishable key for client-side operations with RLS (to be implemented)
- Row-level security policies should be added for production

---

## Troubleshooting

### Common Issues

**Foreign Key Errors:**
- Ensure referenced records exist before creating dependent records
- Check CASCADE behavior when deleting parent records

**Constraint Violations:**
- UNIQUE violations: Check for existing records before insert
- CHECK violations: Verify enum values match constraints

**Performance Issues:**
- Run `ANALYZE` on tables after bulk inserts
- Check query execution plans with `EXPLAIN`
- Verify indexes are being used

---

## Maintenance

### Regular Tasks
- Monitor table sizes and growth
- Check index usage statistics
- Archive old booking records
- Update statistics with `VACUUM ANALYZE`

### Schema Evolution
- Use migration scripts for schema changes
- Test migrations on staging environment first
- Document breaking changes
- Provide rollback procedures
