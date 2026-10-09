import { describe, expect, it } from "vitest";
import {
  RecruitmentFieldsSchema,
  validateRecruitmentAnswers,
} from "@/lib/recruitment/schema";

const fields = RecruitmentFieldsSchema.parse([
  {
    id: "experience",
    type: "short_text",
    label_sk: "Skúsenosti",
    label_cs: "Zkušenosti",
    required: true,
  },
  {
    id: "languages",
    type: "multi_select",
    label_sk: "Jazyky",
    label_cs: "Jazyky",
    required: true,
    options: ["Slovenčina", "Čeština"],
  },
  {
    id: "available",
    type: "boolean",
    label_sk: "Máš čas?",
    label_cs: "Máš čas?",
    required: true,
  },
  {
    id: "note",
    type: "info",
    label_sk: "Informácia",
    label_cs: "Informace",
    content_sk: "Text",
    content_cs: "Text",
  },
]);

describe("recruitment form validation", () => {
  it("accepts only declared choices and persists explicit false answers", () => {
    expect(
      validateRecruitmentAnswers(fields, {
        experience: "  Dva roky  ",
        languages: ["Slovenčina"],
        available: false,
      }),
    ).toEqual({
      experience: "Dva roky",
      languages: ["Slovenčina"],
      available: false,
    });
  });

  it("rejects missing required values, unknown keys, and invalid options", () => {
    expect(
      validateRecruitmentAnswers(fields, {
        experience: "Odpoveď",
        languages: [],
        available: true,
      }),
    ).toBeNull();
    expect(
      validateRecruitmentAnswers(fields, {
        experience: "Odpoveď",
        languages: ["Unknown"],
        available: true,
      }),
    ).toBeNull();
    expect(
      validateRecruitmentAnswers(fields, {
        experience: "Odpoveď",
        languages: ["Slovenčina"],
        available: true,
        internal_notes: "forbidden",
      }),
    ).toBeNull();
  });

  it("rejects duplicate field IDs and impossible calendar dates", () => {
    expect(
      RecruitmentFieldsSchema.safeParse([
        fields[0],
        { ...fields[0], label_sk: "Iný" },
      ]).success,
    ).toBe(false);
    expect(
      validateRecruitmentAnswers(
        [
          {
            id: "date",
            type: "date",
            label_sk: "Dátum",
            label_cs: "Datum",
            required: true,
          },
        ],
        { date: "2026-02-30" },
      ),
    ).toBeNull();
  });
});