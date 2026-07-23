import { hashLoginCode, randomCode, readToken } from "./lib/crypto.mjs";
import { db } from "./lib/supabase.mjs";
import { fail, json, method, parseBody } from "./lib/http.mjs";

const validClass = /^(10[1-8]|20[1-8])$/;
const normalize = (row) => ({
  admin_class: String(row.admin_class || "").trim(),
  student_number: String(row.student_number || "").trim().padStart(2, "0"),
  course_type: String(row.course_type || "").trim().toUpperCase(),
  teaching_class: String(row.teaching_class || "").trim()
});

export const handler = async (event) => {
  try {
    method(event);
    readToken(event, "teacher");
    const { students = [] } = parseBody(event);
    if (!Array.isArray(students) || students.length < 1 || students.length > 800) {
      return json(400, { ok: false, error: "名单必须包含1至800名学生" });
    }
    const seen = new Set();
    const errors = [];
    const prepared = students.map((raw, index) => {
      const row = normalize(raw);
      const key = `${row.admin_class}-${row.student_number}`;
      if (!validClass.test(row.admin_class)) errors.push(`第${index + 2}行：行政班不正确`);
      if (!/^[0-9]{1,3}$/.test(row.student_number)) errors.push(`第${index + 2}行：学号不正确`);
      if (!["HCL", "CL"].includes(row.course_type)) errors.push(`第${index + 2}行：课程必须是HCL或CL`);
      if (!row.teaching_class) errors.push(`第${index + 2}行：教学班不能为空`);
      if (seen.has(key)) errors.push(`第${index + 2}行：行政班与学号重复`);
      seen.add(key);
      const login_code = randomCode();
      return { ...row, login_code, login_code_hash: hashLoginCode(login_code) };
    });
    if (errors.length) return json(400, { ok: false, error: errors.slice(0, 20).join("\n") });

    const payload = prepared.map(({ login_code, ...row }) => row);
    await db("students", {
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
  } catch (error) {
    return fail(error);
  }
};
