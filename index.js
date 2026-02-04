import express from "express";
import crypto from "crypto";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;
const BASE_URL = "https://fapi.binance.com";

// ================= SIGN =================
function sign(query) {
  return crypto
    .createHmac("sha256", API_SECRET)
    .update(query)
    .digest("hex");
}

// ================= FUTURES USDT BALANCE =================
async function getBalance() {
  const ts = Date.now();
  const query = `timestamp=${ts}`;
  const sig = sign(query);

  const res = await fetch(
    `${BASE_URL}/fapi/v2/balance?${query}&signature=${sig}`,
    {
      headers: { "X-MBX-APIKEY": API_KEY }
    }
  );

  const data = await res.json();
  const usdt = data.find(i => i.asset === "USDT");
  return usdt ? parseFloat(usdt.balance) : 0;
}

// ================= PRICE =================
async function getPrice(symbol) {
  const res = await fetch(
    `${BASE_URL}/fapi/v1/ticker/price?symbol=${symbol}`
  );
  const data = await res.json();
  return parseFloat(data.price);
}

// ================= WEBHOOK =================
app.post("/webhook", async (req, res) => {
  try {
    console.log("WEBHOOK BODY:", req.body);

    const { symbol, side, percent } = req.body;

    if (!symbol || !side || !percent) {
      return res.json({ error: "Missing symbol / side / percent" });
    }

    const balance = await getBalance();
    console.log("FUTURES BALANCE:", balance);

    if (balance <= 0) {
      return res.json({ error: "Futures wallet USDT is zero" });
    }

    const price = await getPrice(symbol);
    console.log("PRICE:", price);

    const orderUSDT = (balance * percent) / 100;

    // ===== SAFE QUANTITY CALCULATION =====
    let quantity = orderUSDT / price;
    quantity = Math.floor(quantity * 1000) / 1000; // ETH step size safe

    console.log("FINAL QTY:", quantity);

    if (quantity <= 0) {
      return res.json({ error: "Quantity too small" });
    }

    const ts = Date.now();
    const query =
      `symbol=${symbol}` +
      `&side=${side}` +
      `&type=MARKET` +
      `&quantity=${quantity}` +
      `&timestamp=${ts}`;

    const sig = sign(query);

    const orderRes = await fetch(
      `${BASE_URL}/fapi/v1/order?${query}&signature=${sig}`,
      {
        method: "POST",
        headers: { "X-MBX-APIKEY": API_KEY }
      }
    );

    const result = await orderRes.json();
    console.log("BINANCE RESPONSE:", result);

    res.json(result);

  } catch (err) {
    console.error("SERVER ERROR:", err.message);
    res.json({ error: err.message });
  }
});

// ================= PORT =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
