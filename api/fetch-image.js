// api/fetch-image.js
//
// Drag-an-image-from-another-tab support.
//
// When you drag a picture out of a browser tab, the browser hands over a URL rather than a file,
// because the image lives on a remote server. The page can try to fetch that URL itself, but most
// sites refuse cross-origin reads, so the browser blocks it. This endpoint does the fetch from the
// server, where CORS does not apply, and streams the bytes back.
//
// Deploy: save as `api/fetch-image.js` in the repo root (Vercel picks up /api automatically).

const MAX_BYTES = 15 * 1024 * 1024;   // refuse anything absurd
const TIMEOUT_MS = 15000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST only" });
  }

  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url required" });
  }

  // Only ever fetch plain web URLs. Without this check the endpoint would happily retrieve
  // file://, and internal addresses reachable from the server but not from the internet —
  // a classic SSRF hole that turns a convenience feature into a way to read private services.
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: "not a valid url" });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return res.status(400).json({ error: "only http and https are allowed" });
  }
  const host = parsed.hostname.toLowerCase();
  const isPrivate =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||          // cloud metadata endpoints live here
    host === "[::1]";
  if (isPrivate) {
    return res.status(400).json({ error: "that address is not allowed" });
  }

  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(parsed.toString(), {
      signal: control.signal,
      redirect: "follow",
      headers: {
        // Some CDNs serve a placeholder or 403 to clients that look like bots.
        "User-Agent": "Mozilla/5.0 (compatible; BazookaDash/1.0)",
        "Accept": "image/*,*/*;q=0.8",
        "Referer": parsed.origin + "/",
      },
    });

    if (!upstream.ok) {
      return res.status(502).json({ error: `source returned ${upstream.status}` });
    }

    const type = (upstream.headers.get("content-type") || "").toLowerCase();
    if (!type.startsWith("image/")) {
      // A login wall or error page would otherwise be uploaded as if it were card art.
      return res.status(415).json({ error: `that link is ${type || "not an image"}` });
    }

    const declared = parseInt(upstream.headers.get("content-length") || "0", 10);
    if (declared && declared > MAX_BYTES) {
      return res.status(413).json({ error: "image is too large" });
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    // Re-check after download: content-length is advisory and may be absent or wrong.
    if (buf.length > MAX_BYTES) {
      return res.status(413).json({ error: "image is too large" });
    }

    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buf);
  } catch (err) {
    const msg = err?.name === "AbortError" ? "the source took too long" : (err?.message || "fetch failed");
    return res.status(502).json({ error: msg });
  } finally {
    clearTimeout(timer);
  }
}
