const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const state = { data: null, token: localStorage.getItem("nhhs_token"), profile: null, attempts: new Map(), cards: new Set(), current: null };

const api = async (path, options = {}) => {
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(state.token ? { authorization: `Bearer ${state.token}` } : {}), ...(options.headers || {}) }
  });
  const result = await response.json().catch(() => ({ ok: false, error: "服务器返回异常" }));
  if (!response.ok) throw new Error(result.error || "请求失败");
  return result;
};
const show = (selector) => $(selector).classList.remove("hidden");
const hide = (selector) => $(selector).classList.add("hidden");
const toast = (message) => { $("#toast").textContent = message; show("#toast"); setTimeout(() => hide("#toast"), 2600); };
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

function renderGroups() {
  $("#groups").innerHTML = state.data.groups.map((group) => `<article class="group-card ${group.status}">
    <strong>${escapeHtml(group.label)}</strong><span>${group.status === "open" ? "现已开放" : "制作中 🔒"}</span><b>${group.start}—${group.end}</b>
  </article>`).join("");
}
function renderIdioms() {
  $("#idiomGrid").innerHTML = state.data.pages.map((page) => {
    const attempt = state.attempts.get(page.num);
    const badge = state.cards.has(page.num) ? `<span class="status-badge gold">★ 金卡</span>` : attempt?.practice_completed ? `<span class="status-badge done">已完成</span>` : `<span class="status-badge">第${page.num}条</span>`;
    return `<article class="idiom-card" data-num="${page.num}"><img src="/${page.thumb}" alt="${escapeHtml(page.id)}漫画缩略图" loading="lazy">${badge}<div class="idiom-meta"><strong>${escapeHtml(page.id)}</strong><span>${escapeHtml(page.pinyin)}</span></div></article>`;
  }).join("");
  $$(".idiom-card").forEach((card) => card.addEventListener("click", () => openReader(Number(card.dataset.num))));
}
function renderCards() {
  $("#cardGrid").innerHTML = state.data.pages.map((page, index) => {
    const unlocked = state.cards.has(page.num);
    return `<article class="reward-card ${unlocked ? "" : "locked"}"><img src="/assets/rewards/card-${index % 3 + 1}.png" alt="${escapeHtml(page.id)}金卡"><p>${escapeHtml(page.id)}</p><span>第${page.num}条 · ${unlocked ? "首次全对" : "尚未获得"}</span>${unlocked ? "" : '<div class="lock">🔒</div>'}</article>`;
  }).join("");
}
function updateStats() {
  $("#cardCount").textContent = state.cards.size;
  $("#completeCount").textContent = [...state.attempts.values()].filter((item) => item.practice_completed).length;
  $("#userLabel").textContent = state.profile ? `${state.profile.admin_class}班·${state.profile.student_number}号 · ${state.profile.teaching_class}` : "尚未登录";
  $("#loginBtn").classList.toggle("hidden", Boolean(state.profile));
  $("#logoutBtn").classList.toggle("hidden", !state.profile);
}
function openReader(num) {
  const page = state.data.pages.find((item) => item.num === num);
  state.current = page;
  $("#readerImage").src = `/${page.image}`;
  $("#readerImage").alt = `${page.id}成语漫画`;
  $("#readerNum").textContent = `第${page.num}条`;
  $("#readerName").textContent = page.id;
  $("#readerPinyin").textContent = page.pinyin;
  $("#readerExplain").textContent = page.explain;
  $("#readerExample").textContent = `例句：${page.example}`;
  show("#readerModal");
}
function openQuiz() {
  if (!state.profile) { hide("#readerModal"); show("#loginModal"); return; }
  const page = state.current;
  $("#quizTag").textContent = `第${page.num}条 · ${page.id}`;
  $("#quizTitle").textContent = state.attempts.has(page.num) ? "继续练习" : "首次完整挑战";
  $("#questionList").innerHTML = page.questions.map((question, qIndex) => `<fieldset class="question">
    <h3>${qIndex + 1}. ${escapeHtml(question.stem)}</h3>
    ${question.options.map((option, oIndex) => `<label class="option"><input type="radio" name="q${qIndex}" value="${oIndex}"><span>${escapeHtml(option)}</span></label>`).join("")}
  </fieldset>`).join("");
  $("#quizError").textContent = "";
  hide("#readerModal"); show("#quizModal");
}
async function submitQuiz(event) {
  event.preventDefault();
  const answers = state.current.questions.map((_, index) => {
    const selected = document.querySelector(`input[name="q${index}"]:checked`);
    return selected ? Number(selected.value) : null;
  });
  if (answers.some((answer) => answer === null)) { $("#quizError").textContent = "请完成全部题目。"; return; }
  const button = event.submitter;
  button.disabled = true; button.textContent = "云端核对中……";
  try {
    const result = await api("submit-attempt", { method: "POST", body: JSON.stringify({ idiom_num: state.current.num, answers }) });
    hide("#quizModal");
    $("#resultBody").innerHTML = `${result.awarded ? `<p class="eyebrow" style="text-align:center">恭喜获得新金卡</p><img class="result-card" src="/assets/rewards/card-${state.current.num % 3 + 1}.png" alt="新金卡">` : ""}
      <div class="result-score">${result.score}/${result.total}</div>
      <h2 style="text-align:center">${result.all_correct ? "全部答对！" : result.first_attempt ? "首次挑战已记录" : "继续努力！"}</h2>
      <p style="text-align:center;color:var(--muted)">${result.awarded ? "首次整组全对，金卡已存入收藏。" : result.first_attempt && !result.all_correct ? "这次不能获得金卡，但可以继续练习直到掌握。" : "练习进度已保存。"}</p>
      ${result.explanations.map((items, index) => `<div class="explanation"><strong>第${index + 1}题：</strong>${escapeHtml(items[result.correct_answers[index]])}</div>`).join("")}`;
    show("#resultModal");
    await loadProgress();
  } catch (error) {
    $("#quizError").textContent = error.message;
  } finally {
    button.disabled = false; button.textContent = "一次提交全部答案";
  }
}
async function login(event) {
  event.preventDefault();
  $("#loginError").textContent = "";
  try {
    const result = await api("student-login", { method: "POST", body: JSON.stringify({ admin_class: $("#adminClass").value, student_number: $("#studentNumber").value, login_code: $("#loginCode").value }) });
    state.token = result.token; localStorage.setItem("nhhs_token", result.token); state.profile = result.profile;
    hide("#loginModal"); await loadProgress(); toast("登录成功，进度已同步");
  } catch (error) { $("#loginError").textContent = error.message; }
}
function logout() {
  state.token = null; state.profile = null; state.attempts.clear(); state.cards.clear(); localStorage.removeItem("nhhs_token");
  updateStats(); renderIdioms(); renderCards(); $("#rankList").innerHTML = "登录后查看排行榜。"; $("#rankList").className = "rank-list empty";
}
async function loadProgress() {
  if (!state.token) return;
  try {
    const result = await api("bootstrap", { method: "GET" });
    state.profile = result.profile;
    state.attempts = new Map(result.attempts.map((item) => [item.idiom_num, item]));
    state.cards = new Set(result.cards.map((item) => item.idiom_num));
    updateStats(); renderIdioms(); renderCards();
  } catch { logout(); }
}
async function loadRank(scope = "teaching") {
  if (!state.profile) { $("#rankList").innerHTML = "登录后查看排行榜。"; return; }
  $("#rankList").innerHTML = '<p class="loading">排行榜加载中……</p>';
  try {
    const result = await api(`leaderboard?scope=${scope}`, { method: "GET" });
    $("#rankList").className = "rank-list";
    $("#rankList").innerHTML = result.rows.map((row, index) => `<div class="rank-row"><span class="rank-pos">${index + 1}</span><strong>${escapeHtml(row.label)}</strong><span class="rank-class">${escapeHtml(row.teaching_class)}</span><span class="rank-gold">★ ${row.gold}</span></div>`).join("") || '<p class="empty">还没有排行榜记录。</p>';
  } catch (error) { $("#rankList").innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`; }
}

async function init() {
  state.data = await fetch("/data/idioms.json").then((response) => response.json());
  $("#adminClass").innerHTML += ["101","102","103","104","105","106","107","108","201","202","203","204","205","206","207","208"].map((value) => `<option>${value}</option>`).join("");
  renderGroups(); renderIdioms(); renderCards(); updateStats(); await loadProgress();
  $("#loginBtn").addEventListener("click", () => show("#loginModal"));
  $("#logoutBtn").addEventListener("click", logout);
  $("#loginForm").addEventListener("submit", login);
  $("#startQuiz").addEventListener("click", openQuiz);
  $("#quizForm").addEventListener("submit", submitQuiz);
  $$("[data-close]").forEach((button) => button.addEventListener("click", () => hide("#loginModal")));
  $$("[data-close-reader]").forEach((button) => button.addEventListener("click", () => hide("#readerModal")));
  $$("[data-close-quiz]").forEach((button) => button.addEventListener("click", () => hide("#quizModal")));
  $$("[data-close-result]").forEach((button) => button.addEventListener("click", () => hide("#resultModal")));
  $$(".tab").forEach((tab) => tab.addEventListener("click", () => {
    $$(".tab").forEach((item) => item.classList.toggle("active", item === tab));
    ["learn","cards","rank"].forEach((name) => $(`#${name}View`).classList.toggle("hidden", name !== tab.dataset.view));
    if (tab.dataset.view === "rank") loadRank();
  }));
  $$(".chip").forEach((chip) => chip.addEventListener("click", () => {
    $$(".chip").forEach((item) => item.classList.toggle("active", item === chip)); loadRank(chip.dataset.scope);
  }));
}
init().catch(() => { $("#idiomGrid").innerHTML = '<p class="empty">网页资料加载失败，请刷新重试。</p>'; });
