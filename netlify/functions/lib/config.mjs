const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SESSION_SECRET", "LOGIN_CODE_PEPPER", "TEACHER_PASSWORD"];

export const config = () => {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  return Object.fromEntries(required.map((key) => [key, process.env[key]]));
};
