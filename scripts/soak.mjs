// Soak test (Ticket-04, mục 2).
// Dùng: node scripts/soak.mjs --seed 7 --nights 10 --out soak.json
// Chạy headless liên tiếp trong CÙNG một tiến trình, ghi {nights, crashes, results, mem_start_mb, mem_end_mb, duration_s}.
// Thoát 0 nếu đạt ngưỡng (crashes = 0 và mem_end_mb <= 1.2 × mem_start_mb), 3 nếu không đạt, 1 nếu sai tham số.
import { writeFileSync } from "node:fs";
import v8 from "node:v8";
import vm from "node:vm";
import { runSoak } from "../src/core/soak.js";

function usage(msg) {
  process.stderr.write(`Loi: ${msg}\nDung: node scripts/soak.mjs --seed 7 --nights 10 --out soak.json\n`);
  process.exit(1);
}

const opts = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) {
  if (!argv[i].startsWith("--") || argv[i + 1] === undefined) usage(`tham so sai: ${argv[i]}`);
  opts[argv[i].slice(2)] = argv[i + 1];
}
const seed = Number(opts.seed ?? 7);
const nights = Number(opts.nights ?? 10);
if (!Number.isInteger(seed)) usage("--seed phai la so nguyen");
if (!Number.isInteger(nights) || nights < 1) usage("--nights phai la so nguyen >= 1");
if (!opts.out) usage("thieu --out");

// Gọi bộ dọn rác trước mỗi lần đo bộ nhớ để đo phần còn giữ lại thật sự (phát hiện rò rỉ), không phải rác chưa dọn.
v8.setFlagsFromString("--expose-gc");
const gc = vm.runInNewContext("gc");
const mb = () => {
  gc();
  gc();
  return Math.round((process.memoryUsage.rss() / 1048576) * 10) / 10;
};

const t0 = Date.now();
let memStart = null;
let memEnd = null;
const run = runSoak({
  seed,
  nights,
  hooks: {
    afterFirstLoad: () => (memStart = mb()),
    afterLastReset: () => (memEnd = mb()),
  },
});
const out = {
  nights: run.nights,
  crashes: run.crashes,
  results: run.results,
  mem_start_mb: memStart,
  mem_end_mb: memEnd,
  duration_s: Math.round(((Date.now() - t0) / 1000) * 10) / 10,
};
writeFileSync(opts.out, JSON.stringify(out, null, 2) + "\n");
for (const e of run.errors) process.stderr.write(`${e}\n`);
const ok = out.crashes === 0 && out.mem_end_mb <= 1.2 * out.mem_start_mb;
console.log(`${ok ? "DAT" : "KHONG DAT"}: ${JSON.stringify(out)}`);
process.exit(ok ? 0 : 3);
