import crypto from "node:crypto";
import fs from "node:fs";

const file = new URL("../public/data/idioms.json", import.meta.url);
const text = fs.readFileSync(file, "utf8");
const goldCardManifest = JSON.parse(
  fs.readFileSync(new URL("../public/data/gold-card-manifest.json", import.meta.url), "utf8")
);

const sha256 = (image) =>
  crypto.createHash("sha256").update(fs.readFileSync(image)).digest("hex");

function imageDimensions(image) {
  const buffer = fs.readFileSync(image);

  if (buffer.subarray(1, 4).toString("ascii") === "PNG") {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    const startOfFrameMarkers = new Set([
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
      0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf
    ]);
    let offset = 2;

    while (offset + 8 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      while (buffer[offset] === 0xff) offset += 1;
      const marker = buffer[offset];
      offset += 1;

      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        continue;
      }

      const segmentLength = buffer.readUInt16BE(offset);

      if (startOfFrameMarkers.has(marker)) {
        return {
          width: buffer.readUInt16BE(offset + 5),
          height: buffer.readUInt16BE(offset + 3)
        };
      }

      offset += segmentLength;
    }
  }

  throw new Error(`Unsupported or damaged image: ${image.pathname}`);
}

for (const forbidden of ['"correct"', '"why"', '"answer_key"']) {
  if (text.includes(forbidden)) {
    throw new Error(`Public question file contains forbidden field: ${forbidden}`);
  }
}

const data = JSON.parse(text);
const expectedNums = Array.from({ length: 138 }, (_, i) => i + 1);
const expectedGoldCardNums = Array.from({ length: 68 }, (_, i) => i + 71);
const expectedGoldCardThemes = [
  { id: "cool", label: "酷毙了" },
  { id: "impressive", label: "厉害哟" },
  { id: "great", label: "太棒啦" },
  { id: "keep-going", label: "继续冲" },
  { id: "smart-learner", label: "真会学" }
];

if (JSON.stringify(goldCardManifest.themes) !== JSON.stringify(expectedGoldCardThemes)) {
  throw new Error("Gold-card themes do not match the five approved designs.");
}

if (JSON.stringify(goldCardManifest.cards?.map((card) => card.num)) !== JSON.stringify(expectedGoldCardNums)) {
  throw new Error("Gold-card manifest must configure idioms 71–138 exactly once and in order.");
}

const goldCardByNum = new Map(goldCardManifest.cards.map((card) => [card.num, card]));
const approvedSourceHashes = new Set();

for (let index = 1; index <= 5; index += 1) {
  const source = new URL(
    `../public/assets/rewards/gold-card-0${index}.png`,
    import.meta.url
  );

  if (!fs.existsSync(source)) {
    throw new Error(`Missing approved gold-card source: ${index}`);
  }

  const dimensions = imageDimensions(source);
  if (dimensions.width !== 1086 || dimensions.height !== 1448) {
    throw new Error(`Approved gold-card source ${index} must be 1086×1448.`);
  }

  approvedSourceHashes.add(sha256(source));
}

if (approvedSourceHashes.size !== 5) {
  throw new Error("The five approved gold-card sources must be visually independent files.");
}

if (data.pages?.length !== 138) {
  throw new Error(`Expected 138 published idioms, found ${data.pages?.length ?? 0}`);
}

const nums = data.pages.map((page) => page.num);
if (JSON.stringify(nums) !== JSON.stringify(expectedNums)) {
  throw new Error("Published idiom numbers must be exactly 1–138, in order.");
}

const questionCount = data.pages.reduce(
  (sum, page) => sum + (Array.isArray(page.questions) ? page.questions.length : 0),
  0
);
if (questionCount !== 276) {
  throw new Error(`Expected 276 public questions, found ${questionCount}`);
}

