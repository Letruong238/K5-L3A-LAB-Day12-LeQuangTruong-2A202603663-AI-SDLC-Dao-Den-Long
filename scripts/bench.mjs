// Chế độ benchmark (Ticket-04, mục 1).
// Dùng: node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
// Mở bản web (cảnh chuẩn: /?bench=1) trong Chrome cửa sổ 1280x720 (không toàn màn hình), tắt vsync, 3 s khởi động rồi đo --duration giây,
// ghi bench.json và tự thoát mã 0. Cần Chrome hoặc Edge (Chromium); chỉ đường dẫn bằng biến CHROME_PATH nếu không tự tìm thấy.
// Nếu cửa sổ ngừng vẽ giữa chừng (ví dụ cửa sổ bị ẩn), script tự chạy lại bằng Chrome ngầm (--headless=new) vẫn dùng GPU thật,
// và ghi chế độ đã dùng vào trường "renderer". Biến môi trường: BENCH_MODE=window|headless-gpu|headless-cpu (ép chế độ; headless-cpu chỉ để thử đường ống).
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { startServer } from "../server.js";

function usage(msg) {
  process.stderr.write(`Loi: ${msg}\nDung: node scripts/bench.mjs --seed 42 --duration 30 --out bench.json\n`);
  process.exit(1);
}
const opts = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) {
  if (!argv[i].startsWith("--") || argv[i + 1] === undefined) usage(`tham so sai: ${argv[i]}`);
  opts[argv[i].slice(2)] = argv[i + 1];
}
const seed = Number(opts.seed ?? 42);
const duration = Number(opts.duration ?? 30);
if (!Number.isInteger(seed)) usage("--seed phai la so nguyen");
if (!(duration > 0)) usage("--duration phai la so duong (giay)");
if (!opts.out) usage("thieu --out");
const forced = process.env.BENCH_MODE;
if (forced && !["window", "headless-gpu", "headless-cpu"].includes(forced)) usage("BENCH_MODE phai la window, headless-gpu hoac headless-cpu");

function findChrome() {
  const env = process.env.CHROME_PATH;
  if (env) return existsSync(env) ? env : usage(`CHROME_PATH khong ton tai: ${env}`);
  const pf = process.env.PROGRAMFILES ?? "C:\\Program Files";
  const pf86 = process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)";
  const local = process.env.LOCALAPPDATA ?? "";
  const candidates = [
    `${pf}\\Google\\Chrome\\Application\\chrome.exe`, `${pf86}\\Google\\Chrome\\Application\\chrome.exe`, `${local}\\Google\\Chrome\\Application\\chrome.exe`,
    `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`, `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium",
  ];
  return candidates.find((c) => c && existsSync(c)) ?? usage("khong tim thay Chrome/Edge. Dat bien CHROME_PATH tro toi file chay cua trinh duyet");
}

// Tổng bộ nhớ làm việc (MB) của mọi tiến trình trình duyệt thuộc thư mục hồ sơ riêng của lần đo này (browser + renderer + GPU).
// Lưu ý: cộng cả trang nhớ dùng chung giữa các tiến trình nên nhỉnh hơn RSS thật một chút.
function browserMemMb(profileDir) {
  try {
    if (process.platform === "win32") {
      const ps = `(Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${profileDir.replaceAll("'", "''")}*' } | Measure-Object -Property WorkingSetSize -Sum).Sum`;
      const out = execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps], { encoding: "utf8", timeout: 15000 }).trim();
      return out ? Number(out) / 1048576 : null;
    }
    const out = execFileSync("ps", ["-eo", "rss=,args="], { encoding: "utf8", timeout: 15000 });
    const kb = out.split("\n").filter((l) => l.includes(profileDir)).reduce((a, l) => a + Number(l.trim().split(/\s+/)[0]), 0);
    return kb ? kb / 1024 : null;
  } catch {
    return null;
  }
}

const chrome = findChrome();

