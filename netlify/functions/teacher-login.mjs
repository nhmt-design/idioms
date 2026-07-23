import crypto from "node:crypto";
import { config } from "./lib/config.mjs";
import { createToken } from "./lib/crypto.mjs";
import { fail, json, method, parseBody } from "./lib/http.mjs";

export const handler = async (event) => {
  try {
    method(event);
    const { password = "" } = parseBody(event);
    const expected = config().TEACHER_PASSWORD;
    const a = Buffer.from(String(password));
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return json(401, { ok: false, error: "教师密码不正确" });
    }
    return json(200, { ok: true, token: createToken({ role: "teacher" }, 60 * 60 * 4) });
  } catch (error) {
    return fail(error);
  }
};
