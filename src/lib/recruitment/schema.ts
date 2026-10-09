import { z } from "zod";

export const RecruitmentFieldSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
    type: z.enum([
      "short_text",
      "long_text",
      "number",
      "select",
      "multi_select",
      "boolean",
      "date",
      "info",
    ]),
    label_sk: z.string().min(1).max(120),
    label_cs: z.string().min(1).max(120),
    required: z.boolean().default(false),
    options: z.array(z.string().min(1).max(120)).max(40).optional(),
    content_sk: z.string().max(2000).optional(),
    content_cs: z.string().max(2000).optional(),
  })
  .superRefine((field, context) => {
    if (
      (field.type === "select" || field.type === "multi_select") &&
      (!field.options || field.options.length < 1)
    )
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Choice fields need at least one option",
      });
    if (field.type !== "select" && field.type !== "multi_select" && field.options)
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Only choice fields may define options",
      });
  });

export const RecruitmentFieldsSchema = z
  .array(RecruitmentFieldSchema)
  .max(40)
  .refine(
    (fields) => new Set(fields.map((field) => field.id)).size === fields.length,
    "Field IDs must be unique",
  );

export type RecruitmentField = z.infer<typeof RecruitmentFieldSchema>;

export function validateRecruitmentAnswers(
  fields: RecruitmentField[],
  input: unknown,
): Record<string, string | string[] | boolean | number> | null {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input)
  )
    return null;
  const raw = input as Record<string, unknown>;
  const answerFields = fields.filter((field) => field.type !== "info");
  const allowedIds = new Set(answerFields.map((field) => field.id));
  if (Object.keys(raw).some((key) => !allowedIds.has(key))) return null;

  const answers: Record<string, string | string[] | boolean | number> = {};
  for (const field of answerFields) {
    const value = raw[field.id];
    const missing =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);
    if (missing) {
      if (field.required) return null;
      continue;
    }

    switch (field.type) {
      case "short_text":
        if (typeof value !== "string" || value.trim().length > 180) return null;
        answers[field.id] = value.trim();
        break;
      case "long_text":
        if (typeof value !== "string" || value.trim().length > 5000) return null;
        answers[field.id] = value.trim();
        break;
      case "number":
        if (
          (typeof value !== "string" && typeof value !== "number") ||
          String(value).trim() === "" ||
          !Number.isFinite(Number(value))
        )
          return null;
        answers[field.id] = Number(value);
        break;
      case "select":
        if (typeof value !== "string" || !field.options?.includes(value))
          return null;
        answers[field.id] = value;
        break;
      case "multi_select":
        if (
          !Array.isArray(value) ||
          value.some(
            (item) =>
              typeof item !== "string" || !field.options?.includes(item),
          ) ||
          new Set(value).size !== value.length
        )
          return null;
        answers[field.id] = value as string[];
        break;
      case "boolean":
        if (typeof value !== "boolean") return null;
        answers[field.id] = value;
        break;
      case "date":
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
          return null;
        {
          const date = new Date(value);
          if (
            !Number.isFinite(date.valueOf()) ||
            date.toISOString().slice(0, 10) !== value
          )
            return null;
        }
        answers[field.id] = value;
        break;
      case "info":
        return null;
    }
  }
  return answers;
}