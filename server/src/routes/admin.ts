import { Router } from 'express';
import { pool } from '../lib/pool';

export const adminRouter = Router();

function mapOrder (r: Record<string, unknown>) {
  return {
    id: r.id,
    customerName: r.customer_name,
    address: r.address,
    phone: r.phone,
    details: r.details,
    items: r.items,
    orderTotal: r.order_total != null ? Number(r.order_total) : null,
    paymentStatus: r.payment_status,
    status: r.status,
    date: r.date_str,
    timestamp: r.ts,
    completionDate: r.completion_date,
    completedTimestamp: r.completed_ts
  };
}

adminRouter.get('/dashboard/stats', async (_req, res) => {
  const pending = await pool.query(`SELECT COUNT(*)::int AS c FROM orders WHERE status = 'pending'`);
  const completed = await pool.query(`SELECT COUNT(*)::int AS c FROM orders WHERE status = 'completed'`);
  const completedVal = await pool.query(
    `SELECT COALESCE(SUM(order_total), 0)::numeric AS s FROM orders WHERE status = 'completed'`
  );
  const exp = await pool.query(`SELECT COALESCE(SUM(amount), 0)::numeric AS s FROM expenses`);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const att = await pool.query(
    `SELECT COUNT(*)::int AS c FROM attendance WHERE ts >= $1`,
    [startOfMonth.getTime()]
  );
  res.json({
    pendingCount: pending.rows[0].c,
    completedCount: completed.rows[0].c,
    completedOrdersValue: Number(completedVal.rows[0].s),
    totalExpenses: Number(exp.rows[0].s),
    attendanceThisMonth: att.rows[0].c
  });
});

adminRouter.get('/orders', async (req, res) => {
  const status = req.query.status as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params: unknown[] = [];
  let i = 1;
  if (status !== undefined && status !== '') {
    sql += ` AND status = $${i}`;
    params.push(status);
    i++;
  }
  const { rows } = await pool.query(sql + ' ORDER BY id DESC', params);
  let list = rows.map(mapOrder);
  if (from !== undefined || to !== undefined) {
    const fromT = from !== undefined ? new Date(from).getTime() : 0;
    const toT = to !== undefined ? new Date(to).getTime() + 86399999 : Infinity;
    list = list.filter(o => {
      const t = (o.completedTimestamp as number) ?? (o.timestamp as number) ?? 0;
      return t >= fromT && t <= toT;
    });
  }
  res.json(list);
});

adminRouter.get('/orders/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
  const row = rows[0];
  if (row === undefined) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(mapOrder(row));
});

adminRouter.post('/orders', async (req, res) => {
  const b = req.body ?? {};
  const customerName = String(b.customerName ?? '');
  const address = String(b.address ?? '');
  const phone = String(b.phone ?? '');
  const details = String(b.details ?? '');
  const items = b.items;
  const orderTotal = b.orderTotal != null ? Number(b.orderTotal) : null;
  const paymentStatus = String(b.paymentStatus ?? 'Not Paid');
  const dateStr = String(b.date ?? new Date().toLocaleDateString());
  const ts = b.timestamp != null ? Number(b.timestamp) : Date.now();

  const { rows } = await pool.query(
    `INSERT INTO orders (customer_name, address, phone, details, items, order_total, payment_status, status, date_str, ts)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,'pending',$8,$9) RETURNING *`,
    [customerName, address, phone, details, JSON.stringify(items ?? []), orderTotal, paymentStatus, dateStr, ts]
  );
  res.status(201).json(mapOrder(rows[0]));
});

adminRouter.get('/expenses', async (req, res) => {
  const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : undefined;
  let sql = 'SELECT id, note, category, amount, date_str AS date, iso_month AS "isoMonth", ts AS timestamp FROM expenses ORDER BY id DESC';
  const params: unknown[] = [];
  if (limit !== undefined && !Number.isNaN(limit)) {
    sql += ' LIMIT $1';
    params.push(limit);
  }
  const { rows } = await pool.query(sql, params);
  res.json(rows.map(r => ({ ...r, amount: Number(r.amount) })));
});

