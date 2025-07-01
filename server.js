const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const app = express();
const PORT = 3000;

// ✅ Разрешаем CORS (на GitHub Pages укажи свой URL вместо *)
app.use(cors({
  origin: 'https://webdev-it.github.io', // 🔁 Лучше: 'https://yourusername.github.io'
}));

// 📦 Middleware
app.use(bodyParser.json());

// ✅ Проверка, что JSON-файлы существуют
const PRODUCTS_FILE = './products.json';
const FAVORITES_FILE = './favorites.json';

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(fallback));
    const data = fs.readFileSync(file);
    return JSON.parse(data);
  } catch (err) {
    console.error(`Ошибка чтения файла ${file}:`, err);
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ======= 🔹 РОУТЫ: /products =========

// Получить все товары
app.get('/products', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const products = readJSON(PRODUCTS_FILE, []);
  res.json(products);
});

// Добавить новый товар
app.post('/products', (req, res) => {
  const products = readJSON(PRODUCTS_FILE, []);
  const newProduct = req.body;

  if (!newProduct.name || !newProduct.price || !newProduct.category) {
    return res.status(400).json({ error: 'Отсутствуют обязательные поля' });
  }

  newProduct.id = Date.now().toString();
  products.push(newProduct);
  writeJSON(PRODUCTS_FILE, products);

  res.status(201).json(newProduct);
});

// Удалить товар
app.delete('/products/:id', (req, res) => {
  const products = readJSON(PRODUCTS_FILE, []);
  const id = req.params.id;
  const filtered = products.filter(p => p.id !== id);

  if (filtered.length === products.length) {
    return res.status(404).json({ error: 'Товар не найден' });
  }

  writeJSON(PRODUCTS_FILE, filtered);
  res.json({ message: 'Товар удалён' });
});

// Обновить товар
app.put('/products/:id', (req, res) => {
  const products = readJSON(PRODUCTS_FILE, []);
  const id = req.params.id;
  const updated = req.body;

  const index = products.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Товар не найден' });
  }

  products[index] = { ...products[index], ...updated, id };
  writeJSON(PRODUCTS_FILE, products);

  res.json(products[index]);
});

// ======= 🔹 РОУТЫ: /favorites =========

// Получить избранное пользователя
app.get('/favorites/:userId', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const favorites = readJSON(FAVORITES_FILE, {});
  res.json(favorites[req.params.userId] || []);
});

// Добавить в избранное
app.post('/favorites/:userId', (req, res) => {
  const { productId } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId обязателен' });

  const favorites = readJSON(FAVORITES_FILE, {});
  const userId = req.params.userId;
  if (!favorites[userId]) favorites[userId] = [];

  if (favorites[userId].includes(productId)) {
    return res.status(400).json({ error: 'Товар уже в избранном' });
  }

  favorites[userId].push(productId);
  writeJSON(FAVORITES_FILE, favorites);
  res.status(201).json({ message: 'Добавлено в избранное' });
});

// Удалить из избранного
app.delete('/favorites/:userId/:productId', (req, res) => {
  const userId = req.params.userId;
  const productId = req.params.productId;
  const favorites = readJSON(FAVORITES_FILE, {});

  if (!favorites[userId] || !favorites[userId].includes(productId)) {
    return res.status(404).json({ error: 'Товар не найден в избранном' });
  }

  favorites[userId] = favorites[userId].filter(id => id !== productId);
  writeJSON(FAVORITES_FILE, favorites);
  res.json({ message: 'Удалено из избранного' });
});

// ======= 🔹 СТАРТ СЕРВЕРА =========
app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
});
