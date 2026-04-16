const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
const SQLITE_DB_PATH = path.join(__dirname, 'homekart.sqlite');

let dbReady = false;
let sqliteDb = null;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required in environment variables');
}

const initialProducts = [
  { name: 'Aurora Lounge Chair', price: 7499, category: 'furniture' },
  { name: 'Nordic Oak Coffee Table', price: 6499, category: 'furniture' },
  { name: 'Linen Blend Cushion Set', price: 1299, category: 'decor' },
  { name: 'Stoneware Vase Duo', price: 1599, category: 'decor' },
  { name: 'Smart Air Fryer 5L', price: 5999, category: 'kitchen' },
  { name: 'Stainless Cookware Set', price: 4499, category: 'kitchen' },
  { name: 'Cloud Comfort Duvet', price: 3499, category: 'bedroom' },
  { name: 'Bamboo Storage Nightstand', price: 2899, category: 'bedroom' }
];

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

function sqliteRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function sqliteGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function sqliteAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function seedInitialProductsSqlite() {
  const row = await sqliteGet('SELECT COUNT(*) AS count FROM products');
  if (row && row.count > 0) return;

  for (const product of initialProducts) {
    await sqliteRun(
      'INSERT INTO products (id, name, price, category) VALUES (?, ?, ?, ?)',
      [crypto.randomUUID(), product.name, product.price, product.category]
    );
  }

  console.log('Seeded initial product catalog (SQLite).');
}

