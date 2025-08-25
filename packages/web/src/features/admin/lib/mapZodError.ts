import z from "zod";

export const mapZodErrors = (err: z.ZodError) => {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path?.[0] ?? "");
    out[key] = issue.message;
  }
  return out;
};
