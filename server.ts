import fs from "node:fs";
import { createServer } from "node:https";
import path from "path";

const MIME_TYPES: { [key: string]: string } = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".woff": "application/font-woff",
  ".ttf": "application/font-ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "application/font-otf",
  ".wasm": "application/wasm",
};

import WSS from "./wsserver.ts";

const pem = fs.readFileSync("_cert.pem", "utf8");
const keyMatch = pem.match(
  /-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA )?PRIVATE KEY-----/,
);

const certMatch = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);

if (!keyMatch || !certMatch) {
  throw new Error("Missing private key or certificate");
}

const PUBLIC_DIR = path.resolve("./client");
const server = createServer(
  {
    key: keyMatch[0],
    cert: certMatch[0],
  },
  (req, res) => {
    // 1. Determine the path of the requested file

    // @ts-expect-error
    const safeUrl = req.url.split("?")[0]; // Strip query parameters
    let filePath = path.join(PUBLIC_DIR, safeUrl);

    // 2. Default to index.html if a directory root is requested
    if (safeUrl === "/" || safeUrl.endsWith("/")) {
      filePath = path.join(filePath, "index.html");
    }

    // 3. Prevent Directory Traversal attacks (security)
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      return res.end("403 Forbidden");
    }

    // 4. Look up file extension and read file
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code === "ENOENT") {
          // File not found
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("404 Not Found");
        } else {
          // Server error
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end(`500 Internal Server Error: ${error.code}`);
        }
      } else {
        // Success
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content, "utf-8");
      }
    });
  },
);

WSS(server);

server.listen(process.env.PORT || 8443, () => {
  console.log(`Server is listening on port ${process.env.PORT || 8443}`);
});
