import { readToken } from "./lib/crypto.mjs";
import { db, one } from "./lib/supabase.mjs";
import { fail, json, method } from "./lib/http.mjs";

export const handler = async (event) => {
  try {
    method(event, ["GET"]);
    const session = readToken(event, "student");
    const student = await one("students", `select=id,admin_class,student_number,course_type,teaching_class&active=eq.true&id=eq.${session.sid}`);
    if (!student) return json(401, { ok: false, error: "学生账号已停用" });
    const [attempts, cards] = await Promise.all([
      db("attempts", { query: `select=idiom_num,first_attempt_correct,practice_completed,attempt_count,last_score&student_id=eq.${session.sid}` }),
      db("gold_cards", { query: `select=idiom_num,awarded_at&student_id=eq.${session.sid}` })
    ]);
    return json(200, { ok: true, profile: student, attempts, cards });
  } catch (error) {
    return fail(error);
  }
};