for (const page of data.pages) {
  if (!Array.isArray(page.questions) || page.questions.length !== 2) {
    throw new Error(`Idiom ${page.num} must contain exactly 2 questions`);
  }

  if (page.num >= 71 && page.num <= 138) {
    const expectedTypes = ["scene", "misuse"];
    const actualTypes = page.questions.map((question) => question.type);
    const hanCharacters = page.id.match(/\p{Script=Han}/gu) || [];
    const cardCharacters = (page.characters || []).map((character) => character.char);
    const bannedText = [
      "形容天气忽然变冷",
      "形容东西的数量很多",
      "这个情境正好说明",
      "这里只是在介绍天气",
      "这里只是在计算数量"
    ];
    const assignedCard = goldCardByNum.get(page.num);
    const expectedTheme = expectedGoldCardThemes[(page.num - 71) % expectedGoldCardThemes.length];

    if (!assignedCard) {
      throw new Error(`Idiom ${page.num} has no gold-card assignment.`);
    }

    if (
      assignedCard.theme !== expectedTheme.id ||
      assignedCard.label !== expectedTheme.label ||
      assignedCard.asset !== `assets/rewards/${page.num}.jpg`
    ) {
      throw new Error(`Idiom ${page.num} has an invalid gold-card theme or asset.`);
    }

    if (JSON.stringify(page.goldCard) !== JSON.stringify({
      theme: assignedCard.theme,
      label: assignedCard.label,
      asset: assignedCard.asset
    })) {
      throw new Error(`Idiom ${page.num} public gold-card config does not match the manifest.`);
    }

    if (JSON.stringify(actualTypes) !== JSON.stringify(expectedTypes)) {
      throw new Error(`Idiom ${page.num} must use scene and misuse question types.`);
    }

    if (/是什么意思|哪一句正确表达/u.test(page.questions.map((question) => question.stem).join(" "))) {
      throw new Error(`Idiom ${page.num} still contains a recall-only question.`);
    }

    for (const question of page.questions) {
      if (!Array.isArray(question.options) || question.options.length !== 3) {
        throw new Error(`Idiom ${page.num} ${question.id} must contain exactly 3 options.`);
      }
      if (new Set(question.options).size !== 3) {
        throw new Error(`Idiom ${page.num} ${question.id} contains duplicate options.`);
      }
      if (bannedText.some((phrase) => question.options.some((option) => option.includes(phrase)))) {
        throw new Error(`Idiom ${page.num} ${question.id} contains a meaningless distractor.`);
      }
    }

    if (JSON.stringify(cardCharacters) !== JSON.stringify(hanCharacters)) {
      throw new Error(`Idiom ${page.num} character cards do not match the idiom text.`);
    }

    if (page.characters.some((character) => !character.gloss || !character.icon)) {
      throw new Error(`Idiom ${page.num} has an incomplete illustrated character card.`);
    }

    if (!page.english || /[\u3400-\u9fff]/u.test(page.english)) {
      throw new Error(`Idiom ${page.num} needs an English explanation.`);
    }

    if (page.example.startsWith("理解「")) {
      throw new Error(`Idiom ${page.num} still contains a generic example sentence.`);
    }
  }

  for (const kind of ["pages", "thumbs"]) {
    const image = new URL(
      `../public/assets/chengyu/${kind}/${page.num}.jpg`,
      import.meta.url
    );
    if (!fs.existsSync(image)) {
      throw new Error(`Missing ${kind} image: ${page.num}`);
    }
    if (kind === "thumbs" && fs.statSync(image).size > 150_000) {
      throw new Error(`Thumbnail is too large: ${page.num}`);
    }
  }

  const reward = new URL(
    `../public/${page.goldCard?.asset || `assets/rewards/${page.num}.jpg`}`,
    import.meta.url
  );
  if (!fs.existsSync(reward)) {
    throw new Error(`Missing independent reward card: ${page.num}`);
  }

  if (page.num >= 71 && page.num <= 138) {
    const dimensions = imageDimensions(reward);
    const assignedCard = goldCardByNum.get(page.num);

    if (dimensions.width !== 1086 || dimensions.height !== 1448) {
      throw new Error(`Gold card ${page.num} must be the approved 3:4 size, not a comic page.`);
    }

    if (sha256(reward) !== assignedCard.sha256) {
      throw new Error(`Gold card ${page.num} does not match its approved manifest fingerprint.`);
    }
  }
}

console.log("Public content check passed: 138 idioms, 276 questions, 68 approved gold cards, no answer keys.");
