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

  const { imageBase64, treatment, weapon } = body || {};
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "No API key configured", identified: null });

  const hint = treatment && weapon
    ? `This card is from the "${treatment}" treatment set with "${weapon}" weapon type. `
    : treatment ? `This card is from the "${treatment}" treatment set. `
    : weapon ? `This card has "${weapon}" weapon type. `
    : "";

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
        max_tokens: 100,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: imageBase64 }
            },
            {
              type: "text",
              text: `This is a Bo Jackson Battle Arena (BoBA) trading card. ${hint}What is the hero name on this card? Return ONLY a JSON object with no other text: {"hero":"the hero name as it appears on the card"}\nIf you cannot read the hero name, return {"hero":null}`
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
    return res.status(500).json({ error: "JSON parse failed", identified: null });
  }

  if (!anthropicResponse.ok) {
    return res.status(500).json({ error: "Anthropic error", details: data, identified: null });
  }

  try {
    const text = data.content?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json({ identified: { hero: parsed.hero, treatment, weapon } });
  } catch(parseErr) {
    return res.status(200).json({ identified: { hero: null }, error: "parse failed" });
  }
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};
