import { readToken } from "./lib/crypto.mjs";
import { db, one } from "./lib/supabase.mjs";
import { fail, json, method, parseBody } from "./lib/http.mjs";

export const handler = async (event) => {
  try {
    method(event);
    const session = readToken(event, "student");
    const { idiom_num, answers } = parseBody(event);
    const idiomNum = Number(idiom_num);
    if (!Number.isInteger(idiomNum) || !Array.isArray(answers)) return json(400, { ok: false, error: "答案资料不完整" });
    const keyRow = await one("idiom_answers", `select=answer_key,explanations&idiom_num=eq.${idiomNum}`);
    if (!keyRow) return json(404, { ok: false, error: "这个成语暂未开放答题" });
    const key = keyRow.answer_key;
    if (answers.length !== key.length || answers.some((answer) => !Number.isInteger(answer))) {
      return json(400, { ok: false, error: "请完成全部题目后再提交" });
    }
    const score = answers.reduce((sum, answer, index) => sum + Number(answer === key[index]), 0);
    const allCorrect = score === key.length;
    const existing = await one("attempts", `select=id,first_attempt_correct,practice_completed,attempt_count&student_id=eq.${session.sid}&idiom_num=eq.${idiomNum}`);
    let awarded = false;
    if (!existing) {
      await db("attempts", {
        method: "POST",
        body: {
          student_id: session.sid,
          idiom_num: idiomNum,
          first_attempt_correct: allCorrect,
          first_attempt_answers: answers,
          practice_completed: allCorrect,
          attempt_count: 1,
          last_score: score
        }
      });
      if (allCorrect) {
        await db("gold_cards", {
          method: "POST",
          query: "on_conflict=student_id,idiom_num",
          body: { student_id: session.sid, idiom_num: idiomNum },
          prefer: "resolution=ignore-duplicates,return=minimal"
        });
        awarded = true;
      }
    } else {
      await db("attempts", {
        method: "PATCH",
        query: `student_id=eq.${session.sid}&idiom_num=eq.${idiomNum}`,
        body: {
          practice_completed: existing.practice_completed || allCorrect,
          attempt_count: existing.attempt_count + 1,
          last_score: score,
          updated_at: new Date().toISOString()
        }
      });
    }
    return json(200, {
      ok: true,
      score,
      total: key.length,
      all_correct: allCorrect,
      first_attempt: !existing,
      awarded,
      correct_answers: key,
      explanations: keyRow.explanations
    });
  } catch (error) {
    return fail(error);
  }
};
