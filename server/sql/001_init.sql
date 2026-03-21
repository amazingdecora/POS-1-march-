-- Amazing Decora POS schema

CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock (
  item_size TEXT PRIMARY KEY,
  quantity INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS prices (
  item_name TEXT PRIMARY KEY,
  price NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  details TEXT,
  items JSONB,
  order_total NUMERIC(12,2),
  payment_status TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  date_str TEXT,
  ts BIGINT,
  completion_date TEXT,
  completed_ts BIGINT
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  note TEXT,
  category TEXT,
  amount NUMERIC(12,2) NOT NULL,
  date_str TEXT,
  iso_month TEXT,
  ts BIGINT
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT
);

CREATE TABLE IF NOT EXISTS expense_categories (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  date_str TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  ts BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_ts ON orders(ts);
CREATE INDEX IF NOT EXISTS idx_expenses_ts ON expenses(ts);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date_str);
