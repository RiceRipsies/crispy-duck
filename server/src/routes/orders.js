import { Router } from 'express';
import db from '../db/connection.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

function getOrderWithItems(id) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return null;
  order.items = db.prepare(`
    SELECT oi.*, mi.name, mi.category
    FROM order_items oi
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    WHERE oi.order_id = ?
  `).all(id);
  return order;
}

router.get('/', authMiddleware, requireRole('kitchen', 'admin', 'cashier'), (req, res) => {
  const { status } = req.query;
  let query = 'SELECT * FROM orders';
  const params = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  // cashiers only see their own orders
  if (req.user.role === 'cashier') {
    query += status ? ' AND created_by = ?' : ' WHERE created_by = ?';
    params.push(req.user.sub);
  }

  query += ' ORDER BY created_at DESC';
  const orders = db.prepare(query).all(...params);

  const ordersWithItems = orders.map(o => getOrderWithItems(o.id));
  res.json(ordersWithItems);
});

router.get('/:id', authMiddleware, (req, res) => {
  const order = getOrderWithItems(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  res.json(order);
});

router.post('/', authMiddleware, requireRole('cashier', 'admin'), (req, res) => {
  const { items, note } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array required' });
  }

  const createOrder = db.transaction(() => {
    const result = db
      .prepare('INSERT INTO orders (note, created_by) VALUES (?, ?)')
      .run(note ?? null, req.user.sub);

    const insertItem = db.prepare(
      'INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price) VALUES (?, ?, ?, ?)'
    );

    for (const item of items) {
      const menuItem = db.prepare('SELECT * FROM menu_items WHERE id = ? AND available = 1').get(item.menuItemId);
      if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found or unavailable`);
      insertItem.run(result.lastInsertRowid, item.menuItemId, item.quantity ?? 1, menuItem.price);
    }

    return getOrderWithItems(result.lastInsertRowid);
  });

  try {
    const order = createOrder();
    req.io.emit('order:new', order);
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const STATUS_TRANSITIONS = {
  ordered: ['in_progress'],
  in_progress: ['ready'],
  ready: ['done'],
};

router.patch('/:id/status', authMiddleware, requireRole('kitchen', 'admin'), (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });

  const allowed = STATUS_TRANSITIONS[order.status];
  if (!allowed?.includes(status)) {
    return res.status(400).json({ error: `Cannot transition from ${order.status} to ${status}` });
  }

  db.prepare('UPDATE orders SET status = ?, updated_at = unixepoch() WHERE id = ?').run(status, order.id);
  const updated = getOrderWithItems(order.id);
  req.io.emit('order:updated', updated);
  res.json(updated);
});

export default router;
