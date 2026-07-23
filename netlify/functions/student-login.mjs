import { createToken, hashLoginCode } from "./lib/crypto.mjs";
import { one } from "./lib/supabase.mjs";
import { fail, json, method, parseBody } from "./lib/http.mjs";

export const handler = async (event) => {
  try {
    method(event);
    const body = parseBody(event);
    const adminClass = String(body.admin_class || "").trim();
    const studentNumber = String(body.student_number || "").trim().padStart(2, "0");
    const codeHash = hashLoginCode(body.login_code || "");
    const student = await one(
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
    return json(200, { ok: true, token: createToken({ role: "student", sid: student.id }), profile });
  } catch (error) {
    return fail(error);
  }
};
