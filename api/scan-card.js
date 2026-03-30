export const config = { api: { bodyParser: { sizeLimit: "20mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { imageBase64, mediaType, setName, treatment, weapon } = req.body;

    if (!imageBase64) return res.status(400).json({ error: "No image data provided" });

    // Claude Vision only supports these media types — convert anything else to jpeg label
    const SUPPORTED = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    let finalMediaType = (mediaType || "image/jpeg").toLowerCase();

    // Strip any parameters (e.g. "image/jpeg;base64" -> "image/jpeg")
    finalMediaType = finalMediaType.split(";")[0].trim();

    // If unsupported type, default to jpeg (the base64 data is what matters)
    if (!SUPPORTED.includes(finalMediaType)) {
      finalMediaType = "image/jpeg";
    }

    const systemPrompt = `You are a Bo Jackson Battle Arena (BoBA) trading card identifier. 
Your job is to read card details from images and return structured JSON.

Always return valid JSON with these fields:
- cardNum: the card number (e.g. "1", "ALT-4", "PL-59", "RAD-1") — look for # symbol or number in corner
- hero: the hero name printed on the card (e.g. "Maverick", "Showtime", "Gaveler")
- weapon: the weapon type (Fire, Ice, Steel, Brawl, Glow, Hex, Gum, Metallic, Alt, Super)
- treatment: the card treatment/variant (e.g. "Base Set", "80's Rad Battlefoil", "Prizm")
- power: the power number (e.g. "135", "130", "160")
- visualHints: 6-10 descriptive keywords about the card's visual appearance, colors, patterns, foil type, background art

Return ONLY valid JSON, no markdown, no explanation.
Example: {"cardNum":"4","hero":"Showtime","weapon":"Ice","treatment":"Base Set","power":"135","visualHints":"blue ice border, dark background, snowflake pattern, holographic sheen, portrait pose"}`;

    const userContent = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: finalMediaType,
          data: imageBase64,
        },
      },
    ];

    // Add context hints if provided
    const contextParts = [];
    if (setName)   contextParts.push(`Set: ${setName}`);
    if (treatment) contextParts.push(`Treatment: ${treatment}`);
    if (weapon)    contextParts.push(`Weapon: ${weapon}`);
    if (contextParts.length > 0) {
      userContent.push({ type: "text", text: `Context: ${contextParts.join(", ")}. Identify the card and return JSON.` });
    } else {
      userContent.push({ type: "text", text: "Identify this BoBA card and return JSON with cardNum, hero, weapon, treatment, power, and visualHints." });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Claude API error:", response.status, errText);
      return res.status(500).json({ error: `Claude API ${response.status}`, details: errText });
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || "{}";

    // Parse JSON — strip any accidental markdown fences
    let parsed = {};
    try {
      const clean = rawText.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error("JSON parse error:", e, "Raw:", rawText);
      // Try to extract what we can
      const numMatch  = rawText.match(/"cardNum"\s*:\s*"([^"]+)"/);
      const heroMatch = rawText.match(/"hero"\s*:\s*"([^"]+)"/);
      if (numMatch)  parsed.cardNum = numMatch[1];
      if (heroMatch) parsed.hero    = heroMatch[1];
    }

    return res.status(200).json({
      cardNum:      parsed.cardNum     || null,
      hero:         parsed.hero        || null,
      weapon:       parsed.weapon      || null,
      treatment:    parsed.treatment   || null,
      power:        parsed.power       || null,
      visualHints:  parsed.visualHints || null,
      identified:   parsed,
    });

  } catch (err) {
    console.error("scan-card handler error:", err);
    return res.status(500).json({ error: err.message });
  }
}
