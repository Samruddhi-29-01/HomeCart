const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/homekart';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required in environment variables');
}

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Models
const User = mongoose.model('User', {
  name: String,
  email: String,
  password: String
});

const Product = mongoose.model('Product', {
  name: String,
  price: Number
});

const Cart = mongoose.model('Cart', {
  userId: mongoose.Schema.Types.ObjectId,
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  quantity: Number
});

// Middleware
const auth = (req, res, next) => {
  try {
    const token = req.headers.authorization;
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data;
    next();
  } catch {
    res.status(401).send("Unauthorized");
  }
};

// Routes
app.post('/register', async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);
  await User.create({ ...req.body, password: hash });
  res.send("Registered");
});

app.post('/login', async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  const match = await bcrypt.compare(req.body.password, user.password);
  if (!match) return res.send("Invalid");

  const token = jwt.sign({ id: user._id }, JWT_SECRET);
  res.json({ token });
});

app.post('/product', async (req, res) => {
  await Product.create(req.body);
  res.send("Product Added");
});

app.get('/products', async (req, res) => {
  res.json(await Product.find());
});

app.post('/cart', auth, async (req, res) => {
  const { productId, quantity } = req.body;
  const parsedQuantity = Number(quantity) || 1;

  if (!mongoose.Types.ObjectId.isValid(productId) || parsedQuantity < 1) {
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

  await Cart.create({
    userId: req.user.id,
    productId,
    quantity: parsedQuantity
  });

  res.json({ message: 'Added to cart' });
});

app.get('/cart', auth, async (req, res) => {
  const cartItems = await Cart.find({ userId: req.user.id }).populate('productId');

  const response = cartItems
    .filter(item => item.productId)
    .map(item => ({
      productId: item.productId._id,
      productName: item.productId.name,
      price: item.productId.price,
      quantity: item.quantity
    }));

  res.json(response);
});

app.put('/cart', auth, async (req, res) => {
  const { productId, quantity } = req.body;
  const parsedQuantity = Number(quantity);

  if (!mongoose.Types.ObjectId.isValid(productId) || !Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
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

  res.json({ message: 'Cart item updated' });
});

app.delete('/cart', auth, async (req, res) => {
  const { productId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: 'Invalid product id' });
  }

  const deletedItem = await Cart.findOneAndDelete({ userId: req.user.id, productId });
  if (!deletedItem) {
    return res.status(404).json({ message: 'Cart item not found' });
  }

  res.json({ message: 'Cart item removed' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));