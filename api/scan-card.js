export const config = { api: { bodyParser: { sizeLimit: "20mb" } } };

export default async function handler(req, res) {
  // Diagnostic: open https://bazookadash.com/api/scan-card in a browser to check deploy + key
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      model: "claude-sonnet-4-6",
      hasApiKey: !!process.env.ANTHROPIC_API_KEY,
      keyPrefix: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.slice(0, 7) + "..." : null,
      deployedAt: "scan-sonnet-4-6-v2",
    });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Server missing ANTHROPIC_API_KEY", details: "Set ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables, then redeploy." });
  }

  try {
    const { imageBase64, cornerBase64, mediaType, setName, treatment, weapon } = req.body;

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

    const systemPrompt = `You are a Bo Jackson Battle Arena (BoBA) trading card identifier. You read details from photos of cards and return structured JSON. Photos may be angled, glare-y, blurry, or imperfect — do your best and NEVER invent details you cannot actually see.

READ THE CARD IN THIS PRIORITY ORDER:
1. HERO NAME — this is the single most important field. It is printed large and bold, usually across the card (often a banner near the center or bottom). It is big and readable even in bad photos. Always read it carefully. (e.g. "Maverick", "Showtime", "Gaveler", "BoJax")
2. TREATMENT — the variant/finish name, usually in small text near the bottom (e.g. "Base Set", "80's Rad Battlefoil", "Prizm", "Sort Thumbs"). Read it if you can.
3. WEAPON — the element/weapon type, shown by an icon and color theme: Fire (orange/red), Ice (blue), Steel (silver/grey), Brawl (red), Glow (green), Hex (purple), Gum (pink), Metallic (chrome), Alt, Super (gold). One of: Fire, Ice, Steel, Brawl, Glow, Hex, Gum, Metallic, Alt, Super.
4. POWER — a large number, usually top-right (e.g. "135", "160").
5. CARD NUMBER — SMALL, printed in the BOTTOM-LEFT corner. Often tiny and can be blurry. A SECOND zoomed-in image of the bottom-left corner may be provided — use it to read this number. Formats look like "1", "TB1", "ALT-4", "PL-59", "RAD-1", "EPR1". If you genuinely cannot read it, return null — do NOT guess.

RULES:
- Hero name + treatment together usually identify the card even without the number. Prioritize getting those right over guessing the number.
- If a field is unreadable, return null for it rather than guessing.
- Return ONLY valid JSON. No markdown, no explanation.

Fields:
- hero: hero name (string or null)
- cardNum: bottom-left card number (string or null — null if unreadable, never guess)
- weapon: one of the weapon types above (string or null)
- treatment: treatment/variant name (string or null)
- power: power number (string or null)
- confidence: confidence the HERO is correct, "high" | "medium" | "low"
- visualHints: 6-10 keywords about colors, foil, pattern, background art

Example: {"hero":"Showtime","cardNum":"4","weapon":"Ice","treatment":"Base Set","power":"135","confidence":"high","visualHints":"blue ice border, dark background, snowflake pattern, holographic sheen, portrait pose"}`;

    const userContent = [
      { type: "text", text: "FULL CARD photo:" },
      {
        type: "image",
        source: { type: "base64", media_type: finalMediaType, data: imageBase64 },
      },
    ];

    // Optional zoomed bottom-left corner crop to help read the tiny card number
    if (cornerBase64) {
      userContent.push({ type: "text", text: "ZOOMED-IN bottom-left corner (use this to read the small card number):" });
      userContent.push({
        type: "image",
        source: { type: "base64", media_type: finalMediaType, data: cornerBase64 },
      });
    }

    // Add context hints if provided
    const contextParts = [];
    if (setName)   contextParts.push(`Set: ${setName}`);
    if (treatment) contextParts.push(`Treatment: ${treatment}`);
    if (weapon)    contextParts.push(`Weapon: ${weapon}`);
    if (contextParts.length > 0) {
      userContent.push({ type: "text", text: `Context hint: ${contextParts.join(", ")}. Identify the card and return JSON. Prioritize reading the HERO name first.` });
    } else {
      userContent.push({ type: "text", text: "Identify this BoBA card. Read the HERO name first (large/bold), then treatment, weapon, power, and finally the small bottom-left card number. Return JSON." });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 320,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Claude API error:", response.status, errText);
      // Pass the real status + Claude's message through so the app can show what's wrong
      return res.status(response.status).json({ error: `Claude API ${response.status}`, details: errText });
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
      confidence:   parsed.confidence  || null,
      visualHints:  parsed.visualHints || null,
      identified:   parsed,
    });

  } catch (err) {
    console.error("scan-card handler error:", err);
    return res.status(500).json({ error: err.message });
  }
}
