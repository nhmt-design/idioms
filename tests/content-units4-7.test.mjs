import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const publicData = JSON.parse(
  fs.readFileSync(new URL("../public/data/idioms.json", import.meta.url), "utf8")
);
const unitData = JSON.parse(
  fs.readFileSync(new URL("../public/data/unit4-7-pages.json", import.meta.url), "utf8")
);
const goldCardManifest = JSON.parse(
  fs.readFileSync(new URL("../public/data/gold-card-manifest.json", import.meta.url), "utf8")
);
const pages = publicData.pages.filter((page) => page.num >= 71 && page.num <= 138);

test("units 4–7 contain 68 audited idioms in order", () => {
  assert.equal(pages.length, 68);
  assert.deepEqual(
    pages.map((page) => page.num),
    Array.from({ length: 68 }, (_, index) => index + 71)
  );
  assert.deepEqual(pages, unitData);
});

test("every idiom has a complete illustrated character card and English meaning", () => {
  for (const page of pages) {
    const idiomCharacters = page.id.match(/\p{Script=Han}/gu) || [];
    assert.deepEqual(
      page.characters.map((character) => character.char),
      idiomCharacters,
      `character sequence for idiom ${page.num}`
    );

    for (const character of page.characters) {
      assert.ok(character.gloss.trim(), `gloss for idiom ${page.num}`);
      assert.ok(character.icon.trim(), `illustration for idiom ${page.num}`);
    }

    assert.match(page.english, /^[\x20-\x7E’]+$/u, `English meaning for idiom ${page.num}`);
    assert.ok(page.english.length >= 20 && page.english.length <= 100);
    assert.equal(page.example.startsWith("理解「"), false);
  }
});

test("idioms 71–138 each have a numbered gold card from the five approved themes", () => {
  const themes = [
    { id: "cool", label: "酷毙了" },
    { id: "impressive", label: "厉害哟" },
    { id: "great", label: "太棒啦" },
    { id: "keep-going", label: "继续冲" },
    { id: "smart-learner", label: "真会学" }
  ];

  assert.deepEqual(goldCardManifest.themes, themes);
  assert.equal(goldCardManifest.cards.length, 68);

  for (const page of pages) {
    const expectedTheme = themes[(page.num - 71) % themes.length];
    const expectedCard = {
      theme: expectedTheme.id,
      label: expectedTheme.label,
      asset: `assets/rewards/${page.num}.jpg`
    };
    const manifestCard = goldCardManifest.cards.find((card) => card.num === page.num);

    assert.deepEqual(page.goldCard, expectedCard, `gold-card config for idiom ${page.num}`);
    assert.deepEqual(
      {
        theme: manifestCard.theme,
        label: manifestCard.label,
        asset: manifestCard.asset
      },
      expectedCard,
      `gold-card manifest for idiom ${page.num}`
    );
    assert.match(manifestCard.sha256, /^[a-f0-9]{64}$/u);
    assert.ok(
      fs.existsSync(new URL(`../public/${page.goldCard.asset}`, import.meta.url)),
      `gold-card file for idiom ${page.num}`
    );
  }
});

test("comic preparation cannot overwrite approved gold-card assets", () => {
  const comicPreparation = fs.readFileSync(
    new URL("../scripts/prepare-comic-images.py", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(comicPreparation, /assets\/rewards|REWARDS/u);
  assert.match(comicPreparation, /approved gold cards were left untouched/u);
});

test("all 136 questions use meaningful scene and misuse discrimination", () => {
  const banned = /形容天气忽然变冷|形容东西的数量很多|这个情境正好说明|这里只是在介绍天气|这里只是在计算数量/u;

  for (const page of pages) {
    assert.deepEqual(
      page.questions.map((question) => question.type),
      ["scene", "misuse"]
    );
    assert.doesNotMatch(page.questions.map((question) => question.stem).join(" "), /是什么意思|哪一句正确表达/u);

    for (const question of page.questions) {
      assert.equal(question.options.length, 3);
      assert.equal(new Set(question.options).size, 3);
      assert.doesNotMatch(question.options.join(" "), banned);
      assert.ok(question.options.every((option) => option.length >= 12));
    }
  }
});

test("the interface shuffles visible choices without changing backend option indexes", () => {
  const app = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /function shuffledOptions/u);
  assert.match(app, /value="\$\{originalIndex\}"/u);
  assert.match(app, /page\.num >= 71 && page\.num <= 138/u);
  assert.match(app, /const rewardAsset/u);
  assert.match(app, /page\.goldCard\?\.asset/u);
});

test("the reader replaces legacy cards while preserving the approved sample card", () => {
  const app = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const styles = fs.readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(app, /page\.num !== 89/u);
  assert.match(app, /page\.num === 88 \? "1110" : "1220"/u);
  assert.match(html, /readerComicFrame[\s\S]*readerLearningCard[\s\S]*reader-info/u);
  assert.match(styles, /reader-comic-frame\.card-replaced/u);
});
