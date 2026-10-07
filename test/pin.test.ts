import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPin, verifyPin } from "../lib/pin.ts";

test("같은 PIN 은 통과하고 다른 PIN 은 막힌다", () => {
  const h = hashPin("1001");
  assert.equal(verifyPin("1001", h), true);
  assert.equal(verifyPin("1002", h), false);
  assert.equal(verifyPin("", h), false);
});

test("같은 PIN 이라도 해시는 매번 다르다 (솔트)", () => {
  assert.notEqual(hashPin("1001"), hashPin("1001"));
});

test("망가진 해시 문자열에 터지지 않는다", () => {
  assert.equal(verifyPin("1001", null), false);
  assert.equal(verifyPin("1001", ""), false);
  assert.equal(verifyPin("1001", "garbage"), false);
  assert.equal(verifyPin("1001", "scrypt$0$aa$bb"), false);
  assert.equal(verifyPin("1001", "md5$16384$aa$bb"), false);
});
