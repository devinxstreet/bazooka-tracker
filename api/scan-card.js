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
              text: `This is a Bo Jackson Battle Arena (BoBA) trading card. ${hint}Extract ALL visible fields and return ONLY a JSON object with no other text:
{"cardNum":"card number shown (e.g. RAD-1, 1, P-5)","hero":"hero name exactly as printed","weapon":"weapon type (Fire/Ice/Steel/Brawl/Glow/Hex/Gum/Super/Alt/Metallic)","power":"power number (e.g. 135)","treatment":"treatment/set name if visible"}
If you cannot read the card clearly, return {"cardNum":null}`
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
    // Fill in known values from modal if Claude missed them
    return res.status(200).json({
      identified: {
        cardNum:   parsed.cardNum   || null,
        hero:      parsed.hero      || null,
        weapon:    parsed.weapon    || weapon  || null,
        power:     parsed.power     || null,
        treatment: parsed.treatment || treatment || null,
      }
    });
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