// Một lần đo trong một chế độ. Trả về { result, peak, launchEpoch } hoặc { failed: lý do }.
async function attempt(mode) {
  const profile = mkdtempSync(join(os.tmpdir(), "ddl-bench-"));
  let lastBeat = Date.now();
  let progress = null;
  let heartbeat = null;
  let resolveResult;
  const gotResult = new Promise((r) => (resolveResult = r));
  const server = await startServer({
    port: 0,
    onBenchResult: (r) => {
      if (r.heartbeat) {
        heartbeat = r; // nhịp tim phụ để chẩn đoán, không tính là tiến triển
        return;
      }
      lastBeat = Date.now();
      if (r.progress !== undefined) progress = r; // tín hiệu còn sống, chưa phải kết quả
      else resolveResult(r);
    },
  });
  const url = `http://127.0.0.1:${server.address().port}/?bench=1&seed=${seed}&duration=${duration}`;
  const flags = [
    `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-sync",
    "--window-size=1280,720", "--window-position=0,0",
    "--disable-gpu-vsync", "--disable-frame-rate-limit", // tắt vsync, bỏ giới hạn tốc độ khung hình của Chrome
    "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
    "--disable-features=CalculateNativeWinOcclusion", // Windows: không tạm dừng vẽ khi cửa sổ bị cửa sổ khác che
    ...(mode === "window" ? [`--app=${url}`] : ["--headless=new", ...(mode === "headless-cpu" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : []), url]),
  ];
  const launchEpoch = Date.now(); // mốc bắt đầu tiến trình
  const child = spawn(chrome, flags, { stdio: "ignore" });
  child.on("error", (e) => usage(`khong chay duoc Chrome: ${e.message}`));

  let peak = null;
  let polling = false;
  const take = () => {
    const m = browserMemMb(profile);
    if (m !== null && (peak === null || m > peak)) peak = m;
  };
  const poll = setInterval(() => {
    if (polling) return;
    polling = true;
    take();
    polling = false;
  }, 4000);

  // Canh chừng: 30 s đầu phải có tín hiệu đầu tiên; sau đó mỗi 10 s phải có thêm tín hiệu (trang gửi mỗi 2 s).
  let stalled = false;
  const watch = new Promise((r) => {
    const t = setInterval(() => {
      const limit = progress === null ? 30000 : 10000;
      if (Date.now() - lastBeat > limit) {
        stalled = true;
        clearInterval(t);
        r(null);
      }
    }, 1000);
    gotResult.then(() => clearInterval(t));
  });
  const result = await Promise.race([gotResult, watch]);
  clearInterval(poll);
  if (result && !result.error) take();

  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGKILL");
  server.close();
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch {
    /* thư mục tạm, bỏ qua nếu còn bị khóa */
  }
  if (result?.error) return { failed: `trang gap loi JavaScript:\n${result.error}`, fatal: true };
  if (!result || stalled) return { failed: progress ? `cua so ngung ve o giay ${progress.progress} (visibility ${progress.visibility}; nhip tim cuoi: ${heartbeat ? `rAF cach ${heartbeat.since_last_raf_ms} ms, focus ${heartbeat.hasFocus}` : "khong co"})` : "khung hinh dau tien khong ve" };
  return { result, peak, launchEpoch };
}

const modes = forced ? [forced] : ["window", "headless-gpu"];
let done = null;
let used = null;
for (const mode of modes) {
  console.log(`Chay benchmark o che do: ${mode}...`);
  const r = await attempt(mode);
  if (r.result) {
    done = r;
    used = mode;
    break;
  }
  process.stderr.write(`Che do ${mode} that bai: ${r.failed}\n`);
  if (r.fatal) process.exit(1);
}
if (!done) usage("khong che do nao do duoc. Kiem tra Chrome mo duoc va WebGL bat");

const { result, peak, launchEpoch } = done;
const out = {
  contract_version: "1.3",
  avg_fps: result.avg_fps,
  p1_low_fps: result.p1_low_fps,
  frame_ms_p95: result.frame_ms_p95,
  frames: result.frames,
  load_ms: Math.max(0, Math.round(result.first_frame_epoch_ms - launchEpoch)),
  peak_mem_mb: peak === null ? null : Math.round(peak * 10) / 10,
  vsync_off: used !== "headless-cpu", // đã truyền --disable-gpu-vsync và --disable-frame-rate-limit; FPS vượt tần số màn hình xác nhận vsync đã tắt
  renderer: `${result.renderer} [che do: ${used}]`,
  os: `${os.version()} ${os.release()} ${os.arch()}, ${os.cpus()[0]?.model?.trim() ?? "CPU ?"}, ${Math.round(os.totalmem() / 2 ** 30)} GB RAM`,
};
writeFileSync(opts.out, JSON.stringify(out, null, 2) + "\n");
const pass = out.avg_fps >= 60 && out.p1_low_fps >= 30 && out.load_ms <= 10000;
console.log(`${JSON.stringify(out)}\nNguong tham khao (may cham cua giang vien moi la chinh thuc): avg_fps >= 60, p1_low_fps >= 30, load_ms <= 10000 -> ${pass ? "DAT" : "CHUA DAT"}${used === "headless-cpu" ? " (headless-cpu: khong co gia tri tham khao)" : ""}`);
process.exit(0);
