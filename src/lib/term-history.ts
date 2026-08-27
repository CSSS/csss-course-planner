import { buildTermHistory } from "./terms.ts";
import type { CourseOutlineSource } from "./sfu-client.ts";
import type { AcademicTerm } from "../types/sfu-api.ts";

export async function discoverTermHistory(
  source: Pick<CourseOutlineSource, "getYears" | "getTerms">,
  startTerm: AcademicTerm,
): Promise<AcademicTerm[]> {
  const availableYears = await source.getYears();
  const years = availableYears
    .map((entry) => Number(entry.value))
    .filter((year) => Number.isInteger(year) && year <= startTerm.year);

  const termsByYear = new Map(
    await Promise.all(
      years.map(async (year) => {
        const terms = await source.getTerms(year);
        return [year, terms] as const;
      }),
    ),
  );

  return buildTermHistory(availableYears, termsByYear, startTerm);
}
