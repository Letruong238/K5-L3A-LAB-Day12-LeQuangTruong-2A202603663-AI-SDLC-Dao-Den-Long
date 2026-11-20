// Server tĩnh rất nhỏ để chơi game trên trình duyệt: `npm start` rồi mở http://localhost:5173
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.env.PORT) || 5173;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css" };
// Chỉ phục vụ các thư mục cần cho game, không lộ file khác của repo.
const allowed = ["web", "src/core", "node_modules/three/build", "node_modules/three/examples/jsm"];

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path === "/") path = "/web/index.html";
    const file = resolve(join(root, normalize(path)));
    const rel = file.slice(root.length + 1).split(sep).join("/");
    if (!file.startsWith(root + sep) || !allowed.some((d) => rel.startsWith(d + "/"))) {
      res.writeHead(404).end("Not found");
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" }).end(data);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, () => console.log(`Dao Den Long dang chay: http://localhost:${port}`));
