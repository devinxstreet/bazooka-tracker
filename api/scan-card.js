module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch(e) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }

  const { imageBase64 } = body || {};
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured", identified: null });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
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

    const rawText = await response.text();
    console.log("Anthropic raw:", rawText.slice(0, 200));

    let data;
    try { data = JSON.parse(rawText); } catch(e) {
      return res.status(500).json({ error: "Anthropic returned invalid JSON: " + rawText.slice(0, 100), identified: null });
    }

    if (data.error) {
      return res.status(500).json({ error: data.error.message, identified: null });
    }

    const text = data.content?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const identified = JSON.parse(clean);
    return res.status(200).json({ identified });
  } catch (e) {
    console.error("scan-card error:", e.message);
    return res.status(500).json({ error: e.message, identified: null });
  }
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: "10mb" } }
};
