import { Router } from 'express';
import db from '../db/connection.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', (req, res) => {
  const items = db.prepare('SELECT * FROM menu_items ORDER BY category, name').all();
  res.json(items);
});

router.post('/', authMiddleware, requireRole('admin'), (req, res) => {
  const { name, description, price, category, available = 1 } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'name and price required' });

  const result = db
    .prepare('INSERT INTO menu_items (name, description, price, category, available) VALUES (?, ?, ?, ?, ?)')
    .run(name, description ?? null, price, category ?? null, available ? 1 : 0);

  const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(item);
});

router.put('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  const { name, description, price, category, available } = req.body;
  db.prepare(`
    UPDATE menu_items SET
      name = ?, description = ?, price = ?, category = ?, available = ?
    WHERE id = ?
  `).run(
    name ?? item.name,
    description !== undefined ? description : item.description,
    price ?? item.price,
    category !== undefined ? category : item.category,
    available !== undefined ? (available ? 1 : 0) : item.available,
    id
  );

  const updated = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id);
  res.json(updated);
});

router.delete('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
  res.status(204).end();
});

export default router;
