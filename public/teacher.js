const $ = (selector) => document.querySelector(selector);
let teacherToken = sessionStorage.getItem("nhhs_teacher_token");
let roster = [], imported = [], results = [], filteredResults = [], openIdiomCount = 0;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const percent = (value) => value === null ? "—" : `${value}%`;
const formatDate = (value) => value ? new Intl.DateTimeFormat("zh-SG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "尚未开始";
const parseCsvLine = (line) => {
  const cells = []; let cell = ""; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { cells.push(cell.trim()); cell = ""; }
    else cell += char;
  }
  cells.push(cell.trim()); return cells;
};
const parseCsv = (text) => {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) throw new Error("CSV 内没有资料");
  const headers = parseCsvLine(lines.shift()).map((item) => item.trim().toLowerCase());
  const required = ["admin_class", "student_number", "course_type", "teaching_class"];
  if (!required.every((name) => headers.includes(name))) throw new Error(`CSV 标题必须是：${required.join(", ")}`);
  return lines.map((line) => Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value])));
};
const api = async (path, body = {}) => {
  const response = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(teacherToken ? { authorization: `Bearer ${teacherToken}` } : {}) },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) logout();
    throw new Error(result.error || "请求失败");
  }
  return result;
};
const enter = () => {
  $("#teacherLogin").classList.add("hidden"); $("#teacherWorkspace").classList.remove("hidden"); $("#logoutBtn").classList.remove("hidden");
  loadTeacherResults();
};
const logout = () => {
  teacherToken = null; sessionStorage.removeItem("nhhs_teacher_token");
  $("#teacherWorkspace").classList.add("hidden"); $("#logoutBtn").classList.add("hidden"); $("#teacherLogin").classList.remove("hidden");
};
const getStatus = (student) => {
  if (!student.last_activity_at) return { key: "not-started", label: "未开始" };
  const inactiveDays = (Date.now() - new Date(student.last_activity_at).getTime()) / 86400000;
  if (inactiveDays > 7 || (student.first_correct_rate !== null && student.first_correct_rate < 60)) return { key: "attention", label: "需关注" };
  return { key: "normal", label: "正常" };
};
const fillSelect = (selector, values, label) => {
  const select = $(selector), current = select.value;
  select.innerHTML = `<option value="">全部${label}</option>${[...new Set(values)].sort((a, b) => a.localeCompare(b, "zh-Hans-CN", { numeric: true })).map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
  if ([...select.options].some((option) => option.value === current)) select.value = current;
};
const renderSummary = (summary) => {
  const cards = [
    ["学生总数", summary.student_count, "全部在籍学生"], ["已参与人数", summary.participating_count, "至少完成一次作答"],
    ["平均完成数", summary.average_completed, `每人平均／开放 ${openIdiomCount} 个`],
    ["首次全对率", percent(summary.first_correct_rate), "按全部首次作答计算"], ["已发金卡", summary.gold_card_count, "全校累计"]
  ];
  $("#summaryCards").innerHTML = cards.map(([title, value, note]) => `<article class="summary-card"><span>${title}</span><strong>${value}</strong><small>${note}</small></article>`).join("");
};
const applyFilters = () => {
  const adminClass = $("#adminClassFilter").value, teachingClass = $("#teachingClassFilter").value;
  const course = $("#courseFilter").value, status = $("#statusFilter").value, search = $("#studentSearch").value.trim().toLowerCase();
  filteredResults = results.filter((student) => {
    const searchable = `${student.admin_class} ${student.student_number} ${student.teaching_class}`.toLowerCase();
    return (!adminClass || student.admin_class === adminClass) && (!teachingClass || student.teaching_class === teachingClass)
      && (!course || student.course_type === course) && (!status || getStatus(student).key === status)
      && (!search || searchable.includes(search));
  });
  renderStudentTable();
};
const renderStudentTable = () => {
  $("#resultCount").textContent = `显示 ${filteredResults.length}／${results.length} 名学生；当前开放 ${openIdiomCount} 个成语。`;
  $("#studentResultsBody").innerHTML = filteredResults.length ? filteredResults.map((student) => {
    const status = getStatus(student);
    return `<tr><td>${escapeHtml(student.admin_class)}</td><td>${escapeHtml(student.student_number)}</td><td>${escapeHtml(student.course_type)}</td><td>${escapeHtml(student.teaching_class)}</td><td>${student.attempted_count}/${openIdiomCount}</td><td>${student.completed_count}/${openIdiomCount}</td><td>${percent(student.first_correct_rate)}</td><td>${student.gold_card_count}</td><td>${student.attempt_count}</td><td>${escapeHtml(formatDate(student.last_activity_at))}</td><td><span class="learning-status ${status.key}">${status.label}</span></td><td><button class="text-button" type="button" data-student-id="${student.id}">详情</button></td></tr>`;
  }).join("") : `<tr><td colspan="12" class="empty">没有符合筛选条件的学生。</td></tr>`;
};
const loadTeacherResults = async () => {
  $("#resultsError").textContent = ""; $("#studentResultsBody").innerHTML = `<tr><td colspan="12" class="loading">正在读取成绩……</td></tr>`;
  try {
    const data = await api("teacher-results");
    results = data.students; openIdiomCount = data.open_idiom_count;
    renderSummary(data.summary);
    fillSelect("#adminClassFilter", results.map((student) => student.admin_class), "行政班");
    fillSelect("#teachingClassFilter", results.map((student) => student.teaching_class), "教学班");
    applyFilters();
  } catch (error) {
    $("#resultsError").textContent = error.message;
    $("#studentResultsBody").innerHTML = `<tr><td colspan="12" class="empty">暂时无法读取成绩。</td></tr>`;
  }
};
const showStudentDetails = (studentId) => {
  const student = results.find((item) => item.id === studentId); if (!student) return;
  $("#studentDetailTitle").textContent = `${student.admin_class} 班 · ${student.student_number} 号`;
  const rows = student.idioms.length ? student.idioms.map((idiom) => `<tr><td>${idiom.idiom_num}</td><td>${escapeHtml(idiom.idiom_name)}</td><td>${idiom.first_attempt_correct ? "全对" : "未全对"}</td><td>${idiom.practice_completed ? "已完成" : "练习中"}</td><td>${idiom.last_score}</td><td>${idiom.attempt_count}</td><td>${escapeHtml(formatDate(idiom.updated_at))}</td></tr>`).join("") : `<tr><td colspan="7" class="empty">这名学生尚未开始作答。</td></tr>`;
  $("#studentDetailContent").innerHTML = `<p class="student-meta">${escapeHtml(student.course_type)} · ${escapeHtml(student.teaching_class)} · 已完成 ${student.completed_count}/${openIdiomCount} · 金卡 ${student.gold_card_count} 张</p><div class="results-table-wrap"><table class="results-table detail-table"><thead><tr><th>编号</th><th>成语</th><th>首次</th><th>状态</th><th>最近得分</th><th>次数</th><th>更新时间</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  $("#studentDetailModal").classList.remove("hidden");
};
const downloadCsv = (filename, rows) => {
  const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
};
const exportResultsCsv = () => {
  const header = ["行政班", "学号", "课程", "教学班", "已作答", "已完成", "完成率", "首次全对率", "金卡数", "作答次数", "最近学习", "状态"];
  const rows = filteredResults.map((student) => [student.admin_class, student.student_number, student.course_type, student.teaching_class, student.attempted_count, student.completed_count, percent(student.completion_rate), percent(student.first_correct_rate), student.gold_card_count, student.attempt_count, formatDate(student.last_activity_at), getStatus(student).label]);
  downloadCsv(`学生成绩_${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
};

$("#teacherLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault(); $("#teacherError").textContent = "";
  try {
    const result = await api("teacher-login", { password: $("#teacherPassword").value });
    teacherToken = result.token; sessionStorage.setItem("nhhs_teacher_token", teacherToken); $("#teacherPassword").value = ""; enter();
  } catch (error) { $("#teacherError").textContent = error.message; }
});
$("#logoutBtn").addEventListener("click", logout);
$("#refreshResults").addEventListener("click", loadTeacherResults);
$("#exportResults").addEventListener("click", exportResultsCsv);
["#adminClassFilter", "#teachingClassFilter", "#courseFilter", "#statusFilter"].forEach((selector) => $(selector).addEventListener("change", applyFilters));
$("#studentSearch").addEventListener("input", applyFilters);
$("#studentResultsBody").addEventListener("click", (event) => { const button = event.target.closest("[data-student-id]"); if (button) showStudentDetails(button.dataset.studentId); });
$("#closeStudentDetail").addEventListener("click", () => $("#studentDetailModal").classList.add("hidden"));
$("#studentDetailModal").addEventListener("click", (event) => { if (event.target === $("#studentDetailModal")) $("#studentDetailModal").classList.add("hidden"); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") $("#studentDetailModal").classList.add("hidden"); });
document.querySelectorAll(".teacher-tabs .tab").forEach((tab) => tab.addEventListener("click", () => {
  document.querySelectorAll(".teacher-tabs .tab").forEach((item) => item.classList.toggle("active", item === tab));
  ["resultsPanel", "rosterPanel"].forEach((id) => $(`#${id}`).classList.toggle("hidden", id !== tab.dataset.panel));
}));
$("#rosterFile").addEventListener("change", async (event) => {
  $("#rosterError").textContent = ""; $("#previewPanel").classList.add("hidden");
  try {
    if (!event.target.files[0]) return;
    roster = parseCsv(await event.target.files[0].text()); if (!roster.length) throw new Error("CSV 内没有学生资料");
    const grouped = roster.reduce((map, row) => map.set(row.teaching_class, (map.get(row.teaching_class) || 0) + 1), new Map());
    $("#previewSummary").textContent = `共 ${roster.length} 名学生，${grouped.size} 个教学班`;
    $("#classPreview").innerHTML = [...grouped].map(([name, count]) => `<article class="group-card open"><strong>${escapeHtml(name)}</strong><span>教学班</span><b>${count} 人</b></article>`).join("");
    $("#previewPanel").classList.remove("hidden");
  } catch (error) { $("#rosterError").textContent = error.message; }
});
$("#importBtn").addEventListener("click", async () => {
  const button = $("#importBtn"); button.disabled = true; button.textContent = "正在安全导入……";
  try {
    const result = await api("import-roster", { students: roster }); imported = result.students;
    $("#importSummary").textContent = `已导入 ${result.count} 名学生`; $("#downloadPanel").classList.remove("hidden");
    $("#downloadPanel").scrollIntoView({ behavior: "smooth" }); await loadTeacherResults();
  } catch (error) { $("#rosterError").textContent = error.message; }
  finally { button.disabled = false; button.textContent = "确认导入并生成登录码"; }
});
$("#downloadCodes").addEventListener("click", () => {
  const header = ["行政班", "学号", "课程", "教学班", "个人登录码"];
  const rows = imported.map((row) => [row.admin_class, row.student_number, row.course_type, row.teaching_class, row.login_code]);
  downloadCsv(`学生个人登录码_${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
});
if (teacherToken) enter();
