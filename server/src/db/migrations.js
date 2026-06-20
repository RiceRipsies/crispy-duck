import db from './connection.js';
import bcrypt from 'bcrypt';

export function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL CHECK(role IN ('cashier','kitchen','admin')),
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT,
      price       INTEGER NOT NULL,
      category    TEXT,
      available   INTEGER NOT NULL DEFAULT 1,
      created_at  INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS orders (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      status     TEXT NOT NULL DEFAULT 'ordered'
                   CHECK(status IN ('ordered','in_progress','ready','done')),
      note       TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
      quantity     INTEGER NOT NULL DEFAULT 1,
      unit_price   INTEGER NOT NULL
    );
  `);

  const adminExists = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare("INSERT INTO users (username, password, role) VALUES ('admin', ?, 'admin')").run(hash);
    console.log('Seeded default admin user: admin / admin123');
  }

  const menuEmpty = db.prepare('SELECT COUNT(*) as count FROM menu_items').get();
  if (menuEmpty.count === 0) {
    const insertItem = db.prepare(
      'INSERT INTO menu_items (name, description, price, category) VALUES (?, ?, ?, ?)'
    );
    const seedItems = [
      ['Margherita', 'Tomato, mozzarella, basil', 1200, 'pizza'],
      ['Pepperoni', 'Tomato, mozzarella, pepperoni', 1400, 'pizza'],
      ['BBQ Chicken', 'BBQ sauce, chicken, red onion', 1500, 'pizza'],
      ['Four Cheese', 'Mozzarella, gorgonzola, gouda, parmesan', 1450, 'pizza'],
      ['Coca-Cola', '0.5L', 300, 'drink'],
      ['Sparkling Water', '0.5L', 250, 'drink'],
      ['Garlic Bread', 'With herb butter', 450, 'side'],
    ];
    for (const item of seedItems) insertItem.run(...item);
    console.log('Seeded sample menu items');
  }
}
