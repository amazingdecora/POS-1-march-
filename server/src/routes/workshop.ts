import { Router } from 'express';
import { pool } from '../lib/pool';
import { parseAndDeductStock } from '../lib/stockDeduct';

export const workshopRouter = Router();

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

workshopRouter.get('/orders/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
  const row = rows[0];
  if (row === undefined) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(mapOrder(row));
});

/** Pending orders (newest first) */
workshopRouter.get('/orders', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM orders WHERE status = 'pending' ORDER BY id DESC`
  );
  res.json(rows.map(mapOrder));
});

workshopRouter.get('/stock', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT item_size AS "itemSize", quantity FROM stock ORDER BY item_size'
  );
  res.json(rows);
});

workshopRouter.post('/orders/:id/complete', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
    const order = rows[0];
    if (order === undefined) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const getStock = async () => {
      const r = await client.query<{ item_size: string; quantity: number }>(
        'SELECT item_size, quantity FROM stock'
      );
      return r.rows;
    };
    const updateQty = async (itemSize: string, newQty: number) => {
      await client.query('UPDATE stock SET quantity = $1 WHERE item_size = $2', [newQty, itemSize]);
    };

    const items = order.items as Array<{ name: string; quantity: number }> | null;
    if (items !== null && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const r = await client.query('SELECT quantity FROM stock WHERE item_size = $1', [item.name]);
        if (r.rows[0] !== undefined) {
          const newQty = Math.max(0, r.rows[0].quantity - item.quantity);
          await updateQty(item.name, newQty);
        }
      }
    } else {
      await parseAndDeductStock(String(order.details ?? ''), getStock, updateQty);
    }

    await client.query(
      `UPDATE orders SET status = 'completed', completion_date = $1, completed_ts = $2 WHERE id = $3`,
      [new Date().toLocaleDateString(), Date.now(), id]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Failed to complete order' });
  } finally {
    client.release();
  }
});

workshopRouter.post('/production', async (req, res) => {
  const quantities = req.body?.quantities as Record<string, number> | undefined;
  if (quantities === undefined || typeof quantities !== 'object') {
    res.status(400).json({ error: 'quantities object required' });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [size, raw] of Object.entries(quantities)) {
      const qty = parseInt(String(raw), 10);
      if (Number.isNaN(qty) || qty <= 0) continue;
      const r = await client.query('SELECT quantity FROM stock WHERE item_size = $1', [size]);
      if (r.rows[0] !== undefined) {
        await client.query('UPDATE stock SET quantity = quantity + $1 WHERE item_size = $2', [qty, size]);
      }
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Production update failed' });
  } finally {
    client.release();
  }
});

workshopRouter.get('/employees', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, name FROM employees ORDER BY name');
  res.json(rows);
});

workshopRouter.get('/attendance', async (req, res) => {
  const dateStr = (req.query.date as string) ?? new Date().toLocaleDateString();
  const { rows } = await pool.query(
    'SELECT id, date_str AS date, employee_name AS "employeeName", ts AS timestamp FROM attendance WHERE date_str = $1',
    [dateStr]
  );
  res.json(rows);
});

workshopRouter.post('/attendance', async (req, res) => {
  const dateStr = (req.body?.dateStr as string) ?? new Date().toLocaleDateString();
  const presentNames = req.body?.presentNames as string[] | undefined;
  if (!Array.isArray(presentNames)) {
    res.status(400).json({ error: 'presentNames array required' });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM attendance WHERE date_str = $1', [dateStr]);
    const now = Date.now();
    for (const name of presentNames) {
      if (typeof name === 'string' && name.trim() !== '') {
        await client.query(
          `INSERT INTO attendance (date_str, employee_name, ts) VALUES ($1, $2, $3)`,
          [dateStr, name.trim(), now]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Attendance save failed' });
  } finally {
    client.release();
  }
});

workshopRouter.post('/employees', async (req, res) => {
  const name = (req.body?.name as string | undefined)?.trim();
  if (name === undefined || name === '') {
    res.status(400).json({ error: 'name required' });
    return;
  }
  try {
    await pool.query('INSERT INTO employees (name) VALUES ($1)', [name]);
    res.status(201).json({ ok: true });
  } catch {
    res.status(400).json({ error: 'Employee may already exist' });
  }
});
