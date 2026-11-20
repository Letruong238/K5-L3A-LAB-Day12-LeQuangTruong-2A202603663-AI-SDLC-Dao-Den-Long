// Lệnh headless theo Test Contract v1.1.
// Dùng: node src/headless/cli.js --seed 1 --night 1 --ticks 600 --out out.jsonl   (night = 1, 2 hoặc 3)
//        [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
// Mã thoát: 0 thành công, 1 lỗi tham số/chung, 2 file scenario/inputs sai.
import { readFileSync, writeFileSync } from "node:fs";
import { runHeadless } from "../core/run.js";
import { ContractError, validateInputs } from "../core/validate.js";

function usageError(msg) {
  process.stderr.write(`Loi: ${msg}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = {};
  const known = new Set(["seed", "night", "scenario", "inputs", "ticks", "out", "snapshot-every"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) usageError(`tham so la: ${a}`);
    const key = a.slice(2);
    if (!known.has(key)) usageError(`tham so khong ho tro: ${a}`);
    const val = argv[++i];
    if (val === undefined) usageError(`thieu gia tri cho ${a}`);
    opts[key] = val;
  }
  return opts;
}

function intArg(opts, key, { required = false, min = 0, def } = {}) {
  if (opts[key] === undefined) {
    if (required) usageError(`thieu --${key}`);
    return def;
  }
  if (!/^-?\d+$/.test(opts[key])) usageError(`--${key} phai la so nguyen`);
  const n = Number(opts[key]);
  if (n < min) usageError(`--${key} phai >= ${min}`);
  return n;
}

function readJson(path, label) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    throw new ContractError(`khong doc duoc file ${label} ${path}: ${e.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new ContractError(`file ${label} khong phai JSON hop le: ${e.message}`);
  }
}

try {
  const opts = parseArgs(process.argv.slice(2));
  const seed = intArg(opts, "seed", { required: true, min: -2147483648 });
  const night = intArg(opts, "night", { def: 1 });
  if (![1, 2, 3].includes(night)) usageError("--night phai la 1, 2 hoac 3");
  const ticks = intArg(opts, "ticks", { required: true });
  const snapshotEvery = intArg(opts, "snapshot-every", { min: 1, def: 10 });
  if (!opts.out) usageError("thieu --out");

  const scenario = opts.scenario ? readJson(opts.scenario, "scenario") : {};
  const inputs = opts.inputs ? validateInputs(readJson(opts.inputs, "inputs")) : null;

  const lines = runHeadless({ seed, night, ticks, scenario, inputs, snapshotEvery });
  writeFileSync(opts.out, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  process.exit(0);
} catch (e) {
  process.stderr.write(`Loi: ${e.message}\n`);
  process.exit(e instanceof ContractError ? e.exitCode : 1);
}
