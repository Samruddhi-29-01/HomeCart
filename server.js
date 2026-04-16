const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/homekart';
const JWT_SECRET = process.env.JWT_SECRET;
const SQLITE_DB_PATH = path.join(__dirname, 'homekart.sqlite');

let dbReady = false;
let storageMode = 'mongo';
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

const User = mongoose.model('User', {
  name: String,
  email: { type: String, unique: true },
  password: String
});

const Product = mongoose.model('Product', {
  name: String,
  price: Number,
  category: String
});

const Cart = mongoose.model('Cart', {
  userId: mongoose.Schema.Types.ObjectId,
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  quantity: Number
});

const Order = mongoose.model('Order', {
  userId: mongoose.Schema.Types.ObjectId,
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      productName: String,
      price: Number,
      quantity: Number
    }
  ],
  totalAmount: Number,
  status: { type: String, default: 'confirmed' },
  createdAt: { type: Date, default: Date.now }
});

const NewsletterSubscriber = mongoose.model('NewsletterSubscriber', {
  email: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now }
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

async function seedInitialProductsMongo() {
  const count = await Product.countDocuments();
  if (count > 0) return;
  await Product.insertMany(initialProducts);
  console.log('Seeded initial product catalog (MongoDB).');
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
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    storageMode = 'mongo';
    dbReady = true;
    console.log('Connected to MongoDB');
    await seedInitialProductsMongo();
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    console.log('Falling back to SQLite...');
    await initSqlite();
    storageMode = 'sqlite';
    dbReady = true;
    console.log(`Connected to SQLite at ${SQLITE_DB_PATH}`);
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

  if (storageMode === 'mongo') {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    await User.create({ name, email, password: hash });
    return res.json({ message: 'Registered' });
  }

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

  let user = null;

  if (storageMode === 'mongo') {
    user = await User.findOne({ email });
  } else {
    user = await sqliteGet('SELECT id, email, password FROM users WHERE email = ?', [email]);
  }

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = jwt.sign({ id: String(user._id || user.id) }, JWT_SECRET);

  return res.json({
    token,
    user: {
      id: String(user._id || user.id),
      name: user.name || 'User',
      email: user.email
    }
  });
}));

app.get('/me', ensureDatabaseReady, auth, asyncHandler(async (req, res) => {
  if (storageMode === 'mongo') {
    const user = await User.findById(req.user.id).select('name email');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      id: String(user._id),
      name: user.name,
      email: user.email
    });
  }

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

  if (storageMode === 'mongo') {
    await Product.create({ name, price, category });
    return res.json({ message: 'Product added' });
  }

  await sqliteRun(
    'INSERT INTO products (id, name, price, category) VALUES (?, ?, ?, ?)',
    [crypto.randomUUID(), name, Number(price), category]
  );

  return res.json({ message: 'Product added' });
}));

app.get('/products', ensureDatabaseReady, asyncHandler(async (req, res) => {
  if (storageMode === 'mongo') {
    return res.json(await Product.find());
  }

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

  if (storageMode === 'mongo') {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid cart payload' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const existingItem = await Cart.findOne({ userId: req.user.id, productId });
    if (existingItem) {
      existingItem.quantity += parsedQuantity;
      await existingItem.save();
      return res.json({ message: 'Cart updated' });
    }

    await Cart.create({ userId: req.user.id, productId, quantity: parsedQuantity });
    return res.json({ message: 'Added to cart' });
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
  if (storageMode === 'mongo') {
    const cartItems = await Cart.find({ userId: req.user.id }).populate('productId');
    const response = cartItems
      .filter((item) => item.productId)
      .map((item) => ({
        productId: String(item.productId._id),
        productName: item.productId.name,
        price: item.productId.price,
        quantity: item.quantity
      }));

    return res.json(response);
  }

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

  if (storageMode === 'mongo') {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid cart payload' });
    }

    const updatedItem = await Cart.findOneAndUpdate(
      { userId: req.user.id, productId },
      { quantity: parsedQuantity },
      { new: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    return res.json({ message: 'Cart item updated' });
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

  if (storageMode === 'mongo') {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product id' });
    }

    const deletedItem = await Cart.findOneAndDelete({ userId: req.user.id, productId });
    if (!deletedItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    return res.json({ message: 'Cart item removed' });
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
  if (storageMode === 'mongo') {
    const cartItems = await Cart.find({ userId: req.user.id }).populate('productId');
    if (!cartItems.length) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    const orderItems = cartItems
      .filter((item) => item.productId)
      .map((item) => ({
        productId: String(item.productId._id),
        productName: item.productId.name,
        price: item.productId.price,
        quantity: item.quantity
      }));

    const totalAmount = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const order = await Order.create({
      userId: req.user.id,
      items: orderItems,
      totalAmount,
      status: 'confirmed'
    });

    await Cart.deleteMany({ userId: req.user.id });

    return res.json({
      message: 'Order placed successfully',
      orderId: String(order._id),
      totalAmount: order.totalAmount
    });
  }

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

app.post('/newsletter', ensureDatabaseReady, asyncHandler(async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  if (storageMode === 'mongo') {
    const exists = await NewsletterSubscriber.findOne({ email });
    if (exists) {
      return res.status(200).json({ message: 'Already subscribed' });
    }

    await NewsletterSubscriber.create({ email });
    return res.json({ message: 'Subscription successful' });
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
    storageMode,
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
      console.log(`Server running on port ${PORT} (storage: ${storageMode})`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
  });
