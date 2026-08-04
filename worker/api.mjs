import { hashLoginCode, createToken, randomCode, readToken, safeEqual } from "./lib/crypto.mjs";
import { config } from "./lib/config.mjs";
import { db, one } from "./lib/supabase.mjs";
import { json, method, parseBody } from "./lib/http.mjs";

const validClass = /^(10[1-8]|20[1-8])$/u;
const normalizeStudent = (row) => ({
  admin_class: String(row.admin_class || "").trim(),
  student_number: String(row.student_number || "").trim().padStart(2, "0"),
  course_type: String(row.course_type || "").trim().toUpperCase(),
  teaching_class: String(row.teaching_class || "").trim()
});

const studentLogin = async (request, env) => {
  method(request);
  const body = await parseBody(request);
  const adminClass = String(body.admin_class || "").trim();
  const studentNumber = String(body.student_number || "").trim().padStart(2, "0");
  const codeHash = await hashLoginCode(env, body.login_code || "");
  const student = await one(
    env,
    "students",
    `select=id,admin_class,student_number,course_type,teaching_class,active&admin_class=eq.${encodeURIComponent(adminClass)}&student_number=eq.${encodeURIComponent(studentNumber)}&login_code_hash=eq.${codeHash}&active=eq.true`
  );
  if (!student) return json(401, { ok: false, error: "班级、学号或登录码不正确" });
  const profile = {
    id: student.id,
    admin_class: student.admin_class,
    student_number: student.student_number,
    course_type: student.course_type,
    teaching_class: student.teaching_class
  };
  return json(200, {
    ok: true,
    token: await createToken(env, { role: "student", sid: student.id }),
    profile
  });
};

const bootstrap = async (request, env) => {
  method(request, ["GET"]);
  const session = await readToken(request, env, "student");
  const student = await one(env, "students", `select=id,admin_class,student_number,course_type,teaching_class&active=eq.true&id=eq.${session.sid}`);
  if (!student) return json(401, { ok: false, error: "学生账号已停用" });
  const [attempts, cards] = await Promise.all([
    db(env, "attempts", { query: `select=idiom_num,first_attempt_correct,practice_completed,attempt_count,last_score&student_id=eq.${session.sid}` }),
    db(env, "gold_cards", { query: `select=idiom_num,awarded_at&student_id=eq.${session.sid}` })
  ]);
  return json(200, { ok: true, profile: student, attempts, cards });
};

const submitAttempt = async (request, env) => {
  method(request);
  const session = await readToken(request, env, "student");
  const { idiom_num, answers } = await parseBody(request);
  const idiomNum = Number(idiom_num);
  if (!Number.isInteger(idiomNum) || !Array.isArray(answers) || answers.some((answer) => !Number.isInteger(answer))) {
    return json(400, { ok: false, error: "答案资料不完整" });
  }
  const result = await db(env, "rpc/submit_idiom_attempt", {
    method: "POST",
    body: { p_student_id: session.sid, p_idiom_num: idiomNum, p_answers: answers }
  });
  if (!result?.ok) {
    const errors = {
      STUDENT_INACTIVE: [401, "学生账号已停用"],
      IDIOM_NOT_OPEN: [404, "这个成语暂未开放答题"],
      INVALID_ANSWERS: [400, "请完成全部题目后再提交"]
    };
    const [status, message] = errors[result?.code] || [400, "答案资料不完整"];
    return json(status, { ok: false, error: message });
  }
  return json(200, result);
};

const leaderboard = async (request, env) => {
  method(request, ["GET"]);
  const session = await readToken(request, env, "student");
  const me = await one(env, "students", `select=id,admin_class,student_number,course_type,teaching_class&active=eq.true&id=eq.${session.sid}`);
  if (!me) return json(401, { ok: false, error: "学生账号已停用" });
  const scope = new URL(request.url).searchParams.get("scope") || "teaching";
  if (!["teaching", "admin", "course"].includes(scope)) return json(400, { ok: false, error: "排行榜范围不正确" });
  const rows = await db(env, "rpc/get_student_leaderboard", {
    method: "POST",
    body: { p_student_id: session.sid, p_scope: scope }
  });
  return json(200, { ok: true, scope, rows });
};

const teacherLogin = async (request, env) => {
  method(request);
  const { password = "" } = await parseBody(request);
  if (!safeEqual(password, config(env).TEACHER_PASSWORD)) {
    return json(401, { ok: false, error: "教师密码不正确" });
  }
  return json(200, {
    ok: true,
    token: await createToken(env, { role: "teacher" }, 60 * 60 * 4)
  });
};

const importRoster = async (request, env) => {
  method(request);
  await readToken(request, env, "teacher");
  const { students = [] } = await parseBody(request);
  if (!Array.isArray(students) || students.length < 1 || students.length > 100) {
    return json(400, { ok: false, error: "每批名单必须包含1至100名学生" });
  }
  const seen = new Set();
  const errors = [];
  const prepared = await Promise.all(students.map(async (raw, index) => {
    const row = normalizeStudent(raw);
    const key = `${row.admin_class}-${row.student_number}`;
    if (!validClass.test(row.admin_class)) errors.push(`第${index + 2}行：行政班不正确`);
    if (!/^[0-9]{1,3}$/u.test(row.student_number)) errors.push(`第${index + 2}行：学号不正确`);
    if (!["HCL", "CL"].includes(row.course_type)) errors.push(`第${index + 2}行：课程必须是HCL或CL`);
    if (!row.teaching_class) errors.push(`第${index + 2}行：教学班不能为空`);
    if (seen.has(key)) errors.push(`第${index + 2}行：行政班与学号重复`);
    seen.add(key);
    const login_code = randomCode();
    return { ...row, login_code, login_code_hash: await hashLoginCode(env, login_code) };
  }));
  if (errors.length) return json(400, { ok: false, error: errors.slice(0, 20).join("\n") });

  const payload = prepared.map(({ login_code, ...row }) => row);
  await db(env, "students", {
    method: "POST",
    query: "on_conflict=admin_class,student_number",
    body: payload,
    prefer: "resolution=merge-duplicates,return=minimal"
  });
  return json(200, {
    ok: true,
    count: prepared.length,
    students: prepared.map(({ login_code_hash, ...row }) => row)
  });
};

const teacherResults = async (request, env) => {
  method(request);
  await readToken(request, env, "teacher");
  const result = await db(env, "rpc/get_teacher_results", { method: "POST", body: {} });
  return json(200, { ok: true, ...result });
};

export const routes = new Map([
  ["/api/student-login", studentLogin],
  ["/api/bootstrap", bootstrap],
  ["/api/submit-attempt", submitAttempt],
  ["/api/leaderboard", leaderboard],
  ["/api/teacher-login", teacherLogin],
  ["/api/import-roster", importRoster],
  ["/api/teacher-results", teacherResults]
]);