adminRouter.post('/expenses', async (req, res) => {
  const b = req.body ?? {};
  const note = String(b.note ?? b.category ?? '');
  const category = String(b.category ?? '');
  const amount = Number(b.amount);
  const dateStr = String(b.date ?? new Date().toLocaleDateString());
  const isoMonth = String(b.isoMonth ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const ts = b.timestamp != null ? Number(b.timestamp) : Date.now();

  const { rows } = await pool.query(
    `INSERT INTO expenses (note, category, amount, date_str, iso_month, ts) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [note, category, amount, dateStr, isoMonth, ts]
  );
  if (category !== '') {
    await pool.query('INSERT INTO expense_categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [category]);
  }
  const r = rows[0];
  res.status(201).json({
    id: r.id,
    note: r.note,
    category: r.category,
    amount: Number(r.amount),
    date: r.date_str,
    isoMonth: r.iso_month,
    timestamp: r.ts
  });
});

adminRouter.get('/stock', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT item_size AS "itemSize", quantity FROM stock ORDER BY item_size'
  );
  res.json(rows);
});

adminRouter.put('/stock', async (req, res) => {
  const items = req.body?.items as Array<{ itemSize: string; quantity: number }> | undefined;
  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'items array required' });
    return;
  }
  for (const it of items) {
    const q = parseInt(String(it.quantity), 10);
    if (!Number.isNaN(q) && q >= 0) {
      await pool.query('UPDATE stock SET quantity = $1 WHERE item_size = $2', [q, it.itemSize]);
    }
  }
  res.json({ ok: true });
});

adminRouter.get('/prices', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT item_name AS "itemName", price::float8 AS price FROM prices ORDER BY item_name'
  );
  res.json(rows);
});

adminRouter.put('/prices', async (req, res) => {
  const prices = req.body?.prices as Array<{ itemName: string; price: number }> | undefined;
  if (!Array.isArray(prices)) {
    res.status(400).json({ error: 'prices array required' });
    return;
  }
  for (const p of prices) {
    const pr = parseFloat(String(p.price));
    if (!Number.isNaN(pr) && pr >= 0) {
      await pool.query('UPDATE prices SET price = $1 WHERE item_name = $2', [pr, p.itemName]);
    }
  }
  res.json({ ok: true });
});

adminRouter.get('/customers', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, name, phone, address FROM customers ORDER BY name');
  res.json(rows);
});

adminRouter.post('/customers', async (req, res) => {
  const { name, phone, address } = req.body ?? {};
  const { rows } = await pool.query(
    'INSERT INTO customers (name, phone, address) VALUES ($1,$2,$3) RETURNING *',
    [String(name ?? ''), String(phone ?? ''), String(address ?? '')]
  );
  res.status(201).json(rows[0]);
});

adminRouter.put('/customers/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, phone, address } = req.body ?? {};
  await pool.query('UPDATE customers SET name = $1, phone = $2, address = $3 WHERE id = $4', [
    String(name ?? ''),
    String(phone ?? ''),
    String(address ?? ''),
    id
  ]);
  res.json({ ok: true });
});

adminRouter.delete('/customers/:id', async (req, res) => {
  await pool.query('DELETE FROM customers WHERE id = $1', [parseInt(req.params.id, 10)]);
  res.json({ ok: true });
});

adminRouter.get('/expense-categories', async (_req, res) => {
  const { rows } = await pool.query('SELECT name FROM expense_categories ORDER BY name');
  res.json(rows.map(r => r.name));
});

adminRouter.post('/products', async (req, res) => {
  const name = (req.body?.name as string | undefined)?.trim();
  const price = parseFloat(String(req.body?.price ?? ''));
  if (name === undefined || name === '' || Number.isNaN(price)) {
    res.status(400).json({ error: 'name and valid price required' });
    return;
  }
  try {
    await pool.query('INSERT INTO stock (item_size, quantity) VALUES ($1, 0)', [name]);
    await pool.query('INSERT INTO prices (item_name, price) VALUES ($1, $2)', [name, price]);
    res.status(201).json({ ok: true });
  } catch {
    res.status(400).json({ error: 'Product may already exist' });
  }
});

adminRouter.delete('/products/:itemName', async (req, res) => {
  const itemName = decodeURIComponent(req.params.itemName);
  await pool.query('DELETE FROM stock WHERE item_size = $1', [itemName]);
  await pool.query('DELETE FROM prices WHERE item_name = $1', [itemName]);
  res.json({ ok: true });
});

adminRouter.get('/analytics/item-sales', async (req, res) => {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const fromT = from !== undefined ? new Date(from).getTime() : 0;
  const toT = to !== undefined ? new Date(to).getTime() + 86399999 : Infinity;
  const { rows } = await pool.query(
    `SELECT items, completed_ts, ts FROM orders WHERE status = 'completed'`
  );
  const itemSales: Record<string, number> = {};
  for (const row of rows) {
    const t = (row.completed_ts as number) ?? (row.ts as number) ?? 0;
    if (t < fromT || t > toT) continue;
    const items = row.items as Array<{ name: string; quantity: number }> | null;
    if (items === null || !Array.isArray(items)) continue;
    for (const item of items) {
      itemSales[item.name] = (itemSales[item.name] ?? 0) + item.quantity;
    }
  }
  res.json({ labels: Object.keys(itemSales), data: Object.values(itemSales) });
});

adminRouter.get('/attendance/report', async (req, res) => {
  const fromStr = req.query.from as string | undefined;
  const toStr = req.query.to as string | undefined;
  const fromT = fromStr !== undefined ? new Date(fromStr).getTime() : 0;
  const toT = toStr !== undefined ? new Date(toStr).getTime() + 86399999 : Infinity;
  const { rows } = await pool.query(
    'SELECT employee_name, ts FROM attendance'
  );
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const t = (row.ts as number) ?? 0;
    if (t < fromT || t > toT) continue;
    const name = row.employee_name as string;
    counts[name] = (counts[name] ?? 0) + 1;
  }
  res.json(
    Object.keys(counts)
      .sort()
      .map(name => ({ name, daysPresent: counts[name] }))
  );
});
