import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("public question file does not expose answer keys", () => {
  const text = fs.readFileSync(new URL("../public/data/idioms.json", import.meta.url), "utf8");
  assert.equal(text.includes('"correct"'), false);
  assert.equal(text.includes('"why"'), false);
  assert.equal(text.includes('"answer_key"'), false);
});

test("all 24 reviewed idioms are present", () => {
  const data = JSON.parse(fs.readFileSync(new URL("../public/data/idioms.json", import.meta.url), "utf8"));
  assert.equal(data.pages.length, 24);
  assert.deepEqual([data.pages[0].num, data.pages.at(-1).num], [47, 70]);
});

test("seven ranges cover 1–138 without overlap", () => {
  const data = JSON.parse(fs.readFileSync(new URL("../public/data/idioms.json", import.meta.url), "utf8"));
  const nums = data.groups.flatMap((group) => Array.from({ length: group.end - group.start + 1 }, (_, i) => group.start + i));
  assert.equal(nums.length, 138);
  assert.equal(new Set(nums).size, 138);
});
