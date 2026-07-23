import fs from "node:fs";

const file = new URL("../public/data/idioms.json", import.meta.url);
const text = fs.readFileSync(file, "utf8");
for (const forbidden of ['"correct"', '"why"', '"answer_key"']) {
  if (text.includes(forbidden)) throw new Error(`Public question file contains forbidden field: ${forbidden}`);
}
const data = JSON.parse(text);
if (data.pages?.length !== 24) throw new Error("Expected 24 published idioms");
console.log("Public content check passed: 24 idioms, no answer keys.");
