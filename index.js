import express from "express";
import crypto from "crypto";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;
const BASE_URL = "https://fapi.binance.com";

// ---------- SIGN ----------
function sign(query) {
  return crypto.createHmac("sha256", API_SECRET).update(query).digest("hex");
}

// ---------- GET FUTURES BALANCE ----------
async function getBalance() {
  const ts = Date.now();
  const query = `timestamp=${ts}`;
  const sig = sign(query);

  const res = await fetch(
    `${BASE_URL}/fapi/v2/balance?${query}&signature=${sig}`,
    { headers: { "X-MBX-APIKEY": API_KEY } }
  );

  const data = await res.json();
  return parseFloat(data.find(i => i.asset === "USDT").balance);
}

// ---------- GET PRICE ----------
async function getPrice(symbol) {
  const res = await fetch(
    `${BASE_URL}/fapi/v1/ticker/price?symbol=${symbol}`
  );
  const data = await res.json();
  return parseFloat(data.price);
}

// ---------- WEBHOOK ----------
app.post("/webhook", async (req, res) => {
  try {
    const { symbol, side, percent } = req.body;

    const balance = await getBalance();
    const price = await getPrice(symbol);

    const orderUSDT = (balance * percent) / 100;
    const quantity = (orderUSDT / price).toFixed(3); // ETH precision

    const ts = Date.now();
    const query =
      `symbol=${symbol}` +
      `&side=${side}` +
      `&type=MARKET` +
      `&quantity=${quantity}` +
      `&timestamp=${ts}`;

    const sig = sign(query);

    const order = await fetch(
      `${BASE_URL}/fapi/v1/order?${query}&signature=${sig}`,
      {
        method: "POST",
        headers: { "X-MBX-APIKEY": API_KEY }
      }
    );

    const result = await order.json();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- PORT ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on", PORT));
