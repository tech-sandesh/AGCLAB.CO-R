# AGC LAB.CO

This project made with:
- Node.js + Express
- MySQL
- Plain HTML + CSS + JS

## Setup
1. Open terminal in project folder:
   `cd C:\Users\Sande\OneDrive\Desktop\LAB\AGC LAB.CO`
2. Install packages:
   `npm install`
3. Copy env file:
   - copy `.env.example` to `.env`
4. Update DB values in `.env` if needed.
5. Start the database (XAMPP):
   - Open **phpMyAdmin** and create a database named `lab`
6. Start server:
   `npm run dev`
7. Open browser:
   `http://localhost:3000`

## Deploy On Railway
1. Push this repo to GitHub.
2. Create a new Railway project and connect the GitHub repo.
3. Add a MySQL database plugin in Railway.
4. Set environment variables in Railway:
   - `DATABASE_URL` (preferred) or `MYSQL_URL` from the Railway MySQL plugin.
   - If you prefer manual vars, set `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`.
5. Deploy. Railway will run `npm start` automatically.

Notes:
- The app listens on `process.env.PORT`, which Railway provides.
- Database creation is attempted, but if the provider blocks it the app will still continue using the existing database.

## Import Existing Database (XAMPP)
You can import a `.sql` file into MySQL using either method below.

### Option A: phpMyAdmin (easiest)
1. Open `http://localhost/phpmyadmin`.
2. Select the database in the left sidebar.
3. Click the **Import** tab.
4. Choose Sql file inside project directory `.sql` file and click **Go**.

### Option B: Command line
1. Open **XAMPP Shell** or Command Prompt.
2. Run:
   ```
   mysql -u root -p lab < "C:\path\to\your\file.sql"
   ```
   If root has no password, just press Enter when asked.

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
