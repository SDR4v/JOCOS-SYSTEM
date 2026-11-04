// Finds who a schedule row is about. Offices don't write names the way the
// roster does ("Juan A. Dela Cruz", "DELA CRUZ, J.", or just "Dela Cruz"), so
// this widens biometric-match's name matching — but only ever auto-matches
// when exactly one person fits. Anything else goes to the review screen with
// its candidates, the same rule the biometrics review follows.
import {
  buildNameMatchIndex,
  matchEmployeeByName,
  splitName,
  suggestCandidates,
  type NameMatchIndex,
} from "@/lib/biometric-match";

export type RosterEmployee = { id: string; name: string; officeAssignment: string };

export type NameMatch = {
  employee: RosterEmployee | null;
  // Shown beside the row so a person can spot a surname-only match that needs a look.
  quality: "full" | "loose" | "none";
  candidates: RosterEmployee[];
};

const TITLE_RE = /\b(?:mr|mrs|ms|miss|dr|engr|atty|hon|nurse|sir|maam|ma'am|mdm|prof|rn|md|rm|rmt|lpt|cpa)\b\.?/gi;

export function cleanName(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, " ") // "(Driver)", "(on leave)"
    .replace(/^\s*\d+[.)]?\s+/, "") // a leading row number: "12. Dela Cruz"
    .replace(TITLE_RE, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.-]+|[\s,-]+$/g, "");
}

const NOT_A_NAME_RE =
  /^(?:sub-?\s?total|total|legend|note|notes|prepared|noted|approved|certified|checked|reviewed|recommending|signature|submitted|attested|names?|employees?|personnel|staff|position|designation|office|department|division|schedule|month|period|remarks|code|shift|date|day|for the|republic|province|city of|municipality|rest day|day off|off)\b/i;

export function looksLikeName(raw: string): boolean {
  const cleaned = cleanName(raw);
  if (cleaned.length < 2 || cleaned.length > 80) return false;
  if (NOT_A_NAME_RE.test(cleaned)) return false;
  if (/\d/.test(cleaned)) return false;
  return /\p{L}{2}/u.test(cleaned);
}

function lastNameOf(employee: RosterEmployee): string {
  return splitName(employee.name)?.lastName ?? "";
}

// "Juan A. Dela Cruz" → each way of reading its tail as the surname, in the
// roster's "Last, First" order. Up to three words covers "De La Cruz".
function reorderings(name: string): string[] {
  const tokens = name.replace(/,/g, " ").trim().split(/\s+/);
  const out: string[] = [];
  for (let k = 1; k <= 3 && k < tokens.length; k++) {
    out.push(`${tokens.slice(-k).join(" ")}, ${tokens.slice(0, -k).join(" ")}`);
  }
  return out;
}

export class NameResolver {
  private readonly officeIndex: NameMatchIndex<RosterEmployee>;
  private readonly allIndex: NameMatchIndex<RosterEmployee>;

  constructor(
    private readonly officeEmployees: RosterEmployee[],
    private readonly allEmployees: RosterEmployee[],
  ) {
    this.officeIndex = buildNameMatchIndex(officeEmployees);
    this.allIndex = buildNameMatchIndex(allEmployees);
  }

  private fullMatch(name: string, index: NameMatchIndex<RosterEmployee>): RosterEmployee | null {
    const direct = matchEmployeeByName(name, index);
    if (direct) return direct;
    if (name.includes(",")) return null;
    const found = new Map<string, RosterEmployee>();
    for (const attempt of reorderings(name)) {
      const hit = matchEmployeeByName(attempt, index);
      if (hit) found.set(hit.id, hit);
    }
    return found.size === 1 ? [...found.values()][0] : null;
  }

  // "Dela Cruz", "Dela Cruz, J.", "J. Dela Cruz" — only within the office, the
  // one place a bare surname can realistically mean a single person.
  private looseMatches(name: string): RosterEmployee[] {
    const lowered = name.toLowerCase().trim();
    const commaForm = /^(.+?),\s*(\p{L})\.?(?:\s+\p{L}\.?)*$/u.exec(lowered);
    if (commaForm) {
      return this.officeEmployees.filter((e) => {
        const split = splitName(e.name);
        return split?.lastName === commaForm[1].trim() && split.givenTokens[0]?.[0] === commaForm[2];
      });
    }
    const initialFirst = /^(\p{L})\.?\s+(.+)$/u.exec(lowered);
    if (initialFirst && initialFirst[1].length === 1) {
      const narrowed = this.officeEmployees.filter((e) => {
        const split = splitName(e.name);
        return split?.lastName === initialFirst[2].trim() && split.givenTokens[0]?.[0] === initialFirst[1];
      });
      if (narrowed.length > 0) return narrowed;
    }
    return this.officeEmployees.filter((e) => lastNameOf(e) === lowered);
  }

  resolve(raw: string): NameMatch {
    const name = cleanName(raw);
    if (!name) return { employee: null, quality: "none", candidates: [] };

    const full = this.fullMatch(name, this.officeIndex) ?? this.fullMatch(name, this.allIndex);
    if (full) return { employee: full, quality: "full", candidates: [] };

    const loose = this.looseMatches(name);
    if (loose.length === 1) return { employee: loose[0], quality: "loose", candidates: [] };

    const suggestions = new Map<string, RosterEmployee>();
    for (const e of loose) suggestions.set(e.id, e);
    for (const attempt of [name, ...reorderings(name)]) {
      for (const e of suggestCandidates(attempt, this.allIndex)) suggestions.set(e.id, e);
    }
    return { employee: null, quality: "none", candidates: [...suggestions.values()].slice(0, 8) };
  }
}
