import { readToken } from "./lib/crypto.mjs";
import { db, one } from "./lib/supabase.mjs";
import { fail, json, method } from "./lib/http.mjs";

export const handler = async (event) => {
  try {
    method(event, ["GET"]);
    const session = readToken(event, "student");
    const me = await one("students", `select=id,admin_class,student_number,course_type,teaching_class&active=eq.true&id=eq.${session.sid}`);
    if (!me) return json(401, { ok: false, error: "学生账号已停用" });
    const scope = event.queryStringParameters?.scope || "teaching";
    if (!["teaching", "admin", "course"].includes(scope)) return json(400, { ok: false, error: "排行榜范围不正确" });
    const rows = await db("rpc/get_student_leaderboard", {
      method: "POST",
      body: { p_student_id: session.sid, p_scope: scope }
    });
    return json(200, { ok: true, scope, rows });
  } catch (error) {
    return fail(error);
  }
};
