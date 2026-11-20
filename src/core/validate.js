// Kiểm tra định dạng file scenario và inputs. Sai thì ném ContractError (mã thoát 2).
export class ContractError extends Error {
  constructor(message) {
    super(message);
    this.name = "ContractError";
    this.exitCode = 2;
  }
}

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isVec = (v, n) => Array.isArray(v) && v.length === n && v.every(isNum);

function fail(msg) {
  throw new ContractError(msg);
}

export function validateInputs(data) {
  if (!isObj(data)) fail("inputs: gốc phải là object");
  if (!Array.isArray(data.frames)) fail("inputs: thiếu mảng frames");
  let last = -1;
  data.frames.forEach((f, i) => {
    const where = `inputs.frames[${i}]`;
    if (!isObj(f)) fail(`${where}: phải là object`);
    if (!Number.isInteger(f.tick) || f.tick < 0) fail(`${where}.tick phải là số nguyên >= 0`);
    if (f.tick <= last) fail(`${where}.tick phải tăng nghiêm ngặt`);
    last = f.tick;
    if ("move" in f) {
      if (!isVec(f.move, 2)) fail(`${where}.move phải là [x, z]`);
      if (f.move.some((c) => c < -1 || c > 1)) fail(`${where}.move phải nằm trong [-1, 1]`);
    }
    if ("cam_yaw_deg" in f && !isNum(f.cam_yaw_deg)) fail(`${where}.cam_yaw_deg phải là số`);
    for (const k of ["jump", "interact", "pulse", "dash"]) {
      if (k in f && typeof f[k] !== "boolean") fail(`${where}.${k} phải là boolean`);
    }
  });
  return data;
}

export function validateScenario(data, lanternIds) {
  if (!isObj(data)) fail("scenario: gốc phải là object");
  if ("player" in data) {
    const p = data.player;
    if (!isObj(p)) fail("scenario.player phải là object");
    if ("pos" in p && !isVec(p.pos, 3)) fail("scenario.player.pos phải là [x, y, z]");
    if ("carried" in p && !(Number.isInteger(p.carried) && p.carried >= 0)) fail("scenario.player.carried phải là số nguyên >= 0");
    if ("flames" in p && !(Number.isInteger(p.flames) && p.flames >= 0)) fail("scenario.player.flames phải là số nguyên >= 0");
  }
  for (const k of ["random_motes", "random_shades"]) {
    if (k in data && typeof data[k] !== "boolean") fail(`scenario.${k} phải là boolean`);
  }
  if ("motes" in data) {
    if (!Array.isArray(data.motes) || !data.motes.every((m) => isVec(m, 3))) fail("scenario.motes phải là mảng [x, y, z]");
  }
  if ("shades" in data) {
    if (!Array.isArray(data.shades)) fail("scenario.shades phải là mảng");
    data.shades.forEach((s, i) => {
      if (!isObj(s) || !isVec(s.pos, 3)) fail(`scenario.shades[${i}].pos phải là [x, y, z]`);
      if ("id" in s && typeof s.id !== "string") fail(`scenario.shades[${i}].id phải là chuỗi`);
    });
    const ids = data.shades.filter((s) => s.id).map((s) => s.id);
    if (new Set(ids).size !== ids.length) fail("scenario.shades có id trùng");
  }
  if ("lanterns" in data) {
    if (!Array.isArray(data.lanterns)) fail("scenario.lanterns phải là mảng");
    data.lanterns.forEach((l, i) => {
      const where = `scenario.lanterns[${i}]`;
      if (!isObj(l) || typeof l.id !== "string") fail(`${where}.id phải là chuỗi`);
      if (!lanternIds.includes(l.id)) fail(`${where}.id không có trong màn: ${l.id}`);
      if ("pos" in l && !isVec(l.pos, 3)) fail(`${where}.pos phải là [x, y, z]`);
      if ("lit" in l && typeof l.lit !== "boolean") fail(`${where}.lit phải là boolean`);
      if ("deposited" in l && !(Number.isInteger(l.deposited) && l.deposited >= 0)) fail(`${where}.deposited phải là số nguyên >= 0`);
    });
  }
  if ("time_left_s" in data && !(isNum(data.time_left_s) && data.time_left_s >= 0)) fail("scenario.time_left_s phải là số >= 0");
  return data;
}
