import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../worker/index.mjs";
import { createToken } from "../worker/lib/crypto.mjs";

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
  SESSION_SECRET: "session-secret-that-is-long-enough-for-tests",
  LOGIN_CODE_PEPPER: "login-pepper-that-is-long-enough-for-tests",
  TEACHER_PASSWORD: "teacher-test-password",
  ASSETS: { fetch: async () => new Response("asset") }
};

test("Cloudflare worker files do not use Node-only runtime APIs", () => {
  const root = fileURLToPath(new URL("../worker", import.meta.url));
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (entry.name.endsWith(".mjs")) files.push(target);
    }
  };
  walk(root);
  const source = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.equal(/from ["']node:/u.test(source), false);
  assert.equal(/\bBuffer\b/u.test(source), false);
  assert.equal(/process\.env/u.test(source), false);
});

test("student login uses Supabase and returns a signed Cloudflare-compatible token", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls += 1;
    assert.match(String(url), /\/rest\/v1\/students\?/u);
    return new Response(JSON.stringify([{
      id: "11111111-1111-4111-8111-111111111111",
      admin_class: "101",
      student_number: "01",
      course_type: "HCL",
      teaching_class: "101-HCL",
      active: true
    }]), { status: 200 });
  };
  try {
    const response = await worker.fetch(new Request("https://example.com/api/student-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ admin_class: "101", student_number: "1", login_code: "ABCDEFGH" })
    }), env);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.profile.student_number, "01");
    assert.match(body.token, /^[^.]+\.[^.]+$/u);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("submit attempt returns progress in one dynamic request", async () => {
  const originalFetch = globalThis.fetch;
  const token = await createToken(env, { role: "student", sid: "11111111-1111-4111-8111-111111111111" });
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls += 1;
    assert.match(String(url), /\/rest\/v1\/rpc\/submit_idiom_attempt$/u);
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
    const response = await worker.fetch(new Request("https://example.com/api/submit-attempt", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ idiom_num: 47, answers: [0, 1, 2] })
    }), env);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.attempt.idiom_num, 47);
    assert.equal(body.awarded, true);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("unknown API route stays JSON instead of falling back to the SPA", async () => {
  const response = await worker.fetch(new Request("https://example.com/api/not-found"), env);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { ok: false, error: "接口不存在" });
});