async function initSqlite() {
  if (!sqliteDb) {
    sqliteDb = await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(SQLITE_DB_PATH, (err) => {
        if (err) return reject(err);
        resolve(db);
      });
    });
  }

  await sqliteRun('PRAGMA foreign_keys = ON');

  await sqliteRun(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )
  `);

  await sqliteRun(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      category TEXT NOT NULL
    )
  `);

  await sqliteRun(`
    CREATE TABLE IF NOT EXISTS cart_items (
      user_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      PRIMARY KEY (user_id, product_id)
    )
  `);

  await sqliteRun(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      items_json TEXT NOT NULL,
      total_amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  await sqliteRun(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      email TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    )
  `);

  await sqliteRun(`
    DELETE FROM products
    WHERE rowid NOT IN (
      SELECT MIN(rowid)
      FROM products
      GROUP BY name, price, category
    )
  `);

  await seedInitialProductsSqlite();
}

async function connectDatabase() {
  try {
    await initSqlite();
    dbReady = true;
    console.log(`Connected to SQLite at ${SQLITE_DB_PATH}`);
  } catch (err) {
    console.error('Database initialization error:', err.message);
    process.exit(1);
  }
}

const ensureDatabaseReady = (req, res, next) => {
  if (!dbReady) {
    return res.status(503).json({ message: 'Database is unavailable. Please try again in a moment.' });
  }
  next();
};

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const data = jwt.verify(token, JWT_SECRET);
    req.user = data;
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

app.post('/register', ensureDatabaseReady, asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }

  const hash = await bcrypt.hash(password, 10);

  const existingUser = await sqliteGet('SELECT id FROM users WHERE email = ?', [email]);
  if (existingUser) {
    return res.status(409).json({ message: 'Email already registered' });
  }

  await sqliteRun(
    'INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)',
    [crypto.randomUUID(), name, email, hash]
  );

  return res.json({ message: 'Registered' });
}));

app.post('/login', ensureDatabaseReady, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = await sqliteGet('SELECT id, email, password FROM users WHERE email = ?', [email]);

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = jwt.sign({ id: user.id }, JWT_SECRET);

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name || 'User',
      email: user.email
    }
  });
}));

app.get('/me', ensureDatabaseReady, auth, asyncHandler(async (req, res) => {
  const user = await sqliteGet('SELECT id, name, email FROM users WHERE id = ?', [req.user.id]);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  return res.json(user);
}));

app.post('/product', ensureDatabaseReady, asyncHandler(async (req, res) => {
  const { name, price, category } = req.body;
  if (!name || !price || !category) {
    return res.status(400).json({ message: 'Name, price, and category are required' });
  }

  await sqliteRun(
    'INSERT INTO products (id, name, price, category) VALUES (?, ?, ?, ?)',
    [crypto.randomUUID(), name, Number(price), category]
  );

  return res.json({ message: 'Product added' });
}));

app.get('/products', ensureDatabaseReady, asyncHandler(async (req, res) => {
  const rows = await sqliteAll('SELECT id, name, price, category FROM products ORDER BY rowid DESC');
  return res.json(rows.map((row) => ({
    _id: row.id,
    name: row.name,
    price: row.price,
    category: row.category
  })));
}));

app.post('/cart', ensureDatabaseReady, auth, asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  const parsedQuantity = Number(quantity) || 1;

  if (!productId || parsedQuantity < 1) {
    return res.status(400).json({ message: 'Invalid cart payload' });
  }

  const product = await sqliteGet('SELECT id FROM products WHERE id = ?', [productId]);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  const existingItem = await sqliteGet(
    'SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?',
    [req.user.id, productId]
  );

  if (existingItem) {
    await sqliteRun(
      'UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?',
      [existingItem.quantity + parsedQuantity, req.user.id, productId]
    );
    return res.json({ message: 'Cart updated' });
  }

  await sqliteRun(
    'INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)',
    [req.user.id, productId, parsedQuantity]
  );

  return res.json({ message: 'Added to cart' });
}));

app.get('/cart', ensureDatabaseReady, auth, asyncHandler(async (req, res) => {
  const rows = await sqliteAll(
    `SELECT c.product_id AS productId, p.name AS productName, p.price AS price, c.quantity AS quantity
     FROM cart_items c
     INNER JOIN products p ON p.id = c.product_id
     WHERE c.user_id = ?`,
    [req.user.id]
  );

  return res.json(rows);
}));

app.put('/cart', ensureDatabaseReady, auth, asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  const parsedQuantity = Number(quantity);

  if (!productId || !Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
    return res.status(400).json({ message: 'Invalid cart payload' });
  }

  const updated = await sqliteRun(
    'UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?',
    [parsedQuantity, req.user.id, productId]
  );

  if (!updated.changes) {
    return res.status(404).json({ message: 'Cart item not found' });
  }

  return res.json({ message: 'Cart item updated' });
}));

app.delete('/cart', ensureDatabaseReady, auth, asyncHandler(async (req, res) => {
  const { productId } = req.body;

  if (!productId) {
    return res.status(400).json({ message: 'Invalid product id' });
  }

  const removed = await sqliteRun(
    'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
    [req.user.id, productId]
  );

  if (!removed.changes) {
    return res.status(404).json({ message: 'Cart item not found' });
  }

  return res.json({ message: 'Cart item removed' });
}));

app.post('/checkout', ensureDatabaseReady, auth, asyncHandler(async (req, res) => {
  const orderItems = await sqliteAll(
    `SELECT c.product_id AS productId, p.name AS productName, p.price AS price, c.quantity AS quantity
     FROM cart_items c
     INNER JOIN products p ON p.id = c.product_id
     WHERE c.user_id = ?`,
    [req.user.id]
  );

  if (!orderItems.length) {
    return res.status(400).json({ message: 'Cart is empty' });
  }

  const totalAmount = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const orderId = crypto.randomUUID();

  await sqliteRun(
    'INSERT INTO orders (id, user_id, items_json, total_amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [orderId, req.user.id, JSON.stringify(orderItems), totalAmount, 'confirmed', new Date().toISOString()]
  );

  await sqliteRun('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);

  return res.json({
    message: 'Order placed successfully',
    orderId,
    totalAmount
  });
}));

app.get('/orders', ensureDatabaseReady, auth, asyncHandler(async (req, res) => {
  const rows = await sqliteAll(
    'SELECT id, total_amount, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id]
  );

  return res.json(rows);
}));

app.get('/orders/:id', ensureDatabaseReady, auth, asyncHandler(async (req, res) => {
  const order = await sqliteGet('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  return res.json({
    ...order,
    items: JSON.parse(order.items_json)
  });
}));

app.post('/newsletter', ensureDatabaseReady, asyncHandler(async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const exists = await sqliteGet('SELECT email FROM newsletter_subscribers WHERE email = ?', [email]);
  if (exists) {
    return res.status(200).json({ message: 'Already subscribed' });
  }

  await sqliteRun(
    'INSERT INTO newsletter_subscribers (email, created_at) VALUES (?, ?)',
    [email, new Date().toISOString()]
  );

  return res.json({ message: 'Subscription successful' });
}));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    dbReady
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

connectDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
  });
