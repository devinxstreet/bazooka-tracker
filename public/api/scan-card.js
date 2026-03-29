export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
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
              text: `This is a Bo Jackson Battle Arena (BoBA) trading card. Extract ONLY these fields as JSON with no other text:\n{"cardNum":"the card number (e.g. 1, 42, P-5)","hero":"hero name","weapon":"weapon type (Fire/Ice/Steel/Brawl/Glow/Hex/Gum/Super/Alt/Metallic)","treatment":"card treatment/set name"}\nIf you cannot read the card clearly, return {"cardNum":null}`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const identified = JSON.parse(clean);
    res.status(200).json({ identified });
  } catch (e) {
    console.error("scan-card error:", e);
    res.status(500).json({ error: e.message, identified: null });
  }
}
