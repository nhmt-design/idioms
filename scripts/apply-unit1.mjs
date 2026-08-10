import fs from "node:fs";

const dataPath = new URL("../public/data/idioms.json", import.meta.url);
const unit1Path = new URL("../public/data/unit1-pages.json", import.meta.url);
const indexPath = new URL("../public/index.html", import.meta.url);

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const unit1 = JSON.parse(fs.readFileSync(unit1Path, "utf8"));

if (!Array.isArray(unit1) || unit1.length !== 23) {
  throw new Error("unit1-pages.json must contain exactly 23 idioms.");
}

const nums = unit1.map((item) => item.num);
const expected = Array.from({ length: 23 }, (_, i) => i + 1);
if (JSON.stringify(nums) !== JSON.stringify(expected)) {
  throw new Error("Unit 1 idiom numbers must be exactly 1 through 23, in order.");
}

for (const page of unit1) {
  if (!Array.isArray(page.questions) || page.questions.length !== 2) {
    throw new Error(`Idiom ${page.num} must contain exactly 2 public questions.`);
  }
}

data.groups = (data.groups || []).map((group) =>
  group.id === "g1" ? { ...group, status: "open" } : group
);

const remaining = (data.pages || []).filter((page) => page.num < 1 || page.num > 23);
data.pages = [...unit1, ...remaining].sort((a, b) => a.num - b.num);

data.title = "中一成语图鉴";
data.subtitle = "第一、第三单元已开放（第1—23、47—70条）";

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n", "utf8");

let index = fs.readFileSync(indexPath, "utf8");
index = index
  .replace(
    "目前开放第47—70条成语。登录后，进度会安全保存，并可在不同设备继续学习。",
    "目前开放第一、第三单元，共47条成语。登录后，进度会安全保存，并可在不同设备继续学习。"
  )
  .replace(
    "<strong>24</strong><span>当前成语</span>",
    "<strong>47</strong><span>当前成语</span>"
  )
  .replace(
    '<div><p class="eyebrow">第三单元 · 已开放</p><h2>第47—70条</h2></div>',
    '<div><p class="eyebrow">第一、第三单元 · 已开放</p><h2>第1—23、47—70条</h2></div>'
  );

fs.writeFileSync(indexPath, index, "utf8");

console.log("Unit 1 public data merged and homepage text updated.");
