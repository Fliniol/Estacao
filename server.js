require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mysql = require("mysql2/promise");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DELIVERY_FEE = Math.max(0, Number(process.env.DELIVERY_FEE || 0));

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "estacao_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
  charset: "utf8mb4"
});

app.disable("x-powered-by");
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://images.unsplash.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));
app.use(cors({ origin: process.env.APP_URL || `http://localhost:${PORT}` }));
app.use(express.json({ limit: "30kb" }));
app.use(express.static(path.join(__dirname, "public")));

const orderLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false, message: { message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." } });

function cleanText(value, maxLength = 255) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function validPhone(value) {
  return /^[0-9+()\s.-]{8,20}$/.test(value);
}

function makeOrderNumber() {
  const date = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  return `EST${date}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json({ status: "error", database: "unavailable" });
  }
});

app.get("/api/categories", async (req, res, next) => {
  try {
    const [categories] = await pool.query("SELECT id, name, slug FROM categories ORDER BY name");
    res.json({ categories });
  } catch (error) {
    next(error);
  }
});

app.get("/api/products", async (req, res, next) => {
  try {
    const category = cleanText(req.query.category, 40);
    const search = cleanText(req.query.search, 80);
    const params = [];
    let where = "WHERE p.is_active = TRUE";
    if (category && category !== "todas") {
      where += " AND c.slug = ?";
      params.push(category);
    }
    if (search) {
      where += " AND (p.name LIKE ? OR p.description LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    const [products] = await pool.execute(
      `SELECT p.id, p.name, p.description, p.price, p.image_url, p.stock_quantity, p.is_active, c.name AS category_name, c.slug AS category_slug
       FROM products p INNER JOIN categories c ON c.id = p.category_id ${where} ORDER BY p.id DESC`,
      params
    );
    res.json({ products });
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders", orderLimiter, async (req, res, next) => {
  const body = req.body || {};
  const customerName = cleanText(body.customerName, 100);
  const customerPhone = cleanText(body.customerPhone, 20);
  const recipientName = cleanText(body.recipientName, 100) || null;
  const recipientPhone = cleanText(body.recipientPhone, 20) || null;
  const deliveryAddress = cleanText(body.deliveryAddress, 255);
  const deliveryDate = cleanText(body.deliveryDate, 10);
  const deliveryPeriod = cleanText(body.deliveryPeriod, 20);
  const cardMessage = cleanText(body.cardMessage, 500) || null;
  const notes = cleanText(body.notes, 500) || null;
  const checkoutType = body.checkoutType;
  const items = Array.isArray(body.items) ? body.items : [];

  if (customerName.length < 2 || !validPhone(customerPhone) || deliveryAddress.length < 6) {
    return res.status(400).json({ message: "Confira seu nome, telefone e endereço de entrega." });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) || Number.isNaN(Date.parse(`${deliveryDate}T12:00:00`)) || deliveryDate < new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({ message: "Escolha uma data de entrega válida." });
  }
  if (!["manha", "tarde", "comercial"].includes(deliveryPeriod)) {
    return res.status(400).json({ message: "Selecione um período de entrega." });
  }
  if (!["whatsapp", "online"].includes(checkoutType)) {
    return res.status(400).json({ message: "Selecione uma forma de finalizar o pedido." });
  }
  if (!items.length || items.length > 30) {
    return res.status(400).json({ message: "Sua sacola está vazia ou contém muitos itens diferentes." });
  }

  const normalizedItems = new Map();
  for (const item of items) {
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(productId) || productId <= 0 || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 50) {
      return res.status(400).json({ message: "Um dos produtos ou quantidades do pedido é inválido." });
    }
    normalizedItems.set(productId, (normalizedItems.get(productId) || 0) + quantity);
  }

  let connection;
  let orderId;
  let orderNumber;
  let subtotal = 0;
  let orderLines = [];
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const ids = [...normalizedItems.keys()];
    const placeholders = ids.map(() => "?").join(",");
    const [products] = await connection.query(
      `SELECT id, name, price, stock_quantity, is_active FROM products WHERE id IN (${placeholders}) FOR UPDATE`,
      ids
    );
    if (products.length !== ids.length) throw Object.assign(new Error("Um produto do pedido não está mais disponível."), { statusCode: 409 });

    for (const product of products) {
      const quantity = normalizedItems.get(product.id);
      if (!product.is_active || Number(product.stock_quantity) < quantity) {
        throw Object.assign(new Error(`Estoque insuficiente para ${product.name}. Atualize sua sacola.`), { statusCode: 409 });
      }
      const unitPrice = Number(product.price);
      const lineTotal = unitPrice * quantity;
      subtotal += lineTotal;
      orderLines.push({ productId: product.id, name: product.name, unitPrice, quantity, lineTotal });
    }

    const deliveryFee = DELIVERY_FEE;
    const total = subtotal + deliveryFee;
    orderNumber = makeOrderNumber();
    const [orderResult] = await connection.execute(
      `INSERT INTO orders (order_number, customer_name, customer_phone, recipient_name, recipient_phone, delivery_address, delivery_date, delivery_period, card_message, notes, subtotal, delivery_fee, total, checkout_type, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [orderNumber, customerName, customerPhone, recipientName, recipientPhone, deliveryAddress, deliveryDate, deliveryPeriod, cardMessage, notes, subtotal, deliveryFee, total, checkoutType]
    );
    orderId = orderResult.insertId;

    for (const line of orderLines) {
      await connection.execute(
        "INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total) VALUES (?, ?, ?, ?, ?, ?)",
        [orderId, line.productId, line.name, line.unitPrice, line.quantity, line.lineTotal]
      );
      await connection.execute("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?", [line.quantity, line.productId]);
    }

    await connection.commit();
  } catch (error) {
    if (connection) await connection.rollback();
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  } finally {
    if (connection) connection.release();
  }

  const total = subtotal + DELIVERY_FEE;
  const response = { orderNumber, total, message: "Pedido registrado." };

  if (checkoutType === "whatsapp") {
    const whatsappNumber = String(process.env.WHATSAPP_NUMBER || "").replace(/\D/g, "");
    if (whatsappNumber.length >= 10) {
      const lines = orderLines.map((line) => `• ${line.quantity}x ${line.name} — R$ ${line.lineTotal.toFixed(2).replace(".", ",")}`).join("\n");
      const message = [
        `Olá! Gostaria de confirmar o pedido ${orderNumber}.`,
        lines,
        `Total: R$ ${total.toFixed(2).replace(".", ",")}`,
        `Entrega: ${deliveryDate} (${deliveryPeriod})`,
        `Cliente: ${customerName} — ${customerPhone}`,
        `Endereço: ${deliveryAddress}`,
        recipientName ? `Destinatário: ${recipientName}` : "",
        cardMessage ? `Mensagem do cartão: ${cardMessage}` : "",
        notes ? `Observações: ${notes}` : ""
      ].filter(Boolean).join("\n");
      response.whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    } else {
      response.whatsappConfigured = false;
    }
  }

  if (checkoutType === "online") {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (accessToken) {
      try {
        const preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [
              ...orderLines.map((line) => ({ title: line.name, quantity: line.quantity, unit_price: line.unitPrice, currency_id: "BRL" })),
              ...(DELIVERY_FEE > 0 ? [{ title: "Taxa de entrega", quantity: 1, unit_price: DELIVERY_FEE, currency_id: "BRL" }] : [])
            ],
            external_reference: orderNumber,
            back_urls: {
              success: `${process.env.APP_URL || `http://localhost:${PORT}`}/?pagamento=sucesso&pedido=${orderNumber}`,
              failure: `${process.env.APP_URL || `http://localhost:${PORT}`}/?pagamento=erro&pedido=${orderNumber}`,
              pending: `${process.env.APP_URL || `http://localhost:${PORT}`}/?pagamento=pendente&pedido=${orderNumber}`
            },
            auto_return: "approved"
          })
        });
        const preference = await preferenceResponse.json();
        if (preferenceResponse.ok && preference.init_point) {
          response.paymentUrl = preference.init_point;
          await pool.execute("UPDATE orders SET payment_reference = ? WHERE id = ?", [String(preference.id), orderId]);
        } else {
          response.paymentSetupError = "Não foi possível iniciar o pagamento. O pedido foi registrado e precisa de confirmação.";
        }
      } catch {
        response.paymentSetupError = "O serviço de pagamento não respondeu. O pedido foi registrado para conferência.";
      }
    } else {
      response.paymentConfigured = false;
    }
  }

  res.status(201).json(response);
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: "Ocorreu um erro no servidor. Tente novamente." });
});

async function start() {
  try {
    await pool.query("SELECT 1");
    console.log("Conexão com MySQL estabelecida.");
  } catch (error) {
    console.error("Não foi possível conectar ao MySQL. Confira o arquivo .env e se o MySQL está iniciado.");
    console.error(error.message);
  }
  app.listen(PORT, () => console.log(`Estação disponível em http://localhost:${PORT}`));
}

start();
