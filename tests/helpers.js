// Tiện ích dùng chung cho test.
import assert from "node:assert/strict";
import { runHeadless } from "../src/core/run.js";

// Scenario trống: không sinh ngẫu nhiên, không có thực thể nào ngoài những gì liệt kê.
export const base = (extra = {}) => ({
  random_motes: false,
  random_shades: false,
  random_drifters: false,
  wind_enabled: false,
  motes: [],
  shades: [],
  ...extra,
});
export const run = (scenario, frames, ticks, opts = {}) =>
  runHeadless({ seed: 1, night: 1, ticks, scenario, inputs: frames ? { frames } : null, snapshotEvery: 1, ...opts });
export const snaps = (lines) => lines.filter((l) => l.type === "snapshot");
export const events = (lines, name) => lines.filter((l) => l.type === "event" && (!name || l.name === name));
export const end = (lines) => lines[lines.length - 1];
export const last = (lines) => snaps(lines).at(-1);
export const at = (lines, tick) => snaps(lines).find((s) => s.tick === tick);
export const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b} (±${eps})`);
export const horiz = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
// Giữ một nút trong một tick (nhấn rồi nhả) để tạo cạnh lên.
export const press = (tick, key) => [{ tick, [key]: true }, { tick: tick + 1, [key]: false }];
export const lit = (...ids) => ids.map((id) => ({ id, lit: true }));
