import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

const target = String(process.env.LOAD_TEST_URL || "").replace(/\/$/u, "");
const confirmation = process.env.CONFIRM_LOAD_TEST;
const total = Math.min(Number(process.env.LOAD_TEST_REQUESTS || 700), 1000);

if (!target.startsWith("https://")) throw new Error("LOAD_TEST_URL必须是https网址");
if (confirmation !== "nhhs-idioms") {
  throw new Error("为防止误测，请设置CONFIRM_LOAD_TEST=nhhs-idioms");
}
if (!Number.isInteger(total) || total < 1) throw new Error("LOAD_TEST_REQUESTS必须是1至1000的整数");

const started = performance.now();
const results = await Promise.allSettled(Array.from({ length: total }, (_, index) =>
  fetch(`${target}/api/student-login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      admin_class: "101",
      student_number: `LOAD-${index}`,
      login_code: "INVALID-LOAD-TEST"
    })
  })
));
const elapsed = performance.now() - started;
const expected = results.filter((result) => result.status === "fulfilled" && result.value.status === 401).length;
const serverErrors = results.filter((result) => result.status === "fulfilled" && result.value.status >= 500).length;
const networkErrors = results.filter((result) => result.status === "rejected").length;

console.log(JSON.stringify({ requests: total, expected_401: expected, server_errors: serverErrors, network_errors: networkErrors, elapsed_ms: Math.round(elapsed) }, null, 2));
assert.equal(expected, total, "压力测试出现非预期响应，请检查Cloudflare与Supabase日志");
