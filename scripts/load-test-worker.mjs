import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import worker from "../worker/index.mjs";
import { createToken } from "../worker/lib/crypto.mjs";

const concurrentStudents = 700;
const env = {
  SUPABASE_URL: "https://load-test.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "load-test-service-role-key",
  SESSION_SECRET: "load-test-session-secret-at-least-32-characters",
  LOGIN_CODE_PEPPER: "load-test-login-pepper-at-least-32-characters",
  TEACHER_PASSWORD: "load-test-teacher-password"
};
const token = await createToken(env, {
  role: "student",
  sid: "11111111-1111-4111-8111-111111111111"
});

let databaseCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  databaseCalls += 1;
  return new Response(JSON.stringify({
    ok: true,
    score: 3,
    total: 3,
    all_correct: true,
    first_attempt: true,
    awarded: true,
    correct_answers: [0, 1, 2],
    explanations: [["A"], ["B"], ["C"]],
    attempt: {
      idiom_num: 47,
      first_attempt_correct: true,
      practice_completed: true,
      attempt_count: 1,
      last_score: 3
    }
  }), { status: 200 });
};

try {
  const started = performance.now();
  const responses = await Promise.all(Array.from({ length: concurrentStudents }, () =>
    worker.fetch(new Request("https://example.com/api/submit-attempt", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ idiom_num: 47, answers: [0, 1, 2] })
    }), env)
  ));
  const elapsed = performance.now() - started;
  assert.equal(responses.every((response) => response.status === 200), true);
  assert.equal(databaseCalls, concurrentStudents);
  console.log(`Local simulation passed: ${concurrentStudents} submissions, ${databaseCalls} database calls, ${elapsed.toFixed(0)} ms.`);
} finally {
  globalThis.fetch = originalFetch;
}
