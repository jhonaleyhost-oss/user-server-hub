// Austin Pay relay — jalankan di VPS ber-IP statis (IP ini yang di-whitelist Austin).
// Jalankan: PROXY_TOKEN=xxxx node server.js   (default port 8787)
const http = require("http");
const https = require("https");

const TOKEN = process.env.PROXY_TOKEN || "";
const PORT = Number(process.env.PORT || 8787);
const HOST = "austinstore.id";

const server = http.createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405).end("Method Not Allowed");
    return;
  }
  if (TOKEN && req.headers["x-proxy-token"] !== TOKEN) {
    res.writeHead(401).end("Unauthorized");
    return;
  }
  let raw = "";
  req.on("data", (c) => {
    raw += c;
    if (raw.length > 1e6) req.destroy();
  });
  req.on("end", () => {
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      res.writeHead(400).end("Bad JSON");
      return;
    }
    const { method = "GET", path = "/", headers = {}, body = "" } = payload;
    if (!String(path).startsWith("/api/")) {
      res.writeHead(400).end("Path not allowed");
      return;
    }
    const upstream = https.request(
      {
        host: HOST,
        port: 443,
        path,
        method,
        family: 4, // paksa IPv4
        headers: {
          ...headers,
          Host: HOST,
          "Content-Length": Buffer.byteLength(body || ""),
        },
      },
      (up) => {
        let out = "";
        up.on("data", (c) => (out += c));
        up.on("end", () => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: up.statusCode, body: out }));
        });
      },
    );
    upstream.on("error", (e) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: 502, body: JSON.stringify({ success: false, message: String(e) }) }));
    });
    if (body) upstream.write(body);
    upstream.end();
  });
});

server.listen(PORT, () => console.log(`austin-proxy listening on :${PORT}`));
