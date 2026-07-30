import { readToken } from "./lib/crypto.mjs";
import { db } from "./lib/supabase.mjs";
import { fail, json, method } from "./lib/http.mjs";

const safeRate = (numerator, denominator) =>
  denominator ? Math.round((numerator / denominator) * 100) : null;

const dbAll = async (table, query) => {
  const pageSize = 1000;
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await db(table, { query: `${query}&limit=${pageSize}&offset=${offset}` });
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
};

export const buildTeacherResults = (students, attempts, cards, idioms) => {
  const attemptMap = new Map();
  for (const attempt of attempts) {
    if (!attemptMap.has(attempt.student_id)) attemptMap.set(attempt.student_id, []);
    attemptMap.get(attempt.student_id).push(attempt);
  }
  const cardMap = new Map();
  for (const card of cards) cardMap.set(card.student_id, (cardMap.get(card.student_id) || 0) + 1);
  const idiomMap = new Map(idioms.map((idiom) => [idiom.idiom_num, idiom.idiom_name]));
  const openCount = idioms.length;
  const results = students.map((student) => {
    const records = (attemptMap.get(student.id) || []).sort((a, b) => a.idiom_num - b.idiom_num);
    const completed = records.filter((record) => record.practice_completed).length;
    const firstCorrect = records.filter((record) => record.first_attempt_correct).length;
    const latest = records.reduce(
      (value, record) => (!value || record.updated_at > value ? record.updated_at : value), null
    );
    return {
      id: student.id,
      admin_class: student.admin_class,
      student_number: student.student_number,
      course_type: student.course_type,
      teaching_class: student.teaching_class,
      attempted_count: records.length,
      completed_count: completed,
      completion_rate: safeRate(completed, openCount),
      first_correct_count: firstCorrect,
      first_correct_rate: safeRate(firstCorrect, records.length),
      gold_card_count: cardMap.get(student.id) || 0,
      attempt_count: records.reduce((sum, record) => sum + record.attempt_count, 0),
      last_activity_at: latest,
      idioms: records.map((record) => ({
        idiom_num: record.idiom_num,
        idiom_name: idiomMap.get(record.idiom_num) || `成语 ${record.idiom_num}`,
        first_attempt_correct: record.first_attempt_correct,
        practice_completed: record.practice_completed,
        attempt_count: record.attempt_count,
        last_score: record.last_score,
        updated_at: record.updated_at
      }))
    };
  });
  const activeResults = results.filter((student) => student.attempted_count > 0);
  const totalFirstAttempts = results.reduce((sum, student) => sum + student.attempted_count, 0);
  const totalFirstCorrect = results.reduce((sum, student) => sum + student.first_correct_count, 0);
  return {
    open_idiom_count: openCount,
    summary: {
      student_count: results.length,
      participating_count: activeResults.length,
      average_completed: results.length
        ? Number((results.reduce((sum, student) => sum + student.completed_count, 0) / results.length).toFixed(1))
        : 0,
      first_correct_rate: safeRate(totalFirstCorrect, totalFirstAttempts),
      gold_card_count: cards.length
    },
    students: results
  };
};

export const handler = async (event) => {
  try {
    method(event);
    readToken(event, "teacher");
    const [students, attempts, cards, idioms] = await Promise.all([
      dbAll("students", "select=id,admin_class,student_number,course_type,teaching_class&active=eq.true&order=admin_class.asc,student_number.asc"),
      dbAll("attempts", "select=student_id,idiom_num,first_attempt_correct,practice_completed,attempt_count,last_score,updated_at&order=id.asc"),
      dbAll("gold_cards", "select=student_id,idiom_num,awarded_at&order=id.asc"),
      dbAll("idiom_answers", "select=idiom_num,idiom_name&order=idiom_num.asc")
    ]);
    return json(200, { ok: true, ...buildTeacherResults(students, attempts, cards, idioms) });
  } catch (error) {
    return fail(error);
  }
};
