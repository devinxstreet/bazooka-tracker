export const config = { api: { bodyParser: { sizeLimit: "20mb" } } };
export default async function handler(req, res) {
  // Diagnostic: open https://bazookadash.com/api/scan-card in a browser to check deploy + key
  if (req.method === "GET") {
    // ?test=1 makes a REAL Claude call with a tiny 1x1 red JPEG and returns exactly what Claude says.
    if (req.query && req.query.test) {
      // 1x1 red pixel JPEG, base64 (known-good, ~600 bytes)
      const TINY_JPEG = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 20,
            messages: [{ role: "user", content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: TINY_JPEG } },
              { type: "text", text: "Reply with the word OK." },
            ]}],
          }),
        });
        const bodyText = await r.text();
        return res.status(200).json({ liveTest: true, claudeStatus: r.status, claudeResponse: bodyText.slice(0, 500) });
      } catch (e) {
        return res.status(200).json({ liveTest: true, fetchError: e.message });
      }
    }
    return res.status(200).json({
      ok: true,
      model: "claude-sonnet-4-6",
      hasApiKey: !!process.env.ANTHROPIC_API_KEY,
      keyPrefix: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.slice(0, 7) + "..." : null,
      deployedAt: "scan-magicbytes-v4",
    });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Server missing ANTHROPIC_API_KEY", details: "Set ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables, then redeploy." });
  }
  try {
    const { imageBase64, cornerBase64, mediaType, setName, treatment, weapon } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "No image data provided" });
    // Strip any data-URI prefix the client may have left on ("data:image/jpeg;base64,....")
    const stripPrefix = (b64) => {
      if (!b64) return b64;
      const comma = b64.indexOf(",");
      if (b64.slice(0, 5) === "data:" && comma > -1) return b64.slice(comma + 1);
      return b64;
    };
    // Detect the REAL image format from the first bytes of the base64 (magic bytes),
    // instead of trusting the declared mediaType. This is the #1 cause of Claude 400s.
    const detectType = (b64) => {
      if (!b64) return null;
      const head = b64.slice(0, 24);
      if (head.startsWith("/9j/")) return "image/jpeg";        // JPEG
      if (head.startsWith("iVBORw0KGgo")) return "image/png";  // PNG
      if (head.startsWith("R0lGOD")) return "image/gif";       // GIF
      if (head.startsWith("UklGR")) return "image/webp";       // WEBP (RIFF)
      return null; // unknown / unsupported (e.g. HEIC)
    };
    const cleanImage  = stripPrefix(imageBase64);
    const cleanCorner = stripPrefix(cornerBase64);
    const detected = detectType(cleanImage);
    if (!detected) {
      return res.status(400).json({
        error: "Unsupported image format",
        details: "That photo isn't a JPEG/PNG/GIF/WEBP (likely HEIC from an iPhone). The app should convert it — try again or take a fresh photo.",
      });
    }
    const finalMediaType = detected;
    const cornerType = detectType(cleanCorner) || finalMediaType;
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
        source: { type: "base64", media_type: finalMediaType, data: cleanImage },
      },
    ];
    // Optional zoomed bottom-left corner crop to help read the tiny card number
    if (cleanCorner) {
      userContent.push({ type: "text", text: "ZOOMED-IN bottom-left corner (use this to read the small card number):" });
      userContent.push({
        type: "image",
        source: { type: "base64", media_type: cornerType, data: cleanCorner },
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
