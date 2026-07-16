export const config = { api: { bodyParser: { sizeLimit: "20mb" } } };

// Multi-card scanner: takes ONE photo of several cards (a binder page, a loose stack laid out,
// cards on a table) and returns an ARRAY of detected cards. Mirrors /api/scan-card's hardened
// image handling (magic-byte detection, prefix stripping, real-status passthrough) but asks Claude
// to find every card in the frame instead of one.
export default async function handler(req, res) {
  // Diagnostic: open https://bazookadash.com/api/scan-page in a browser to check deploy + key.
  if (req.method === "GET") {
    if (req.query && req.query.test) {
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
      deployedAt: "scan-page-v1",
    });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Server missing ANTHROPIC_API_KEY", details: "Set ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables, then redeploy." });
  }

  try {
    const { imageBase64, mediaType, setName } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "No image data provided" });

    const stripPrefix = (b64) => {
      if (!b64) return b64;
      const comma = b64.indexOf(",");
      if (b64.slice(0, 5) === "data:" && comma > -1) return b64.slice(comma + 1);
      return b64;
    };
    const detectType = (b64) => {
      if (!b64) return null;
      const head = b64.slice(0, 24);
      if (head.startsWith("/9j/")) return "image/jpeg";
      if (head.startsWith("iVBORw0KGgo")) return "image/png";
      if (head.startsWith("R0lGOD")) return "image/gif";
      if (head.startsWith("UklGR")) return "image/webp";
      return null;
    };

    const cleanImage = stripPrefix(imageBase64);
    const detected = detectType(cleanImage);
    if (!detected) {
      return res.status(400).json({
        error: "Unsupported image format",
        details: "That photo isn't a JPEG/PNG/GIF/WEBP (likely HEIC from an iPhone). The app should convert it — try again or take a fresh photo.",
      });
    }
    const finalMediaType = detected;

    const systemPrompt = `You are a Bo Jackson Battle Arena (BoBA) trading card identifier. You are given ONE photo that contains MULTIPLE cards — for example a binder page (often a 3x3 grid of 9 cards), a loose stack laid out, or several cards arranged on a table. Identify EVERY card you can see and return them as a JSON ARRAY.

For EACH card, read details in this priority order:
1. HERO NAME — the single most important field. Printed large and bold, usually a banner near the center or bottom (e.g. "Maverick", "Showtime", "Gaveler", "BoJax"). Read it carefully even in bad photos.
2. TREATMENT — the variant/finish name, small text near the bottom (e.g. "Base Set", "80's Rad Battlefoil", "Prizm"). Read if you can.
3. WEAPON — element/weapon by icon and color: Fire (orange/red), Ice (blue), Steel (silver/grey), Brawl (red), Glow (green), Hex (purple), Gum (pink), Metallic (chrome), Alt, Super (gold). One of: Fire, Ice, Steel, Brawl, Glow, Hex, Gum, Metallic, Alt, Super.
4. POWER — a large number, usually top-right (e.g. "135", "160").
5. CARD NUMBER — SMALL, in the BOTTOM-LEFT corner of each card. Often tiny/blurry in a multi-card photo. Formats look like "1", "TB1", "ALT-4", "PL-59". If you genuinely cannot read it, return null — do NOT guess.

RULES:
- Return one object PER card, left-to-right, top-to-bottom (reading order).
- Include EVERY distinct card you can see, even partially visible ones at the edges (mark low confidence).
- Empty binder pockets / blank slots are NOT cards — skip them.
- Hero name + treatment usually identify a card even without the number. Prioritize those over guessing the number.
- If a field is unreadable for a card, return null for that field rather than guessing.
- Return ONLY a valid JSON array. No markdown, no explanation, no wrapping object.

Each array element has these fields:
- position: reading-order index starting at 1 (number)
- hero: hero name (string or null)
- cardNum: bottom-left card number (string or null — null if unreadable, never guess)
- weapon: one of the weapon types above (string or null)
- treatment: treatment/variant name (string or null)
- power: power number (string or null)
- confidence: confidence the HERO is correct, "high" | "medium" | "low"
- visualHints: 4-8 keywords about colors, foil, pattern, background art

Example output:
[{"position":1,"hero":"Showtime","cardNum":"4","weapon":"Ice","treatment":"Base Set","power":"135","confidence":"high","visualHints":"blue ice border, snowflake, holo"},{"position":2,"hero":"Maverick","cardNum":null,"weapon":"Fire","treatment":"Base Set","power":"140","confidence":"medium","visualHints":"orange flame border, dark bg"}]`;

    const userContent = [
      { type: "text", text: "Photo containing multiple BoBA cards. Identify EVERY card and return a JSON array, one object per card in reading order (left-to-right, top-to-bottom):" },
      { type: "image", source: { type: "base64", media_type: finalMediaType, data: cleanImage } },
    ];
    if (setName) {
      userContent.push({ type: "text", text: `Context hint: these cards are likely from the set "${setName}". Return the JSON array.` });
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
        // Up to ~20 cards × ~90 tokens each, plus slack. Keeps a full binder page well within budget.
        max_tokens: 2400,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Claude API error:", response.status, errText);
      return res.status(response.status).json({ error: `Claude API ${response.status}`, details: errText });
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || "[]";

    // Parse the array — strip accidental markdown fences, tolerate a wrapping object.
    let cards = [];
    try {
      let clean = rawText.replace(/```json|```/g, "").trim();
      // If the model wrapped it like {"cards":[...]}, dig the array out.
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed)) cards = parsed;
      else if (parsed && Array.isArray(parsed.cards)) cards = parsed.cards;
      else if (parsed && typeof parsed === "object") cards = [parsed]; // single object fallback
    } catch (e) {
      console.error("JSON parse error:", e, "Raw:", rawText.slice(0, 400));
      // Last resort: pull the first [...] block out of the text.
      const m = rawText.match(/\[[\s\S]*\]/);
      if (m) { try { cards = JSON.parse(m[0]); } catch (_) { cards = []; } }
    }

    // Normalize every element to the exact shape the client expects.
    const clean = (cards || [])
      .filter((c) => c && (c.hero || c.cardNum))
      .map((c, i) => ({
        position:    Number(c.position) || i + 1,
        hero:        c.hero        || null,
        cardNum:     c.cardNum     || null,
        weapon:      c.weapon      || null,
        treatment:   c.treatment   || null,
        power:       c.power       || null,
        confidence:  c.confidence  || null,
        visualHints: c.visualHints || null,
      }));

    return res.status(200).json({ cards: clean, count: clean.length });
  } catch (err) {
    console.error("scan-page handler error:", err);
    return res.status(500).json({ error: err.message });
  }
}
