import test from "node:test";
import assert from "node:assert/strict";
import { buildTeacherResults } from "../netlify/functions/teacher-results.mjs";

test("teacher results aggregate every active student and use the dynamic open idiom count", () => {
  const students = [
    { id: "a", admin_class: "101", student_number: "01", course_type: "HCL", teaching_class: "HCL-1" },
    { id: "b", admin_class: "102", student_number: "02", course_type: "CL", teaching_class: "CL-1" }
  ];
  const attempts = [
    { student_id: "a", idiom_num: 47, first_attempt_correct: true, practice_completed: true, attempt_count: 1, last_score: 3, updated_at: "2026-07-29T10:00:00Z" },
    { student_id: "a", idiom_num: 48, first_attempt_correct: false, practice_completed: true, attempt_count: 2, last_score: 3, updated_at: "2026-07-30T10:00:00Z" }
  ];
  const cards = [{ student_id: "a", idiom_num: 47 }];
  const idioms = [
    { idiom_num: 47, idiom_name: "成语一" },
    { idiom_num: 48, idiom_name: "成语二" },
    { idiom_num: 49, idiom_name: "成语三" }
  ];
  const result = buildTeacherResults(students, attempts, cards, idioms);
  assert.equal(result.open_idiom_count, 3);
  assert.deepEqual(result.summary, { student_count: 2, participating_count: 1, average_completed: 1, first_correct_rate: 50, gold_card_count: 1 });
  assert.equal(result.students[0].completion_rate, 67);
  assert.equal(result.students[0].first_correct_rate, 50);
  assert.equal(result.students[0].attempt_count, 3);
  assert.equal(result.students[1].first_correct_rate, null);
});
