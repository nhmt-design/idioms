import fs from "node:fs";

const file = new URL("../public/data/idioms.json", import.meta.url);
const text = fs.readFileSync(file, "utf8");

for (const forbidden of ['"correct"', '"why"', '"answer_key"']) {
  if (text.includes(forbidden)) {
    throw new Error(`Public question file contains forbidden field: ${forbidden}`);
  }
}

const data = JSON.parse(text);
const expectedNums = Array.from({ length: 138 }, (_, i) => i + 1);

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
    `../public/assets/rewards/${page.num}.jpg`,
    import.meta.url
  );
  if (!fs.existsSync(reward)) {
    throw new Error(`Missing independent reward card: ${page.num}`);
  }
}

console.log("Public content check passed: 138 idioms, 276 questions, audited cards, no answer keys.");
