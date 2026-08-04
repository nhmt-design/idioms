import { config } from "./config.mjs";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64Url = (bytes) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
};

const fromBase64Url = (value) => {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const constantTimeEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
};

const sign = async (value, secret) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
};

export const hashLoginCode = async (env, code) => {
  const { LOGIN_CODE_PEPPER } = config(env);
  const value = `${LOGIN_CODE_PEPPER}:${String(code).trim().toUpperCase()}`;
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const createToken = async (env, payload, ttlSeconds = 60 * 60 * 12) => {
  const { SESSION_SECRET } = config(env);
  const encoded = toBase64Url(encoder.encode(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  })));
  return `${encoded}.${await sign(encoded, SESSION_SECRET)}`;
};

export const readToken = async (request, env, role) => {
  const { SESSION_SECRET } = config(env);
  const raw = request.headers.get("authorization") || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : "";
  const [data, signature] = token.split(".");
  if (!data || !signature) throw Object.assign(new Error("请重新登录"), { statusCode: 401 });
  const expected = await sign(data, SESSION_SECRET);
  if (!constantTimeEqual(signature, expected)) {
    throw Object.assign(new Error("登录状态无效"), { statusCode: 401 });
  }
  let payload;
  try {
    payload = JSON.parse(decoder.decode(fromBase64Url(data)));
  } catch {
    throw Object.assign(new Error("登录状态无效"), { statusCode: 401 });
  }
  if (payload.exp < Math.floor(Date.now() / 1000) || (role && payload.role !== role)) {
    throw Object.assign(new Error("请重新登录"), { statusCode: 401 });
  }
  return payload;
};

export const randomCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
};

export const safeEqual = (a, b) => constantTimeEqual(String(a), String(b));
