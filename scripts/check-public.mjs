import fs from "node:fs";

const file = new URL("../public/data/idioms.json", import.meta.url);
const text = fs.readFileSync(file, "utf8");

for (const forbidden of ['"correct"', '"why"', '"answer_key"']) {
  if (text.includes(forbidden)) {
    throw new Error(`Public question file contains forbidden field: ${forbidden}`);
  }
}

const data = JSON.parse(text);
const expectedNums = [
  ...Array.from({ length: 23 }, (_, i) => i + 1),
  ...Array.from({ length: 24 }, (_, i) => i + 47),
];

if (data.pages?.length !== 47) {
  throw new Error(`Expected 47 published idioms, found ${data.pages?.length ?? 0}`);
}

const nums = data.pages.map((page) => page.num);
if (JSON.stringify(nums) !== JSON.stringify(expectedNums)) {
  throw new Error("Published idiom numbers must be exactly 1–23 and 47–70, in order.");
}

const questionCount = data.pages.reduce(
  (sum, page) => sum + (Array.isArray(page.questions) ? page.questions.length : 0),
  0
);
if (questionCount !== 94) {
  throw new Error(`Expected 94 public questions, found ${questionCount}`);
}

for (const page of data.pages) {
  if (!Array.isArray(page.questions) || page.questions.length !== 2) {
    throw new Error(`Idiom ${page.num} must contain exactly 2 questions`);
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

console.log("Public content check passed: 47 idioms, 94 questions, no answer keys.");
