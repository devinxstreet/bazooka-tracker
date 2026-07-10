// /api/ebay-comps  — Vercel serverless function
// Fetches SOLD comps from eBay via the Apify "eBay Sold Listings Search" actor.
// Returns real completed-sale prices (not asking prices), normalized for the app.
//
// Requires ONE Vercel Environment Variable (Project → Settings → Environment Variables):
//   APIFY_TOKEN = your Apify API token  (console.apify.com → Settings → Integrations → API tokens)
//
// The front-end calls /api/ebay-comps?q=<card query>&limit=60 and expects:
//   { ok:true, sales:[{title,price,currency,soldDate,url,source}], summary:{count,avg,median,high,low,last} }
// or { ok:false, reason:"..." } on any failure (front-end hides the eBay tier gracefully).

const ACTOR_ID = "caffein.dev~ebay-sold-listings"; // Apify actor (tilde form for API path)
const APIFY_RUN_SYNC = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items`;

function normalize(item) {
  // Apify actor output → our comp shape
  const price = item.soldPrice != null ? parseFloat(item.soldPrice) : null;
  return {
    title: item.title || "",
    price: price != null && !isNaN(price) ? price : null,
    currency: item.soldCurrency || "USD",
    soldDate: item.endedAt || null,
    url: item.url || "",
    source: "ebay",
  };
}

module.exports = async function handler(req, res) {
  const q = (req.method === "POST" ? req.body?.q : req.query?.q) || "";
  const limit = Math.min(parseInt((req.method === "POST" ? req.body?.limit : req.query?.limit) || "60", 10), 200);
  if (!q || !String(q).trim()) { res.status(400).json({ ok: false, reason: "missing_query" }); return; }

  const token = process.env.APIFY_TOKEN;
  if (!token) { res.status(200).json({ ok: false, reason: "missing_credentials" }); return; }

  const input = {
    keywords: [String(q).trim()],
    daysToScrape: 90,      // up to 90 days of sold history
    count: limit,
    ebaySite: "ebay.com",
    sortOrder: "endedRecently",
    currencyMode: "USD",
    detailedSearch: false, // faster / cheaper; we only need price + date + title
  };

  try {
    const resp = await fetch(`${APIFY_RUN_SYNC}?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      res.status(200).json({ ok: false, reason: "apify_error", status: resp.status, detail: detail.slice(0, 300) });
      return;
    }

    const items = await resp.json(); // array of dataset items
    const sales = (Array.isArray(items) ? items : []).map(normalize).filter(s => s.price != null);

    let summary = null;
    if (sales.length) {
      const prices = sales.map(s => s.price).sort((a, b) => a - b);
      const sum = prices.reduce((a, b) => a + b, 0);
      const mid = Math.floor(prices.length / 2);
      summary = {
        count: prices.length,
        avg: sum / prices.length,
        median: prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2,
        high: prices[prices.length - 1],
        low: prices[0],
        last: sales.slice().sort((a, b) => (b.soldDate || "").localeCompare(a.soldDate || ""))[0],
      };
    }

    res.status(200).json({ ok: true, query: q, sales, summary });
  } catch (e) {
    res.status(200).json({ ok: false, reason: "server_error", message: String(e.message || e) });
  }
};
