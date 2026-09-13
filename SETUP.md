# Setup Guide

Complete setup instructions for Krishi Setu Backend.

## Prerequisites

### Required Software

- **Node.js** - Version 18.0 or higher
  - Download from [nodejs.org](https://nodejs.org/)
  - Verify installation: `node --version`
  - Should output: `v18.x.x` or higher

- **npm** - Comes with Node.js
  - Verify installation: `npm --version`
  - Should output: `9.x.x` or higher

- **Git** - For version control (optional but recommended)
  - Download from [git-scm.com](https://git-scm.com/)
  - Verify installation: `git --version`

### Required Accounts

- **Supabase Account** - Free account required
  - Sign up at [supabase.com](https://supabase.com)
  - Used for database, authentication, and storage

### Optional Accounts (for Live Data / AI Features)

- **data.gov.in Account** - For the Agmarknet mandi price API (implemented, see API_DOCUMENTATION.md) — get a free key at [api.data.gov.in/signup](https://api.data.gov.in/signup)
- **NVIDIA Account** - For the NVIDIA NIM AI chatbot (implemented and live-tested with real replies, see API_DOCUMENTATION.md) — get a free key at [build.nvidia.com](https://build.nvidia.com). Without this key set, `POST /api/chat` returns a clean `503` error instead of a reply; every other feature is unaffected. **Note:** NVIDIA's free-tier model catalog changes without much notice — if `POST /api/chat` starts returning a `503`/`400` mentioning a specific model, check `services/chatService.js`'s `NVIDIA_MODEL` constant against your account's currently-callable models (verify with a real `POST` to `/v1/chat/completions`, not just `GET /v1/models`, since a model can be listed but not actually callable on a given key).

---

## Installation

### 1. Clone or Download the Project

If using Git:
```bash
git clone <repository-url>
cd krishi-setu-backend
```

If downloading:
- Extract the downloaded archive
- Navigate to the project directory

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages:
- express - Web framework
- @supabase/supabase-js - Supabase client
- cors - CORS middleware
- dotenv - Environment variable management
- joi - Request validation
- axios - HTTP client
- morgan - HTTP logging

**Expected Output:**
```
added 105 packages, and audited 106 packages in 1m
```

**Troubleshooting:**
- If npm install fails, try clearing cache: `npm cache clean --force`
- Ensure you have Node.js 18+ installed
- Check your internet connection

---

## Environment Configuration

### 3. Create Environment File

Copy the example environment file:
```bash
cp .env.example .env
```

Or create `.env` manually in the project root.

### 4. Configure Environment Variables

Edit the `.env` file and add your credentials:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Supabase Configuration (Required for basic functionality)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SECRET_KEY=your_supabase_secret_key

# External API Keys (Optional - for future features)
AGMARKNET_API_KEY=your_agmarknet_api_key
NVIDIA_NIM_API_KEY=your_nvidia_nim_api_key

# JWT Secret (Optional)
JWT_SECRET=your_jwt_secret_key
```

### 5. Get Supabase Credentials

1. **Create Supabase Project:**
   - Go to [supabase.com](https://supabase.com)
   - Click "Start your project"
   - Sign in or create account
   - Click "New Project"
   - Enter project name: "krishi-setu"
   - Enter database password (save this securely)
   - Select region (choose closest to your users)
   - Click "Create new project"

2. **Get API Credentials:**
   - Wait for project to be created (2-3 minutes)
   - Go to Settings → API
   - Copy the following values:
     - **Project URL** → `SUPABASE_URL`
     - **Publishable** key (labeled "anon public" in older versions) → `SUPABASE_PUBLISHABLE_KEY`
     - **Secret** key (labeled "service_role" in older versions) → `SUPABASE_SECRET_KEY`

   **Note:** In the current Supabase dashboard, you'll find:
   - **Project URL** at the top of the API settings page
   - **Publishable key** under "Project API keys" section
   - **Secret key** under "Project API keys" section (may be hidden by default)

3. **Add to .env:**
   ```bash
   SUPABASE_URL=https://abcdefgh.supabase.co
   SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SECRET_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

**Important Security Notes:**
- Never commit `.env` file to version control
- Never share your secret key publicly
- Use different keys for development and production
- Rotate keys periodically in production

---

## Database Setup

### 6. Set Up Supabase Database

1. **Access SQL Editor:**
   - In Supabase dashboard, go to SQL Editor
   - Click "New Query"

2. **Run Database Schema:**
   - Open `utils/databaseSchema.sql` from your project
   - Copy the entire SQL content
   - Paste into Supabase SQL Editor
   - Click "Run" or press `Ctrl+Enter`

3. **Verify Table Creation:**
   - Go to Table Editor in Supabase dashboard
   - You should see these tables:
     - `users`
     - `crops`
     - `procurement_schedules`
     - `procurement_slots`
     - `procurement_bookings`

4. **Verify Indexes and Triggers:**
   - The SQL script automatically creates indexes and triggers
   - Check that indexes exist in Database → Indexes section
   - Check that triggers exist in Database → Triggers section

**Troubleshooting:**
- If tables don't appear, refresh the page
- Check for error messages in SQL Editor output
- Ensure you have the correct permissions in Supabase

### 6b. Set Up Marketplace Tables (Listings, Bids, Orders, Payments)

The base schema above does not include the marketplace tables. Run this
migration as well, once, after the base schema:

1. Open `utils/migration_add_marketplace_tables.sql` from your project
2. Copy the entire SQL content
3. Paste into a new query in the Supabase SQL Editor
4. Click "Run" or press `Ctrl+Enter`
5. Verify `listings`, `bids`, `orders`, and `payments` appear in Table Editor

Without this step, `/api/listings`, `/api/bids`, and `/api/orders` endpoints
will return `500` errors (the underlying tables don't exist).

### 6c. Set Up Ratings & Reviews Table

Run this migration to enable `POST /api/reviews` and its two `GET` endpoints:

1. Open `utils/migration_add_ratings_reviews.sql` from your project
2. Copy the entire SQL content
3. Paste into a new query in the Supabase SQL Editor
4. Click "Run" or press `Ctrl+Enter`
5. Verify `ratings_reviews` appears in Table Editor

Without this step, `/api/reviews` (and its two `GET` endpoints) will return
`500` errors (the underlying table doesn't exist); every other feature is
unaffected.

---

## Data Seeding

### 7. Seed Crops Data

Run the seed script to populate the crops table:

```bash
npm run seed
```

**Expected Output:**
```
Starting database seeding...
Seeding crops...
✓ Inserted crop: Wheat
✓ Inserted crop: Rice
✓ Inserted crop: Maize
✓ Inserted crop: Cotton
✓ Inserted crop: Sugarcane
✓ Inserted crop: Potato
✓ Inserted crop: Onion
✓ Inserted crop: Tomato
✓ Inserted crop: Mustard
✓ Inserted crop: Soybean

Note: To create an official user, you need to:
1. Create the user in Supabase Auth dashboard
2. Then insert the user record in the users table with role="official"

✓ Database seeding completed!
```

**Verify Seeded Data:**
- Go to Supabase Table Editor
- Open `crops` table
- You should see 10 crop records

**Troubleshooting:**
- If seeding fails, check your `.env` file has correct Supabase credentials
- Ensure database tables were created successfully
- Check for specific error messages in the output

---

## User Setup

### 8. Create Official User

You need to create an official user manually since they are not self-registerable.

#### Option A: Via Supabase Dashboard (Recommended)

1. **Create Auth User:**
   - Go to Authentication → Users in Supabase dashboard
   - Click "Add user"
   - Enter email: `official@krishisetu.com`
   - Enter password (save securely)
   - Click "Save"

2. **Get User UUID:**
   - In the users list, find your new user
   - Copy the UUID (it looks like: `123e4567-e89b-12d3-a456-426614174000`)

3. **Add User Record:**
   - Go to SQL Editor
   - Run this SQL (replace with your actual UUID):

```sql
INSERT INTO users (id, phone_number, name, role, location)
VALUES (
  '123e4567-e89b-12d3-a456-426614174000',
  '+919876543210',
  'Admin Official',
  'official',
  'New Delhi, Delhi'
);
```

#### Option B: Via SQL Only

```sql
-- First, create auth user (you'll need to do this via dashboard or API)
-- Then add user record:

INSERT INTO users (id, phone_number, name, role, location)
VALUES (
  'generated-uuid',
  '+919876543210',
  'Admin Official',
  'official',
  'New Delhi, Delhi'
);
```

**Verify User Creation:**
- Check `users` table in Table Editor
- You should see the official user record
- Role should be 'official'

---

## Server Startup

### 9. Start the Development Server

```bash
npm start
```

**Expected Output:**
```
Krishi Setu Backend running on port 3000
Environment: development
```

**Alternative Development Mode:**
```bash
npm run dev
```

Both commands run the same server in this project.

### 10. Verify Server is Running

Open a new terminal and test the health endpoint:

```bash
curl http://localhost:3000/api/health
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Krishi Setu Backend is running",
  "timestamp": "2026-09-03T11:25:26.299Z",
  "environment": "development"
}
```

**Or use the test script:**
```bash
node test-api.js
```

---

## Testing

### 11. Test the APIs

#### Basic Health Check
```bash
curl http://localhost:3000/api/health
```

#### Test Crops Endpoint
```bash
curl http://localhost:3000/api/crops
```

Should return the seeded crops list.

#### Test Database Connection
If Supabase is configured correctly, database endpoints should work. If not configured, you'll get 503 errors (this is expected behavior).

---

## Common Setup Issues

### Issue: "supabaseUrl is required"
**Cause:** Supabase credentials not set in `.env`
**Solution:**
- Ensure `.env` file exists in project root
- Check `SUPABASE_URL` is set correctly
- Restart server after updating `.env`

### Issue: "Failed to fetch crops"
**Cause:** Database tables not created or credentials incorrect
**Solution:**
- Verify database schema was run in Supabase
- Check Supabase credentials in `.env`
- Ensure Supabase project is active

### Issue: Port already in use
**Cause:** Another process using port 3000
**Solution:**
- Change PORT in `.env`: `PORT=3001`
- Or kill the process using port 3000

### Issue: npm install fails
**Cause:** Network issues or Node.js version
**Solution:**
- Check Node.js version: `node --version` (must be 18+)
- Clear npm cache: `npm cache clean --force`
- Try installing with `--force` flag

### Issue: "Module not found" errors
**Cause:** Dependencies not installed
**Solution:**
- Run `npm install` again
- Check `node_modules` folder exists
- Delete `node_modules` and `package-lock.json`, then reinstall

---

## Production Setup

### Additional Steps for Production

1. **Environment Variables:**
   ```bash
   NODE_ENV=production
   PORT=80 (or use reverse proxy)
   ```

2. **Security:**
   - Use strong JWT secrets
   - Enable HTTPS
   - Set up CORS properly
   - Implement rate limiting
   - Add request logging

3. **Database:**
   - Enable Row Level Security (RLS) in Supabase
   - Set up database backups
   - Configure connection pooling
   - Monitor database performance

4. **Server:**
   - Use process manager (PM2)
   - Set up monitoring
   - Configure log rotation
   - Implement health checks

5. **Domain:**
   - Configure custom domain
   - Set up SSL certificates
   - Configure DNS records

---

## Verification Checklist

Before proceeding with development, verify:

- [ ] Node.js 18+ installed
- [ ] All npm packages installed successfully
- [ ] `.env` file created with Supabase credentials
- [ ] Supabase project created and active
- [ ] Database schema executed successfully
- [ ] All 5 tables created in Supabase
- [ ] Crops data seeded successfully
- [ ] Official user created
- [ ] Server starts without errors
- [ ] Health endpoint returns success
- [ ] Crops endpoint returns data
- [ ] No 503 errors on database endpoints

---

## Next Steps

After successful setup:

1. **Test Authentication Flow:**
   - Implement OTP send/verify endpoints
   - Test user registration
   - Verify role-based access control

2. **Test Procurement Flow:**
   - Create schedule as official
   - View generated slots
   - Book slot as farmer
   - Update booking status as official

3. **Frontend Integration:**
   - Provide API documentation to frontend team
   - Set up CORS for frontend domain
   - Test API calls from frontend

4. **Additional Features:**
   - Implement marketplace listings
   - Add bidding system
   - Integrate external APIs
   - ~~Add AI chatbot~~ — done, see API_DOCUMENTATION.md

---

## Support

If you encounter issues not covered here:

1. Check the [README.md](README.md) for general information
2. Review [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for API details
3. Examine [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) for database structure
4. Check server logs for error messages
5. Verify all steps in this setup guide

---

## Uninstallation

To remove the project:

1. Stop the server (Ctrl+C)
2. Delete project directory
3. Delete Supabase project (if desired)
4. Remove environment variables from `.env`

**Note:** This will delete all data in Supabase if you delete the project.
