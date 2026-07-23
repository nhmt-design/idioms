import crypto from "node:crypto";
import { config } from "./config.mjs";

const b64url = (value) => Buffer.from(value).toString("base64url");
const sign = (value, secret) => crypto.createHmac("sha256", secret).update(value).digest("base64url");

export const hashLoginCode = (code) => {
  const { LOGIN_CODE_PEPPER } = config();
  return crypto.createHash("sha256").update(`${LOGIN_CODE_PEPPER}:${String(code).trim().toUpperCase()}`).digest("hex");
};

export const createToken = (payload, ttlSeconds = 60 * 60 * 12) => {
  const { SESSION_SECRET } = config();
  const data = b64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  return `${data}.${sign(data, SESSION_SECRET)}`;
};

export const readToken = (event, role) => {
  const { SESSION_SECRET } = config();
  const raw = event.headers.authorization || event.headers.Authorization || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : "";
  const [data, signature] = token.split(".");
  if (!data || !signature) throw Object.assign(new Error("请重新登录"), { statusCode: 401 });
  const expected = sign(data, SESSION_SECRET);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw Object.assign(new Error("登录状态无效"), { statusCode: 401 });
  }
  const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  if (payload.exp < Math.floor(Date.now() / 1000) || (role && payload.role !== role)) {
    throw Object.assign(new Error("请重新登录"), { statusCode: 401 });
  }
  return payload;
};

export const randomCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.randomBytes(8), (byte) => alphabet[byte % alphabet.length]).join("");
};
