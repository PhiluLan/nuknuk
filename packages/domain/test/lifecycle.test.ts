import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionAgent } from "../src/index.ts";

test("agent lifecycle permits only declared transitions", () => {
  assert.equal(canTransitionAgent("draft", "active"), true);
  assert.equal(canTransitionAgent("active", "paused"), true);
  assert.equal(canTransitionAgent("active", "draft"), false);
  assert.equal(canTransitionAgent("archived", "active"), false);
});
