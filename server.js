const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // npm install node-fetch@2
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const app = express();
const PORT = process.env.PORT || 3000;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7012189549:AAGfOwMnTDDOvRi1AAez31SaQY-Tpyk9PNQ';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// ✅ Разрешаем CORS (на GitHub Pages укажи свой URL вместо *)
app.use(cors({
  origin: 'https://webdev-it.github.io', // Разрешаем только GitHub Pages
}));

// 📦 Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Проверка, что JSON-файлы существуют
const PRODUCTS_FILE = './products.json';
const FAVORITES_FILE = './favorites.json';
const ACCOUNTS_FILE = './accounts.json';
const HISTORY_FILE = './history.json';
const PAYMENT_LINKS_FILE = './payment_links.json';

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

function readAccounts() {
  if (!fs.existsSync(ACCOUNTS_FILE)) fs.writeFileSync(ACCOUNTS_FILE, '{}');
  return JSON.parse(fs.readFileSync(ACCOUNTS_FILE));
}
function writeAccounts(data) {
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2));
}
function readHistory() {
  if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '{}');
  return JSON.parse(fs.readFileSync(HISTORY_FILE));
}
function writeHistory(data) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
}
function readPaymentLinks() {
  if (!fs.existsSync(PAYMENT_LINKS_FILE)) fs.writeFileSync(PAYMENT_LINKS_FILE, '{}');
  return JSON.parse(fs.readFileSync(PAYMENT_LINKS_FILE));
}
function writePaymentLinks(data) {
  fs.writeFileSync(PAYMENT_LINKS_FILE, JSON.stringify(data, null, 2));
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

  if (!newProduct.name || newProduct.price === undefined || newProduct.price === null || newProduct.category === undefined || newProduct.category === null || newProduct.category === "") {
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

// ======= 🔹 РОУТЫ: /account =========
// Создать или получить аккаунт по Telegram ID
app.post('/account', (req, res) => {
  const { telegram_id, name } = req.body;
  if (!telegram_id) return res.status(400).json({ error: 'telegram_id обязателен' });
  const accounts = readAccounts();
  if (!accounts[telegram_id]) {
    accounts[telegram_id] = { telegram_id, name, created: Date.now() };
    writeAccounts(accounts);
  }
  res.json(accounts[telegram_id]);
});

// Получить историю покупок/скачиваний (с флагом expired и daysLeft)
app.get('/account/:id/history', (req, res) => {
  const history = readHistory();
  const userHistory = history[req.params.id] || [];
  const now = Date.now();
  const result = userHistory.map(item => {
    const dt = new Date(item.date);
    const msLeft = 7 * 24 * 60 * 60 * 1000 - (now - dt.getTime());
    let expired = msLeft <= 0;
    let daysLeft = expired ? 0 : Math.ceil(msLeft / (24*60*60*1000));
    return { ...item, expired, daysLeft };
  });
  res.json(result);
});

// Добавить запись в историю (вызывать при скачивании/покупке)
app.post('/account/:id/history', (req, res) => {
  const { productId, name } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId обязателен' });
  const history = readHistory();
  if (!history[req.params.id]) history[req.params.id] = [];
  history[req.params.id].push({ productId, name, date: new Date().toISOString() });
  writeHistory(history);
  res.status(201).json({ message: 'Добавлено в историю' });
});

// Получить избранное пользователя (совместимость с новым API)
app.get('/account/:id/favorites', (req, res) => {
  const favorites = readJSON(FAVORITES_FILE, {});
  const products = readJSON(PRODUCTS_FILE, []);
  const ids = favorites[req.params.id] || [];
  // Вернуть подробную инфу о товарах
  const favProducts = products.filter(p => ids.includes(p.id));
  res.json(favProducts);
});
// Добавить в избранное
app.post('/account/:id/favorites', (req, res) => {
  const { productId } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId обязателен' });
  const favorites = readJSON(FAVORITES_FILE, {});
  const userId = req.params.id;
  if (!favorites[userId]) favorites[userId] = [];
  if (favorites[userId].includes(productId)) {
    return res.status(400).json({ error: 'Товар уже в избранном' });
  }
  favorites[userId].push(productId);
  writeJSON(FAVORITES_FILE, favorites);
  res.status(201).json({ message: 'Добавлено в избранное' });
});
// Удалить из избранного
app.delete('/account/:id/favorites/:productId', (req, res) => {
  const userId = req.params.id;
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


const CATEGORIES_FILE = './categories.json';

function readCategories() {
  if (!fs.existsSync(CATEGORIES_FILE)) {
    fs.writeFileSync(CATEGORIES_FILE, '[]');
  }
  const data = fs.readFileSync(CATEGORIES_FILE);
  return JSON.parse(data);
}

function saveCategories(categories) {
  fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(categories, null, 2));
}

app.get('/categories', (req, res) => {
  const categories = readCategories();
  res.json(categories);
});
app.post('/categories', (req, res) => {
  const categories = readCategories();
  const newCategory = req.body;

  if (!newCategory.name) {
    return res.status(400).json({ error: 'Отсутствует имя категории' });
  }

  // Проверка на дублирование по имени (без учёта регистра)
  if (categories.some(cat => cat.name.toLowerCase() === newCategory.name.toLowerCase())) {
    return res.status(409).json({ error: 'Категория уже существует' });
  }

  newCategory.id = Date.now().toString();
  categories.push(newCategory);
  saveCategories(categories);

  res.status(201).json(newCategory);
});

// Удалить категорию по id
app.delete('/categories/:id', (req, res) => {
  const categories = readCategories();
  const id = req.params.id;
  const filtered = categories.filter(c => c.id !== id);
  if (filtered.length === categories.length) {
    return res.status(404).json({ error: 'Категория не найдена' });
  }
  saveCategories(filtered);

  // Удаляем все товары с этой категорией
  const products = readJSON(PRODUCTS_FILE, []);
  const productsFiltered = products.filter(p => p.category !== id);
  writeJSON(PRODUCTS_FILE, productsFiltered);

  res.json({ message: 'Категория и связанные товары удалены' });
});

const uploadRouter = require('./upload');
app.use('/upload', uploadRouter);

// === СТАТИКА: отдаём изображения и файлы из папок miniappdlaprodazhi ===
const IMAGES_DIR = path.join(__dirname, '../miniappdlaprodazhi/images');
const FILES_DIR = path.join(__dirname, '../miniappdlaprodazhi/files');
app.use('/images', express.static(IMAGES_DIR));
app.use('/files', express.static(FILES_DIR));

// Защищённая выдача файла по Telegram ID (POST /download)
app.post('/download', (req, res) => {
  const { telegram_id, productId } = req.body;
  if (!telegram_id || !productId) return res.status(400).json({ error: 'telegram_id и productId обязательны' });
  const products = readJSON(PRODUCTS_FILE, []);
  const product = products.find(p => p.id === productId);
  if (!product || !product.file) return res.status(404).json({ error: 'Файл не найден' });
  // Бесплатный товар — доступен всем
  if (product.price === 0) {
    // Логируем скачивание
    const history = readHistory();
    if (!history[telegram_id]) history[telegram_id] = [];
    history[telegram_id].push({ productId, name: product.name, date: new Date().toISOString() });
    writeHistory(history);
    return res.json({ url: `/files/${product.file}` });
  }
  // Платный товар — проверяем историю и срок
  const history = readHistory();
  const userHistory = history[telegram_id] || [];
  // Найти последнюю покупку этого товара
  const lastBuy = [...userHistory].reverse().find(h => h.productId === productId);
  if (!lastBuy) return res.status(403).json({ error: 'Нет доступа. Сначала купите товар.' });
  const dt = new Date(lastBuy.date);
  const msLeft = 7 * 24 * 60 * 60 * 1000 - (Date.now() - dt.getTime());
  if (msLeft <= 0) return res.status(403).json({ error: 'Срок скачивания истёк. Купите товар снова.' });
  // Логируем скачивание
  history[telegram_id].push({ productId, name: product.name, date: new Date().toISOString() });
  writeHistory(history);
  res.json({ url: `/files/${product.file}` });
});

// ======= 🔹 ВНУТРЕННИЙ БАЛАНС ПОЛЬЗОВАТЕЛЯ =========
// Получить баланс пользователя
app.get('/account/:id/balance', (req, res) => {
  const accounts = readAccounts();
  const user = accounts[req.params.id];
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  // Если поле balance отсутствует, считаем 0
  res.json({ balance: user.balance || 0 });
});

// Пополнить баланс пользователя (тестовый, для реального пополнения интегрируйте платёжку)
app.post('/account/:id/balance', (req, res) => {
  const { amount } = req.body;
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Некорректная сумма' });
  }
  const accounts = readAccounts();
  const user = accounts[req.params.id];
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  if (!user.balance) user.balance = 0;
  user.balance += amount;
  writeAccounts(accounts);
  res.json({ balance: user.balance });
});

// Купить товар за внутренний баланс
app.post('/account/:id/buy', (req, res) => {
  const { productId } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId обязателен' });
  const accounts = readAccounts();
  const user = accounts[req.params.id];
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  if (!user.balance) user.balance = 0;
  const products = readJSON(PRODUCTS_FILE, []);
  const product = products.find(p => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Товар не найден' });
  if (typeof product.price !== 'number' || product.price <= 0) return res.status(400).json({ error: 'Некорректная цена товара' });
  if (user.balance < product.price) return res.status(403).json({ error: 'Недостаточно средств на балансе' });
  // Списываем средства
  user.balance -= product.price;
  writeAccounts(accounts);
  // Логируем покупку в историю
  const history = readHistory();
  if (!history[req.params.id]) history[req.params.id] = [];
  history[req.params.id].push({ productId, name: product.name, date: new Date().toISOString(), paidWith: 'balance' });
  writeHistory(history);
  res.json({ ok: true, message: 'Покупка успешна!', balance: user.balance });
});

// --- Платёжные системы ---
const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID || 'ваш_shop_id';
const YOOKASSA_SECRET = process.env.YOOKASSA_SECRET || 'ваш_secret_key';
const CLOUDPAYMENTS_PUBLIC_ID = process.env.CLOUDPAYMENTS_PUBLIC_ID || 'ваш_public_id';
const CLOUDPAYMENTS_API_KEY = process.env.CLOUDPAYMENTS_API_KEY || 'ваш_api_key';

// --- Генерация платёжной ссылки ---
app.post('/create_payment_link', async (req, res) => {
  const { amount, telegramId, system } = req.body;
  if (!amount || !telegramId || !system) return res.status(400).json({ error: 'Некорректные данные' });
  const paymentId = uuidv4();
  const paymentLinks = readPaymentLinks();
  paymentLinks[paymentId] = { telegramId, amount, system, status: 'pending' };
  try {
    if (system === 'yookassa') {
      const response = await axios.post(
        'https://api.yookassa.ru/v3/payments',
        {
          amount: { value: amount.toFixed(2), currency: 'RUB' },
          confirmation: { type: 'redirect', return_url: 'https://t.me/your_bot?start=balance' },
          capture: true,
          description: `Пополнение баланса для ${telegramId}`,
          metadata: { telegramId, paymentId }
        },
        {
          auth: { username: YOOKASSA_SHOP_ID, password: YOOKASSA_SECRET },
          headers: { 'Idempotence-Key': paymentId }
        }
      );
      paymentLinks[paymentId].yookassa_id = response.data.id;
      writePaymentLinks(paymentLinks);
      return res.json({ url: response.data.confirmation.confirmation_url });
    } else if (system === 'cloudpayments') {
      const response = await axios.post(
        'https://api.cloudpayments.ru/payments/links',
        {
          Amount: amount,
          Currency: 'RUB',
          Description: `Пополнение баланса для ${telegramId}`,
          AccountId: telegramId,
          InvoiceId: paymentId,
          Email: '',
          Data: { telegramId }
        },
        {
          auth: { username: CLOUDPAYMENTS_PUBLIC_ID, password: CLOUDPAYMENTS_API_KEY }
        }
      );
      paymentLinks[paymentId].cloud_url = response.data.Model.Url;
      writePaymentLinks(paymentLinks);
      return res.json({ url: response.data.Model.Url });
    } else {
      return res.status(400).json({ error: 'Неизвестная платёжная система' });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Ошибка создания платежа', details: e.message });
  }
});

// --- Webhook ЮKassa ---
app.post('/yookassa_webhook', (req, res) => {
  const event = req.body;
  if (event.event === 'payment.succeeded') {
    const paymentId = event.object.metadata.paymentId;
    const telegramId = event.object.metadata.telegramId;
    const paymentLinks = readPaymentLinks();
    if (paymentLinks[paymentId] && paymentLinks[paymentId].status !== 'succeeded') {
      paymentLinks[paymentId].status = 'succeeded';
      writePaymentLinks(paymentLinks);
      // Пополнение баланса
      const accounts = readAccounts();
      if (!accounts[telegramId]) return res.sendStatus(200);
      if (!accounts[telegramId].balance) accounts[telegramId].balance = 0;
      accounts[telegramId].balance += Number(event.object.amount.value);
      writeAccounts(accounts);
    }
  }
  res.sendStatus(200);
});

// --- Webhook CloudPayments ---
app.post('/cloudpayments_webhook', (req, res) => {
  const { InvoiceId, AccountId, Amount, Status } = req.body;
  const paymentLinks = readPaymentLinks();
  if (Status === 'Completed' && paymentLinks[InvoiceId] && paymentLinks[InvoiceId].status !== 'succeeded') {
    paymentLinks[InvoiceId].status = 'succeeded';
    writePaymentLinks(paymentLinks);
    // Пополнение баланса
    const accounts = readAccounts();
    if (!accounts[AccountId]) return res.json({ code: 0 });
    if (!accounts[AccountId].balance) accounts[AccountId].balance = 0;
    accounts[AccountId].balance += Number(Amount);
    writeAccounts(accounts);
  }
  res.json({ code: 0 });
});

module.exports = app;

