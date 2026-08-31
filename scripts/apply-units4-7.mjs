import fs from "node:fs";

const dataPath = new URL("../public/data/idioms.json", import.meta.url);
const unitsPath = new URL("../public/data/unit4-7-pages.json", import.meta.url);
const indexPath = new URL("../public/index.html", import.meta.url);

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const units = JSON.parse(fs.readFileSync(unitsPath, "utf8"));
const expected = Array.from({ length: 68 }, (_, i) => i + 71);

if (JSON.stringify(units.map((item) => item.num)) !== JSON.stringify(expected)) {
  throw new Error("Units 4–7 must contain idioms 71–138 in order.");
}

for (const page of units) {
  if (!Array.isArray(page.questions) || page.questions.length !== 2) {
    throw new Error(`Idiom ${page.num} must contain exactly 2 public questions.`);
  }
}

data.groups = (data.groups || []).map((group) => ({ ...group, status: "open" }));
data.pages = [...(data.pages || []).filter((page) => page.num < 71), ...units]
  .sort((a, b) => a.num - b.num);
data.title = "中一成语图鉴";
data.subtitle = "第一至第七单元已开放（第1—138条）";
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n", "utf8");

let index = fs.readFileSync(indexPath, "utf8");
index = index
  .replace(/目前开放[^。]*成语。/, "目前开放第一至第七单元，共138条成语。")
  .replace(/<strong>\d+<\/strong><span>当前成语<\/span>/, "<strong>138</strong><span>当前成语</span>")
  .replace(/<div><p class="eyebrow">[^<]*已开放<\/p><h2>[^<]*<\/h2><\/div>/,
    '<div><p class="eyebrow">第一至第七单元 · 已开放</p><h2>第1—138条</h2></div>');
fs.writeFileSync(indexPath, index, "utf8");

console.log("Units 4–7 merged and homepage updated to 138 idioms.");
