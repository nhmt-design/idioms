import crypto from "node:crypto";
import fs from "node:fs";

const themes = [
  { id: "cool", label: "酷毙了" },
  { id: "impressive", label: "厉害哟" },
  { id: "great", label: "太棒啦" },
  { id: "keep-going", label: "继续冲" },
  { id: "smart-learner", label: "真会学" }
];

const cards = Array.from({ length: 68 }, (_, index) => {
  const num = index + 71;
  const theme = themes[index % themes.length];
  const asset = `assets/rewards/${num}.jpg`;
  const image = new URL(`../public/${asset}`, import.meta.url);

  if (!fs.existsSync(image)) {
    throw new Error(`Missing gold card: ${num}`);
  }

  return {
    num,
    theme: theme.id,
    label: theme.label,
    asset,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(image)).digest("hex")
  };
});

const output = new URL("../public/data/gold-card-manifest.json", import.meta.url);
fs.writeFileSync(output, `${JSON.stringify({ themes, cards }, null, 2)}\n`, "utf8");
console.log("Recorded the 68 approved gold-card assignments and fingerprints.");
