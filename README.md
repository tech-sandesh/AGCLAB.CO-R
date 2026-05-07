# AGC LAB.CO

This project made with:
- Node.js + Express
- Supabase PostgreSQL
- Plain HTML + CSS + JS

## Setup
1. Open terminal in project folder:
   `cd C:\Users\Sande\OneDrive\Desktop\LAB\AGC LAB.CO R`
2. Install packages:
   `npm install`
3. Copy env file:
   - copy `.env.example` to `.env`
4. In Supabase, open your project and copy the Postgres connection string.
5. Set `DATABASE_URL` in `.env` to the Supabase connection string.
6. Start server:
   `npm run dev`
7. Open browser:
   `http://localhost:3000`

Important:
- This app now loads environment variables from a local `.env` file using `dotenv`.
- If `DATABASE_URL` is missing, the server will fall back to `localhost:5432`.

## Supabase Notes
1. Use the Supabase Postgres connection string, not the API URL.
2. The app auto-creates its tables on startup.
3. If Supabase requires SSL, keep the URL in `DATABASE_URL`; the server enables SSL automatically for hosted Postgres URLs.

## Migration From Old MySQL Data
1. Old MySQL dump file is still in the repo as `lab.sql`.
2. The app schema has been converted to PostgreSQL in code.
3. Existing MySQL data needs to be exported/imported into Supabase separately if you want to keep old records.

## Login / Signup
- Create an account from the home page (email + password).
- Forgot password shows a reset code on screen (dev mode).

## Main Pages
- `/` -> Home/Login
- `/inventory` -> Inventory dashboard
- `/logs-records` -> Logs + low stock report
- `/about` -> About page

## API Routes
- `POST /api/signup`
- `POST /api/login`
- `POST /api/forgot-password`
- `POST /api/reset-password`
- `GET /api/chemicals`
- `POST /api/chemicals`
- `PUT /api/chemicals/:id`
- `DELETE /api/chemicals/:id`
- `POST /api/chemicals/:id/transaction`
- `GET /api/logs`
- `GET /api/reports/low-stock`
