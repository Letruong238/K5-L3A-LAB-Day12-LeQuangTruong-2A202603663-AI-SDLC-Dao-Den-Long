import { test } from "node:test";
import assert from "node:assert/strict";
import { hello } from "../src/core/hello.js";

test("hello trả về thông báo môi trường OK", () => {
  assert.equal(hello(), "Dao Den Long: moi truong OK");
});
