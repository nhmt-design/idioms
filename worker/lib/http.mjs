const securityHeaders = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()"
};

export const json = (status, body, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...securityHeaders,
      ...extraHeaders
    }
  });

export const parseBody = async (request) => {
  const text = await request.text();
  if (text.length > 1_000_000) {
    throw Object.assign(new Error("上传资料过大"), { statusCode: 413 });
  }
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw Object.assign(new Error("请求格式不正确"), { statusCode: 400 });
  }
};

export const method = (request, allowed = ["POST"]) => {
  if (!allowed.includes(request.method)) {
    throw Object.assign(new Error("不支持的请求方式"), { statusCode: 405 });
  }
};

export const fail = (error) => {
  console.error(error);
  const status = Number(error.statusCode) || 500;
  const message = status >= 500 ? "系统暂时无法处理，请稍后再试。" : error.message;
  return json(status, { ok: false, error: message });
};
