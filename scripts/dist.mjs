// Đóng gói bản phát hành chạy được (Ticket-04, mục 5): dist/dao-den-long-v<phiên bản>.zip
// Gồm thư mục web tĩnh, lõi game, server.js và thư viện three.js, KHÔNG cần npm install. Người dùng: giải nén, `node server.js`, mở http://localhost:5173.
// Dùng: npm run dist
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const name = `dao-den-long-v${pkg.version}`;
const stage = join("dist", "stage");
const root = join(stage, name);
rmSync("dist", { recursive: true, force: true });
mkdirSync(root, { recursive: true });

const copy = (from, to = from) => {
  if (!existsSync(from)) throw new Error(`thiếu ${from}`);
  cpSync(from, join(root, to), { recursive: true });
};
copy("web");
copy("src/core");
copy("src/headless/leaderboard-store.js");
copy("server.js");
copy("LICENSE");
copy("CREDITS.md");
copy("game.contract.json");
copy("node_modules/three/build/three.module.js");
copy("node_modules/three/package.json");
copy("node_modules/three/LICENSE");
writeFileSync(join(root, "package.json"), JSON.stringify({ name: pkg.name, version: pkg.version, private: true, type: "module", scripts: { start: "node server.js" }, license: pkg.license }, null, 2) + "\n");
writeFileSync(
  join(root, "HUONG-DAN-CHAY.txt"),
  `Dao Den Long v${pkg.version} (ban chay duoc, khong can npm install)

Yeu cau: Node.js 20 tro len (https://nodejs.org), mot trinh duyet hien dai co WebGL (Chrome, Edge, Firefox).

Cach chay (3 buoc):
  1. Giai nen file zip nay.
  2. Mo terminal trong thu muc vua giai nen.
  3. Chay:  node server.js   roi mo http://localhost:5173 tren trinh duyet.

Xuat bang xep hang:  node server.js --export-leaderboard out.json
Diem so duoc luu trong thu muc data/ (tu tao khi luu diem dau tien).
Ma nguon day du, test va bang chung: xem repo GitHub cua du an.
`
);

const zip = join("dist", `${name}.zip`);
let r = spawnSync("tar", ["-a", "-c", "-f", zip, "-C", stage, name], { stdio: "inherit" }); // Windows 10+ và macOS có bsdtar, ghi được zip
if (r.status !== 0) r = spawnSync("zip", ["-r", join("..", `${name}.zip`), name], { cwd: stage, stdio: "inherit" });
if (r.status !== 0) {
  process.stderr.write("Loi: khong tao duoc file zip (can lenh tar -a hoac zip)\n");
  process.exit(1);
}
rmSync(stage, { recursive: true, force: true });
console.log(`Da tao ${zip}`);
