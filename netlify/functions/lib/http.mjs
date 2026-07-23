export const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders
  },
  body: JSON.stringify(body)
});

export const parseBody = (event) => {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    throw new Error("请求格式不正确");
  }
};

export const method = (event, allowed = ["POST"]) => {
  if (!allowed.includes(event.httpMethod)) {
    const error = new Error("不支持的请求方式");
    error.statusCode = 405;
    throw error;
  }
};

export const fail = (error) => {
  console.error(error);
  const status = Number(error.statusCode) || 500;
  const message = status >= 500 ? "系统暂时无法处理，请稍后再试。" : error.message;
  return json(status, { ok: false, error: message });
};
