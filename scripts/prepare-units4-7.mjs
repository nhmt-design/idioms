import fs from "node:fs";
import { units4to7Content } from "./content-units4-7.mjs";

const expectedNums = Array.from({ length: 68 }, (_, index) => index + 71);
const actualNums = units4to7Content.map((page) => page.num);

if (JSON.stringify(actualNums) !== JSON.stringify(expectedNums)) {
  throw new Error("Units 4–7 must contain idioms 71–138 exactly once and in order.");
}

for (const page of units4to7Content) {
  const hanCharacters = page.id.match(/\p{Script=Han}/gu) || [];

  if (page.characters.length !== hanCharacters.length) {
    throw new Error(
      `Idiom ${page.num} character-card count mismatch: expected ${hanCharacters.length}, found ${page.characters.length}.`
    );
  }

  if (!page.english || /[\u3400-\u9fff]/u.test(page.english)) {
    throw new Error(`Idiom ${page.num} needs a concise English explanation.`);
  }

  if (!Array.isArray(page.questions) || page.questions.length !== 2) {
    throw new Error(`Idiom ${page.num} must contain exactly two questions.`);
  }

  if (
    !page.goldCard ||
    !page.goldCard.theme ||
    !page.goldCard.label ||
    page.goldCard.asset !== `assets/rewards/${page.num}.jpg`
  ) {
    throw new Error(`Idiom ${page.num} needs an individual gold-card assignment.`);
  }

  for (const question of page.questions) {
    if (!Array.isArray(question.options) || question.options.length !== 3) {
      throw new Error(`Idiom ${page.num} ${question.id} must contain three options.`);
    }

    if (new Set(question.options).size !== question.options.length) {
      throw new Error(`Idiom ${page.num} ${question.id} contains duplicate options.`);
    }
  }
}

const output = new URL("../public/data/unit4-7-pages.json", import.meta.url);
fs.writeFileSync(output, `${JSON.stringify(units4to7Content, null, 2)}\n`, "utf8");
console.log("Prepared 68 audited idioms with 136 contextual questions and illustrated character cards.");
