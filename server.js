// Server nhỏ để chơi game trên trình duyệt: `npm start` rồi mở http://localhost:5173
// Ngoài file tĩnh còn có API bảng xếp hạng (lưu ra đĩa) và nhận kết quả benchmark.
// Lệnh xuất bảng xếp hạng (không bật server): npm start -- --export-leaderboard out.json
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { exportLeaderboard, loadEntries, submitScore } from "./src/headless/leaderboard-store.js";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css" };
// Chỉ phục vụ các thư mục cần cho game, không lộ file khác của repo.
const allowed = ["web", "src/core", "node_modules/three/build", "node_modules/three/examples/jsm"];

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("body quá lớn"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const json = (res, code, obj) => res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(obj));

// onBenchResult: hàm gọi khi trang benchmark gửi kết quả về (scripts/bench.mjs dùng).
export function startServer({ port = 5173, onBenchResult = null } = {}) {
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (path === "/api/leaderboard") {
        if (req.method === "GET") return json(res, 200, { entries: loadEntries() });
        if (req.method === "POST") {
          let data;
          try {
            data = JSON.parse(await readBody(req));
          } catch {
            return json(res, 400, { error: "JSON không hợp lệ" });
          }
          try {
            const { entries, rank, entry } = submitScore({ name: data.name, score: data.score, nights_won: data.nights_won, seed: data.seed });
            return json(res, 200, { entries, rank, entry });
          } catch (e) {
            return json(res, 400, { error: e.message });
          }
        }
        return json(res, 405, { error: "chỉ hỗ trợ GET và POST" });
      }
      if (path === "/api/bench-result" && req.method === "POST") {
        if (!onBenchResult) return json(res, 404, { error: "không ở chế độ benchmark" });
        onBenchResult(JSON.parse(await readBody(req)));
        return json(res, 200, { ok: true });
      }
      const rel0 = path === "/" ? "/web/index.html" : path;
      const file = resolve(join(root, normalize(rel0)));
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
  });
  return new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(port, () => ok(server));
  });
}

// Chỉ chạy khi gọi trực tiếp (`node server.js`), không chạy khi được import.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const i = args.indexOf("--export-leaderboard");
  if (i >= 0) {
    const out = args[i + 1];
    if (!out) {
      process.stderr.write("Loi: thieu duong dan sau --export-leaderboard\n");
      process.exit(1);
    }
    try {
      exportLeaderboard(out);
      process.exit(0);
    } catch (e) {
      process.stderr.write(`Loi: ${e.message}\n`);
      process.exit(1);
    }
  } else {
    const port = Number(process.env.PORT) || 5173;
    startServer({ port })
      .then(() => console.log(`Dao Den Long dang chay: http://localhost:${port}`))
      .catch((e) => {
        process.stderr.write(`Loi: khong mo duoc cong ${port}: ${e.message}\n`);
        process.exit(1);
      });
  }
}
