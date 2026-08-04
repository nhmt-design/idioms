import { routes } from "./api.mjs";
import { fail, json } from "./lib/http.mjs";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    const handler = routes.get(url.pathname);
    if (!handler) return json(404, { ok: false, error: "接口不存在" });
    try {
      return await handler(request, env);
    } catch (error) {
      return fail(error);
    }
  }
};
