import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const groups = Array.from({ length: 7 }, (_, index) =>
  JSON.parse(
    fs.readFileSync(
      new URL(`../public/data/idioms-1-70-v2-${index + 1}.json`, import.meta.url),
      "utf8"
    )
  )
);
const data = groups.flat();
const index = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const overlay = fs.readFileSync(new URL("../public/unit1-70-v2.js", import.meta.url), "utf8");

test("1–70优化资料完整且顺序正确", () => {
  assert.equal(groups.length, 7);
  assert.ok(groups.every((group) => group.length === 10));
  assert.equal(data.length, 70);
  assert.deepEqual(data.map((item) => item.num), Array.from({ length: 70 }, (_, i) => i + 1));
  for (const item of data) {
    assert.equal(item.id.length, 4);
    assert.equal(item.characters.length, 4);
    assert.equal(item.characters.map((part) => part.char).join(""), item.id);
    assert.ok(item.explain.length > 0);
    assert.ok(item.english.length > 0);
    assert.ok(item.usage.length > 0);
    assert.equal(item.exampleParts.idiom, item.id);
    assert.ok(item.exampleParts.collocation.length > 0);
  }
});

test("挑战题入口与原有答题逻辑完整保留", () => {
  assert.match(index, /id="startQuiz"/);
  assert.match(index, /开始整组挑战/);
  assert.match(app, /page\.questions/);
  assert.match(app, /submit-attempt/);
  assert.doesNotMatch(overlay, /startQuiz[^\n]*remove|remove[^\n]*startQuiz/);
});

test("右栏显示英文用法，并按要求突出例句", () => {
  assert.match(overlay, /readerUsageV2/);
  assert.match(overlay, /example-idiom/);
  assert.match(overlay, /#df2020/);
  assert.match(overlay, /example-collocation/);
  assert.match(overlay, /#1f61c6/);
  assert.match(index, /unit1-70-v2\.js/);
});
