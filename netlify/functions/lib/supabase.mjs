import { config } from "./config.mjs";

export const db = async (table, { method = "GET", query = "", body, prefer = "return=representation" } = {}) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = config();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      prefer
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("Supabase", response.status, detail);
    const error = new Error("数据库操作失败");
    error.statusCode = response.status === 409 ? 409 : 500;
    throw error;
  }
  if (response.status === 204) return [];
  const text = await response.text();
  return text ? JSON.parse(text) : [];
};

export const one = async (table, query) => {
  const rows = await db(table, { query: `${query}&limit=1` });
  return rows[0] || null;
};
