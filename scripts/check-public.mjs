import fs from "node:fs";

const file = new URL("../public/data/idioms.json", import.meta.url);
const text = fs.readFileSync(file, "utf8");
for (const forbidden of ['"correct"', '"why"', '"answer_key"']) {
  if (text.includes(forbidden)) throw new Error(`Public question file contains forbidden field: ${forbidden}`);
}
const data = JSON.parse(text);
if (data.pages?.length !== 24) throw new Error("Expected 24 published idioms");
for (const page of data.pages) {
  for (const kind of ["pages", "thumbs"]) {
    if (!fs.existsSync(new URL(`../public/assets/chengyu/${kind}/${page.num}.jpg`, import.meta.url))) {
      throw new Error(`Missing ${kind} image: ${page.num}`);
    }
  }
  if (!fs.existsSync(new URL(`../public/assets/rewards/${page.num}.jpg`, import.meta.url))) {
    throw new Error(`Missing independent reward card: ${page.num}`);
  }
}
console.log("Public content check passed: 24 idioms, no answer keys.");
