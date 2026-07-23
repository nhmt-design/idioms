const $ = (selector) => document.querySelector(selector);
let teacherToken = sessionStorage.getItem("nhhs_teacher_token");
let roster = [];
let imported = [];

const csvCell = (value) => `"${String(value).replaceAll('"', '""')}"`;
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
  const headers = parseCsvLine(lines.shift()).map((item) => item.trim().toLowerCase());
  const required = ["admin_class","student_number","course_type","teaching_class"];
  if (!required.every((name) => headers.includes(name))) throw new Error(`CSV标题必须是：${required.join(", ")}`);
  return lines.map((line) => Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value])));
};
const api = async (path, body) => {
  const response = await fetch(`/api/${path}`, { method: "POST", headers: { "content-type": "application/json", ...(teacherToken ? { authorization: `Bearer ${teacherToken}` } : {}) }, body: JSON.stringify(body) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || "请求失败"); return result;
};
const enter = () => { $("#teacherLogin").classList.add("hidden"); $("#rosterPanel").classList.remove("hidden"); };
if (teacherToken) enter();

$("#teacherLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault(); $("#teacherError").textContent = "";
  try { const result = await api("teacher-login", { password: $("#teacherPassword").value }); teacherToken = result.token; sessionStorage.setItem("nhhs_teacher_token", teacherToken); enter(); }
  catch (error) { $("#teacherError").textContent = error.message; }
});
$("#rosterFile").addEventListener("change", async (event) => {
  $("#rosterError").textContent = ""; $("#previewPanel").classList.add("hidden");
  try {
    roster = parseCsv(await event.target.files[0].text());
    if (!roster.length) throw new Error("CSV内没有学生资料");
    const grouped = roster.reduce((map, row) => map.set(row.teaching_class, (map.get(row.teaching_class) || 0) + 1), new Map());
    $("#previewSummary").textContent = `共${roster.length}名学生，${grouped.size}个教学班`;
    $("#classPreview").innerHTML = [...grouped].map(([name, count]) => `<article class="group-card open"><strong>${name}</strong><span>教学班</span><b>${count}人</b></article>`).join("");
    $("#previewPanel").classList.remove("hidden");
  } catch (error) { $("#rosterError").textContent = error.message; }
});
$("#importBtn").addEventListener("click", async () => {
  const button = $("#importBtn"); button.disabled = true; button.textContent = "正在安全导入……";
  try {
    const result = await api("import-roster", { students: roster });
    imported = result.students; $("#importSummary").textContent = `已导入${result.count}名学生`;
    $("#downloadPanel").classList.remove("hidden"); $("#downloadPanel").scrollIntoView({ behavior: "smooth" });
  } catch (error) { $("#rosterError").textContent = error.message; }
  finally { button.disabled = false; button.textContent = "确认导入并生成登录码"; }
});
$("#downloadCodes").addEventListener("click", () => {
  const header = ["行政班","学号","课程","教学班","个人登录码"];
  const rows = imported.map((row) => [row.admin_class,row.student_number,row.course_type,row.teaching_class,row.login_code]);
  const csv = "\uFEFF" + [header,...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); link.download = `学生个人登录码_${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
});
