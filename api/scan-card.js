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

  const { imageBase64, mediaType, treatment, weapon, setName } = body || {};
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "No API key configured" });

  // Determine media type — default to jpeg for PDF-rendered pages, webp for direct uploads
  const imageMediaType = mediaType || "image/jpeg";

  const hint = [
    setName    ? `This card is from the "${setName}" set.` : "",
    treatment  ? `Treatment: "${treatment}".` : "",
    weapon     ? `Weapon type: "${weapon}".` : "",
  ].filter(Boolean).join(" ");

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
        max_tokens: 300,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: imageMediaType, data: imageBase64 }
            },
            {
              type: "text",
              text: `This is a Bo Jackson Battle Arena (BoBA) trading card. ${hint}
Look carefully at the BOTTOM of the card for the card number (e.g. BFA-61, PL-12, HTD-40, A-5 — always includes a prefix).
Look at the TOP LEFT for the hero/character name exactly as printed.
Look at the TOP RIGHT for the power number.
Look at the weapon symbol or label for the weapon type.
Look for the treatment name (e.g. "Inspired Ink", "Base Set", "Great Grandma's Lino", "Alpha Battlefoil").
Also describe the card's VISUAL APPEARANCE in 6-10 keywords: background texture, dominant colors, border style, art style, pattern (e.g. "linoleum cracked floor pink purple retro vintage", "holographic foil rainbow metallic shimmer", "watercolor brushstroke blue green", "comic dots halftone yellow orange").

Return ONLY a JSON object, no markdown, no explanation:
{"cardNum":"exact card number as printed at bottom (e.g. BFA-61)","hero":"exact hero name from top left","weapon":"Fire/Ice/Steel/Brawl/Glow/Hex/Gum/Super/Alt/Metallic","power":"number only","treatment":"treatment name if visible","visualHints":"6-10 keywords describing visual appearance"}
If card is not readable return {"cardNum":null}`
            }
          ]
        }]
      })
    });
  } catch(fetchErr) {
    return res.status(500).json({ error: "Fetch failed: " + fetchErr.message });
  }

  let data;
  try { data = await anthropicResponse.json(); } catch(e) {
    return res.status(500).json({ error: "JSON parse failed" });
  }

  if (!anthropicResponse.ok) {
    return res.status(500).json({ error: "Anthropic error", details: data });
  }

  try {
    const text = data.content?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    // Return both flat (new) and nested identified (legacy PDF scanner)
    const result = {
      cardNum:      parsed.cardNum      || null,
      hero:         parsed.hero         || null,
      weapon:       parsed.weapon       || weapon  || null,
      power:        parsed.power        || null,
      treatment:    parsed.treatment    || treatment || null,
      visualHints:  parsed.visualHints  || null,
    };
    return res.status(200).json({ ...result, identified: result });
  } catch(parseErr) {
    return res.status(200).json({ cardNum: null, identified: { cardNum: null }, error: "parse failed" });
  }
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: "15mb" } },
};
