export const config = { api: { bodyParser: { sizeLimit: "30mb" } } };

// Multi-card scanner (binder page). For accuracy, the CLIENT slices the page into a grid and sends
// one crop PER card. Each crop is identified as a single card — the same high-detail read the
// single-card scanner does — instead of asking one model call to read nine tiny cards at once.
// Falls back to whole-image multi-detect if the client sends a single image with no crops.
export default async function handler(req, res) {
  if (req.method === "GET") {
    if (req.query && req.query.test) {
      const TINY_JPEG = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 20, messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: TINY_JPEG } },
            { type: "text", text: "Reply with the word OK." },
          ]}]}),
        });
        const bodyText = await r.text();
        return res.status(200).json({ liveTest: true, claudeStatus: r.status, claudeResponse: bodyText.slice(0, 500) });
      } catch (e) { return res.status(200).json({ liveTest: true, fetchError: e.message }); }
    }
    return res.status(200).json({
      ok: true, model: "claude-sonnet-4-6",
      hasApiKey: !!process.env.ANTHROPIC_API_KEY,
      keyPrefix: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.slice(0, 7) + "..." : null,
      deployedAt: "scan-page-v2-crops",
    });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Server missing ANTHROPIC_API_KEY", details: "Set ANTHROPIC_API_KEY in Vercel then redeploy." });
  }

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

  const SINGLE_SYSTEM = `You are a Bo Jackson Battle Arena (BoBA) trading card identifier. You are given a photo of ONE card (a single cell cropped from a binder page). Read its details and return structured JSON. The crop may be angled, glare-y, or slightly cut off - do your best and NEVER invent details you cannot actually see. If the crop is empty (an empty binder pocket, plastic sleeve with no card, or blank), return {"empty":true}.
READ IN THIS PRIORITY ORDER:
1. HERO NAME - most important. Printed large and bold, usually a banner near center/bottom (e.g. "Maverick", "Showtime", "Gaveler", "BoJax"). Read carefully.
2. TREATMENT - variant/finish name, small text near the bottom (e.g. "Base Set", "80's Rad Battlefoil", "Prizm").
3. WEAPON - element by icon/color: Fire (orange/red), Ice (blue), Steel (silver/grey), Brawl (red), Glow (green), Hex (purple), Gum (pink), Metallic (chrome), Alt, Super (gold). One of: Fire, Ice, Steel, Brawl, Glow, Hex, Gum, Metallic, Alt, Super.
4. POWER - a large number, usually top-right (e.g. "135").
5. CARD NUMBER - SMALL, bottom-left corner. Often tiny/blurry. Formats: "1", "TB1", "ALT-4", "PL-59". If unreadable, return null - do NOT guess.
RULES:
- Hero + treatment usually identify the card even without the number. Prioritize those.
- If a field is unreadable, return null for it. If the crop has no card, return {"empty":true}.
- Return ONLY valid JSON, no markdown.
Fields: hero, cardNum, weapon, treatment, power (strings or null), confidence ("high"|"medium"|"low"), visualHints (4-8 keywords).
Example: {"hero":"Showtime","cardNum":"4","weapon":"Ice","treatment":"Base Set","power":"135","confidence":"high","visualHints":"blue ice border, snowflake, holo"}`;

  const identifyOne = async (b64, setName) => {
    const clean = stripPrefix(b64);
    const type = detectType(clean);
    if (!type) return { error: "bad-format" };
    const content = [
      { type: "text", text: "Identify this single BoBA card crop. Read the HERO name first, then treatment, weapon, power, and the small bottom-left number. Return JSON (or {\"empty\":true} if there's no card here)." },
      { type: "image", source: { type: "base64", media_type: type, data: clean } },
    ];
    if (setName) content.push({ type: "text", text: `Context hint: likely from the set "${setName}".` });
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 320, system: SINGLE_SYSTEM, messages: [{ role: "user", content }] }),
    });
    if (!r.ok) { const t = await r.text(); return { error: `claude-${r.status}`, details: t.slice(0, 200) }; }
    const data = await r.json();
    const raw = data.content?.[0]?.text || "{}";
    let parsed = {};
    try { parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()); }
    catch (e) {
      const num = raw.match(/"cardNum"\s*:\s*"([^"]+)"/); const hero = raw.match(/"hero"\s*:\s*"([^"]+)"/);
      if (num) parsed.cardNum = num[1]; if (hero) parsed.hero = hero[1];
    }
    if (parsed.empty) return { empty: true };
    return {
      hero: parsed.hero || null, cardNum: parsed.cardNum || null, weapon: parsed.weapon || null,
      treatment: parsed.treatment || null, power: parsed.power || null,
      confidence: parsed.confidence || null, visualHints: parsed.visualHints || null,
    };
  };

  try {
    const { crops, imageBase64, setName } = req.body;

    // Preferred path: an array of per-card crops. Identify each in parallel, preserving position.
    if (Array.isArray(crops) && crops.length) {
      const settled = await Promise.all(crops.map(async (cropB64, idx) => {
        try {
          const out = await identifyOne(cropB64, setName);
          if (out && !out.error && !out.empty && (out.hero || out.cardNum)) return { position: idx + 1, ...out };
          return null; // empty cell or unreadable -> skip
        } catch (_) { return null; }
      }));
      const cards = settled.filter(Boolean);
      return res.status(200).json({ cards, count: cards.length, mode: "crops", requested: crops.length });
    }

    // Fallback path: a single whole-page image (old behavior) - one call, multi-detect.
    if (imageBase64) {
      const clean = stripPrefix(imageBase64);
      const type = detectType(clean);
      if (!type) return res.status(400).json({ error: "Unsupported image format", details: "Likely HEIC - the app should convert it." });
      const MULTI_SYSTEM = `You identify Bo Jackson Battle Arena (BoBA) trading cards. This photo contains MULTIPLE cards (a binder page or a group laid out). Identify EVERY card and return a JSON ARRAY, one object per card in reading order (left-to-right, top-to-bottom). Skip empty binder pockets. For each: hero, cardNum (bottom-left, null if unreadable - never guess), weapon (Fire/Ice/Steel/Brawl/Glow/Hex/Gum/Metallic/Alt/Super), treatment, power, confidence, visualHints. Return ONLY the JSON array, no markdown.`;
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2400, system: MULTI_SYSTEM, messages: [{ role: "user", content: [
          { type: "text", text: "Identify every BoBA card in this photo. Return a JSON array." },
          { type: "image", source: { type: "base64", media_type: type, data: clean } },
        ]}]}),
      });
      if (!r.ok) { const t = await r.text(); return res.status(r.status).json({ error: `Claude API ${r.status}`, details: t }); }
      const data = await r.json();
      const raw = data.content?.[0]?.text || "[]";
      let arr = [];
      try { const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()); arr = Array.isArray(parsed) ? parsed : (parsed.cards || [parsed]); }
      catch (e) { const m = raw.match(/\[[\s\S]*\]/); if (m) { try { arr = JSON.parse(m[0]); } catch (_) {} } }
      const cards = (arr || []).filter(c => c && (c.hero || c.cardNum)).map((c, i) => ({
        position: Number(c.position) || i + 1, hero: c.hero || null, cardNum: c.cardNum || null,
        weapon: c.weapon || null, treatment: c.treatment || null, power: c.power || null,
        confidence: c.confidence || null, visualHints: c.visualHints || null,
      }));
      return res.status(200).json({ cards, count: cards.length, mode: "whole" });
    }

    return res.status(400).json({ error: "No image data provided" });
  } catch (err) {
    console.error("scan-page handler error:", err);
    return res.status(500).json({ error: err.message });
  }
}
