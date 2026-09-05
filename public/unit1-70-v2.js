const V2_DATA_URLS = Array.from({ length: 7 }, (_, index) => `/data/idioms-1-70-v2-${index + 1}.json`);

let v2ByNum = new Map();

const escapeHtmlV2 = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

function installV2Styles() {
  if (document.querySelector("#idiomsV2Styles")) return;

  const style = document.createElement("style");
  style.id = "idiomsV2Styles";
  style.textContent = `
    .reader-usage{margin:18px 0;background:#f0f4fa;border-radius:12px;padding:15px 16px;color:var(--ink)}
    .reader-usage strong{display:block;margin-bottom:7px;color:#65748a;font-size:12px;letter-spacing:.08em;text-transform:uppercase}
    .reader-usage p{margin:0!important;line-height:1.55!important;font-size:15px}
    #readerExample.example{font-size:15px;line-height:1.75}
    #readerExample .example-label{display:block;margin-bottom:4px;color:var(--ink);font-weight:900}
    #readerExample .example-idiom{color:#df2020;font-weight:900}
    #readerExample .example-collocation{color:#1f61c6;font-weight:900}
    #readerLearningCard.v2-learning-card{display:block!important}
    @media(max-width:620px){.reader-usage{padding:13px 14px}.reader-usage p,#readerExample.example{font-size:14px}}
  `;
  document.head.appendChild(style);
}

function ensureUsageBox() {
  let box = document.querySelector("#readerUsageV2");
  if (box) return box;

  const explain = document.querySelector("#readerExplain");
  const example = document.querySelector("#readerExample");
  if (!explain || !example) return null;

  box = document.createElement("div");
  box.id = "readerUsageV2";
  box.className = "reader-usage hidden";
  box.innerHTML = "<strong>Usage</strong><p></p>";
  example.parentNode.insertBefore(box, example);
  return box;
}

function currentNum() {
  const text = document.querySelector("#readerNum")?.textContent || "";
  return Number(text.match(/\d+/)?.[0] || 0);
}

function renderV2Comic() {
  const frame = document.querySelector("#readerComicFrame");
  const baseImage = document.querySelector("#readerImage");
  const sprite = frame?.querySelector(".v2-comic-sprite");

  frame?.classList.remove("v2-active");
  if (frame) frame.style.aspectRatio = "";
  baseImage?.classList.remove("hidden");
  sprite?.classList.add("hidden");
}

function renderV2LearningCard(rec) {
  const card = document.querySelector("#readerLearningCard");
  const characters = document.querySelector("#readerCharacters");
  const english = document.querySelector("#readerEnglish");
  if (!card || !characters || !english) return;

  card.classList.remove("hidden");
  card.classList.add("v2-learning-card");
  characters.innerHTML = rec.characters.map((character) => `
    <article class="character-card">
      <strong>${escapeHtmlV2(character.char)}</strong>
      <span class="character-icon" aria-hidden="true">${escapeHtmlV2(character.icon)}</span>
      <span>${escapeHtmlV2(character.gloss)}</span>
    </article>
  `).join("");
  english.textContent = rec.english;
}

function renderV2Sidebar(rec) {
  const explain = document.querySelector("#readerExplain");
  const example = document.querySelector("#readerExample");
  const usage = ensureUsageBox();
  if (!explain || !example || !usage) return;

  explain.textContent = rec.explain;
  usage.classList.remove("hidden");
  usage.querySelector("p").textContent = rec.usage;

  const p = rec.exampleParts;
  example.innerHTML = `
    <span class="example-label">例句：</span>
    ${escapeHtmlV2(p.before)}<span class="example-idiom">${escapeHtmlV2(p.idiom)}</span><span class="example-collocation">${escapeHtmlV2(p.collocation)}</span>${escapeHtmlV2(p.after)}
  `;
}

function restoreNonV2Reader() {
  const frame = document.querySelector("#readerComicFrame");
  const baseImage = document.querySelector("#readerImage");
  const sprite = frame?.querySelector(".v2-comic-sprite");
  const usage = document.querySelector("#readerUsageV2");
  const card = document.querySelector("#readerLearningCard");

  frame?.classList.remove("v2-active");
  if (frame) frame.style.aspectRatio = "";
  baseImage?.classList.remove("hidden");
  sprite?.classList.add("hidden");
  usage?.classList.add("hidden");
  card?.classList.remove("v2-learning-card");
}

function applyCurrentReaderV2() {
  const num = currentNum();
  const rec = v2ByNum.get(num);
  if (!rec) {
    restoreNonV2Reader();
    return;
  }

  renderV2Comic(rec);
  renderV2LearningCard(rec);
  renderV2Sidebar(rec);
}

async function initIdiomsV2() {
  installV2Styles();
  ensureUsageBox();

  const groups = await Promise.all(
    V2_DATA_URLS.map((url) =>
      fetch(url).then((response) => {
        if (!response.ok) throw new Error("1–70优化资料加载失败");
        return response.json();
      })
    )
  );
  const records = groups.flat();
  v2ByNum = new Map(records.map((item) => [item.num, item]));

  const reader = document.querySelector("#readerModal");
  if (reader) {
    new MutationObserver(() => {
      if (!reader.classList.contains("hidden")) applyCurrentReaderV2();
    }).observe(reader, { attributes: true, attributeFilter: ["class"] });
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest(".idiom-card")) {
      setTimeout(applyCurrentReaderV2, 0);
    }
  });
}

initIdiomsV2().catch((error) => {
  console.warn(error);
});
