module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch(e) {}
  }

  const { imageBase64 } = body || {};
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "No API key configured", identified: null });

  let anthropicResponse;
  try {
    anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: imageBase64 }
            },
            {
              type: "text",
              text: "This is a Bo Jackson Battle Arena (BoBA) trading card. Extract ONLY these fields as JSON with no other text:\n{\"cardNum\":\"the card number (e.g. 1, 42, P-5)\",\"hero\":\"hero name\",\"weapon\":\"weapon type (Fire/Ice/Steel/Brawl/Glow/Hex/Gum/Super/Alt/Metallic)\",\"treatment\":\"card treatment/set name\"}\nIf you cannot read the card clearly, return {\"cardNum\":null}"
            }
          ]
        }]
      })
    });
  } catch(fetchErr) {
    return res.status(500).json({ error: "Fetch failed: " + fetchErr.message, identified: null });
  }

  let data;
  try {
    data = await anthropicResponse.json();
  } catch(jsonErr) {
    const raw = await anthropicResponse.text().catch(() => "unreadable");
    return res.status(500).json({ error: "JSON parse failed", raw, identified: null });
  }

  if (!anthropicResponse.ok) {
    return res.status(500).json({ error: "Anthropic error", status: anthropicResponse.status, data, identified: null });
  }

  try {
    const text = data.content?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const identified = JSON.parse(clean);
    return res.status(200).json({ identified });
  } catch(parseErr) {
    return res.status(200).json({ identified: { cardNum: null }, error: "parse failed" });
  }
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};
