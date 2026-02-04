import express from "express";
import crypto from "crypto";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;

// Binance Futures base URL
const BASE_URL = "https://fapi.binance.com";

// ---------- SIGN FUNCTION ----------
function sign(query) {
  return crypto
    .createHmac("sha256", API_SECRET)
    .update(query)
    .digest("hex");
}

// ---------- GET USDT BALANCE ----------
async function getBalance() {
  const ts = Date.now();
  const query = `timestamp=${ts}`;
  const sig = sign(query);

  const res = await fetch(
    `${BASE_URL}/fapi/v2/balance?${query}&signature=${sig}`,
    {
      headers: {
        "X-MBX-APIKEY": API_KEY
      }
    }
  );

  const data = await res.json();
  const usdt = data.find(i => i.asset === "USDT");
  return parseFloat(usdt.balance);
}

// ---------- WEBHOOK ----------
app.post("/webhook", async (req, res) => {
  try {
    const { symbol, side, percent } = req.body;

    const balance = await getBalance();
    const orderUSDT = (balance * percent) / 100;

    const ts = Date.now();
    const query =
      `symbol=${symbol}` +
      `&side=${side}` +
      `&type=MARKET` +
      `&quoteOrderQty=${orderUSDT}` +
      `&timestamp=${ts}`;

    const sig = sign(query);

    const order = await fetch(
      `${BASE_URL}/fapi/v1/order?${query}&signature=${sig}`,
      {
        method: "POST",
        headers: {
          "X-MBX-APIKEY": API_KEY
        }
      }
    );

    const result = await order.json();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- IMPORTANT PART (PORT FIX) ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
