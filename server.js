require("dotenv").config();

const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

function getDbConfig() {
  const urlValue =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_CONNECTION_STRING;

  if (urlValue) {
    const parsed = new URL(urlValue);
    const isLocal = ["localhost", "127.0.0.1"].includes(parsed.hostname);

    return {
      connectionString: urlValue,
      ssl: parsed.protocol === "postgres:" || parsed.protocol === "postgresql:"
        ? (isLocal ? false : { rejectUnauthorized: false })
        : false
    };
  }

  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "postgres",
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false
  };
}

const dbConfig = getDbConfig();
let pool;

const transportEnabled =
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS &&
  process.env.NOTIFY_TO;

const transporter = transportEnabled
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  : null;

async function initDb() {
  pool = new Pool({
    ...dbConfig,
    max: 10
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chemicals (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      formula VARCHAR(120) NOT NULL DEFAULT '',
      category VARCHAR(120) NOT NULL DEFAULT '',
      unit VARCHAR(40) NOT NULL DEFAULT '',
      quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
      max_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
      low_stock_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
      hazard_info VARCHAR(255) NOT NULL,
      room_no VARCHAR(50) NOT NULL,
      expiry_date DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(40) NOT NULL DEFAULT 'staff',
      reset_code VARCHAR(20),
      reset_expires TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Lightweight migrations for existing databases.
  const alterStatements = [
    "ALTER TABLE chemicals ADD COLUMN IF NOT EXISTS formula VARCHAR(120) NOT NULL DEFAULT ''",
    "ALTER TABLE chemicals ADD COLUMN IF NOT EXISTS category VARCHAR(120) NOT NULL DEFAULT ''",
    "ALTER TABLE chemicals ADD COLUMN IF NOT EXISTS unit VARCHAR(40) NOT NULL DEFAULT ''",
    "ALTER TABLE chemicals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
    "ALTER TABLE chemicals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code VARCHAR(20)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ",
    "ALTER TABLE logs ADD COLUMN IF NOT EXISTS purpose VARCHAR(160)",
    "ALTER TABLE logs ADD COLUMN IF NOT EXISTS class_name VARCHAR(120)"
  ];
  for (const stmt of alterStatements) {
    try {
      await pool.query(stmt);
    } catch (_) {
      // Ignore if column already exists or permission denies.
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS logs (
      id BIGSERIAL PRIMARY KEY,
      chemical_id BIGINT NOT NULL REFERENCES chemicals(id) ON DELETE CASCADE,
      action VARCHAR(20) NOT NULL CHECK (action IN ('use', 'refill')),
      amount NUMERIC(12,2) NOT NULL,
      date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "user" VARCHAR(120) NOT NULL,
      purpose VARCHAR(160),
      class_name VARCHAR(120)
    )
  `);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const check = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(check, "hex"));
}

function validateChemical(body) {
  const quantity = Number(body.quantity);
  const maxQuantity = Number(body.max_quantity);
  const lowStockQuantity = Number(body.low_stock_quantity);

  if (!body.name || !body.room_no || !body.hazard_info) return "Missing required fields";
  if ([quantity, maxQuantity, lowStockQuantity].some((n) => Number.isNaN(n) || n < 0)) return "Quantity values must be non-negative numbers";
  if (quantity > maxQuantity) return "Current quantity cannot be greater than max quantity";

  return null;
}

async function isDuplicateChemicalName(name, excludeId = null) {
  const clean = String(name || "").trim().toLowerCase();
  if (!clean) return false;
  const params = excludeId ? [clean, Number(excludeId)] : [clean];
  const sql = excludeId
    ? "SELECT id FROM chemicals WHERE LOWER(name) = $1 AND id <> $2 LIMIT 1"
    : "SELECT id FROM chemicals WHERE LOWER(name) = $1 LIMIT 1";
  const { rows } = await pool.query(sql, params);
  return rows.length > 0;
}

async function sendLowStockEmail(chemical) {
  if (!transporter) return;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.NOTIFY_TO,
    subject: `Low stock alert: ${chemical.name}`,
    text: `${chemical.name} is low on stock.\nCurrent: ${chemical.quantity}\nLow threshold: ${chemical.low_stock_quantity}\nRoom: ${chemical.room_no}`
  });
}

app.get("/", (_, res) => res.sendFile(path.join(__dirname, "public", "home.html")));
app.get("/inventory", (_, res) => res.sendFile(path.join(__dirname, "public", "inventory.html")));
app.get("/logs-records", (_, res) => res.sendFile(path.join(__dirname, "public", "logs.html")));
app.get("/about", (_, res) => res.sendFile(path.join(__dirname, "public", "about.html")));

app.post("/api/signup", async (req, res) => {
  const name = (req.body.name || "").trim();
  const email = (req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!name || !email || !password) return res.status(400).json({ error: "Name, email, and password are required" });

  try {
    const passwordHash = hashPassword(password);
    const { rows } = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id",
      [name, email, passwordHash, "staff"]
    );
    return res.status(201).json({ ok: true, user: { id: rows[0].id, name, email, role: "staff" } });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "Email already registered" });
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  try {
    const { rows } = await pool.query("SELECT id, name, email, password_hash, role FROM users WHERE email = $1", [email]);
    if (!rows.length) return res.status(401).json({ error: "Invalid credentials" });
    const user = rows[0];
    if (!verifyPassword(password, user.password_hash)) return res.status(401).json({ error: "Invalid credentials" });
    return res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/forgot-password", async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const { rows } = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (!rows.length) return res.json({ ok: true, code: null });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await pool.query("UPDATE users SET reset_code = $1, reset_expires = $2 WHERE email = $3", [code, expires, email]);

    return res.json({ ok: true, code });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/reset-password", async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const code = String(req.body.code || "").trim();
  const newPassword = String(req.body.new_password || "");
  if (!email || !code || !newPassword) return res.status(400).json({ error: "Email, code, and new password are required" });

  try {
    const { rows } = await pool.query("SELECT id, reset_code, reset_expires FROM users WHERE email = $1", [email]);
    if (!rows.length) return res.status(400).json({ error: "Invalid code or email" });
    const user = rows[0];
    if (!user.reset_code || user.reset_code !== code) return res.status(400).json({ error: "Invalid code or email" });
    if (user.reset_expires && new Date(user.reset_expires).getTime() < Date.now()) {
      return res.status(400).json({ error: "Reset code expired" });
    }

    const passwordHash = hashPassword(newPassword);
    await pool.query(
      "UPDATE users SET password_hash = $1, reset_code = NULL, reset_expires = NULL WHERE id = $2",
      [passwordHash, user.id]
    );
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/chemicals", async (_, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, formula, category, unit, quantity, max_quantity, low_stock_quantity, hazard_info, room_no, expiry_date
      FROM chemicals
      ORDER BY name ASC
    `);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/chemicals", async (req, res) => {
  const error = validateChemical(req.body);
  if (error) return res.status(400).json({ error });

  try {
    if (await isDuplicateChemicalName(req.body.name)) {
      return res.status(400).json({ error: "Chemical name already exists" });
    }
    const { name, formula, category, unit, quantity, max_quantity, low_stock_quantity, hazard_info, room_no, expiry_date } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO chemicals (name, formula, category, unit, quantity, max_quantity, low_stock_quantity, hazard_info, room_no, expiry_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        name,
        formula || "",
        category || "",
        unit || "",
        Number(quantity),
        Number(max_quantity),
        Number(low_stock_quantity),
        hazard_info,
        room_no,
        expiry_date || null
      ]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put("/api/chemicals/:id", async (req, res) => {
  const error = validateChemical(req.body);
  if (error) return res.status(400).json({ error });

  try {
    if (await isDuplicateChemicalName(req.body.name, req.params.id)) {
      return res.status(400).json({ error: "Chemical name already exists" });
    }
    const { name, formula, category, unit, quantity, max_quantity, low_stock_quantity, hazard_info, room_no, expiry_date } = req.body;
    const { rows } = await pool.query(
      `UPDATE chemicals
       SET name = $1, formula = $2, category = $3, unit = $4, quantity = $5, max_quantity = $6, low_stock_quantity = $7, hazard_info = $8, room_no = $9, expiry_date = $10, updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [
        name,
        formula || "",
        category || "",
        unit || "",
        Number(quantity),
        Number(max_quantity),
        Number(low_stock_quantity),
        hazard_info,
        room_no,
        expiry_date || null,
        Number(req.params.id)
      ]
    );
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/api/chemicals/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM chemicals WHERE id = $1", [Number(req.params.id)]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/chemicals/:id/transaction", async (req, res) => {
  const id = Number(req.params.id);
  const amount = Number(req.body.amount);
  const action = req.body.action;
  const user = (req.body.user || "").trim();
  const purpose = (req.body.purpose || "").trim();
  const className = (req.body.class_name || "").trim();

  if (!["use", "refill"].includes(action)) return res.status(400).json({ error: "Invalid action" });
  if (!user) return res.status(400).json({ error: "User is required" });
  if (action === "use" && !purpose) return res.status(400).json({ error: "Purpose is required for usage" });
  if (action === "use" && !className) return res.status(400).json({ error: "Class is required for usage" });
  if (Number.isNaN(amount) || amount <= 0) return res.status(400).json({ error: "Amount must be greater than zero" });

  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");

    const { rows: chemRows } = await connection.query("SELECT * FROM chemicals WHERE id = $1 FOR UPDATE", [id]);
    if (!chemRows.length) {
      await connection.query("ROLLBACK");
      return res.status(404).json({ error: "Chemical not found" });
    }

    const chemical = chemRows[0];
    let newQuantity = Number(chemical.quantity);

    if (action === "use") {
      newQuantity -= amount;
      if (newQuantity < 0) {
        await connection.query("ROLLBACK");
        return res.status(400).json({ error: "Not enough stock for this usage amount" });
      }
    } else {
      newQuantity += amount;
      if (newQuantity > Number(chemical.max_quantity)) {
        await connection.query("ROLLBACK");
        return res.status(400).json({ error: "Refill amount exceeds max quantity" });
      }
    }

    await connection.query("UPDATE chemicals SET quantity = $1, updated_at = NOW() WHERE id = $2", [newQuantity, id]);
    await connection.query(
      "INSERT INTO logs (chemical_id, action, amount, \"user\", purpose, class_name) VALUES ($1,$2,$3,$4,$5,$6)",
      [id, action, amount, user, purpose || null, className || null]
    );
    await connection.query("COMMIT");

    const { rows: updatedRows } = await pool.query("SELECT * FROM chemicals WHERE id = $1", [id]);
    const updated = updatedRows[0];
    const isLowStock = Number(updated.quantity) <= Number(updated.low_stock_quantity);

    if (isLowStock) {
      await sendLowStockEmail(updated).catch(() => null);
    }

    return res.json({ ok: true, chemical: updated, isLowStock });
  } catch (err) {
    await connection.query("ROLLBACK");
    return res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

app.get("/api/logs", async (_, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT l.id, l.chemical_id, l.date, c.name AS chemical_name, l.action, l.amount, l."user", l.purpose, l.class_name, c.room_no, c.unit
      FROM logs l
      JOIN chemicals c ON c.id = l.chemical_id
      ORDER BY l.date DESC
    `);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/reports/low-stock", async (_, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT CURRENT_DATE AS report_date, name AS chemical, quantity, unit
      FROM chemicals
      WHERE quantity <= low_stock_quantity
      ORDER BY name ASC
    `);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

initDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
  })
  .catch((err) => {
    const details = err
      ? {
          message: err.message,
          code: err.code,
          errno: err.errno,
          sqlState: err.sqlState,
          sql: err.sql
        }
      : {};
    console.error("DB init failed:", details);
    console.error("DB config:", {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database
    });
    process.exit(1);
  });
