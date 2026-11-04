// Run with: npm test
// Each template below is a different way an office could reasonably lay out the
// same schedule, generated as a REAL file of that format and read end to end.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { zipSync, strToU8 } from "fflate";
import { jsPDF } from "jspdf";
import { extractGrids, buildTemplateWorkbook, UnreadableFileError } from "@/lib/schedule-import/extract";
import { detectSchedule } from "@/lib/schedule-import/detect";
import { parseShiftText, type Shift } from "@/lib/schedule-import/shift-text";
import { classifyDayPunches } from "@/lib/biometric-match";
import { BLANK_TOKEN, type Grid, type ScheduleDocument } from "@/lib/schedule-import/types";

const OFFICE = "CITY HEALTH OFFICE";
const roster = [
  { id: "juan", name: "Dela Cruz, Juan A.", officeAssignment: OFFICE },
  { id: "maria", name: "Santos, Maria Clara B.", officeAssignment: OFFICE },
  { id: "pedro", name: "Reyes, Pedro Jr. C.", officeAssignment: OFFICE },
  { id: "ana", name: "Garcia, Ana D.", officeAssignment: OFFICE },
  { id: "other", name: "Reyes, Lourdes M.", officeAssignment: "ENGINEERING" },
];
const officeRoster = roster.filter((e) => e.officeAssignment === OFFICE);

function detect(grids: Grid[], remembered = new Map<string, Shift>(), year = 2026, month = 11) {
  return detectSchedule({ grids, year, month, officeEmployees: officeRoster, allEmployees: roster, remembered });
}

function mustRead(grids: Grid[], remembered?: Map<string, Shift>): ScheduleDocument {
  const result = detect(grids, remembered);
  assert.ok(result.ok, result.ok ? "" : result.reason);
  return result.document;
}

function shiftOn(doc: ScheduleDocument, employeeId: string, iso: string): Shift | null | undefined {
  const row = doc.rows.find((r) => r.employeeId === employeeId);
  assert.ok(row, `no row for ${employeeId}; rows: ${doc.rows.map((r) => r.rawName).join(", ")}`);
  const token = row.cells[iso];
  return token === undefined ? undefined : doc.tokens[token].shift;
}

const hours = (a: number, b: number, c?: number, d?: number): Shift =>
  c === undefined
    ? a < 720
      ? { kind: "hours", session1: { start: a, end: b }, session2: null }
      : { kind: "hours", session1: null, session2: { start: a, end: b } }
    : { kind: "hours", session1: { start: a, end: b }, session2: { start: c, end: d! } };

const EIGHT_TO_FIVE = hours(480, 720, 780, 1020);
const OFF: Shift = { kind: "off" };

async function gridsFromAoa(rows: unknown[][], ext = "xlsx", merges?: XLSX.Range[]): Promise<Grid[]> {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  if (merges) sheet["!merges"] = merges;
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
  const type = ext === "xls" ? "biff8" : ext === "ods" ? "ods" : "xlsx";
  return extractGrids(`s.${ext}`, XLSX.write(book, { type: "buffer", bookType: type }));
}

// ── Reading a single cell ────────────────────────────────────────

test("reads the ways people actually write hours", () => {
  const cases: [string, Shift][] = [
    ["8-5", EIGHT_TO_FIVE],
    ["8:00-5:00", EIGHT_TO_FIVE],
    ["8AM-5PM", EIGHT_TO_FIVE],
    ["8:00 a.m. to 5:00 p.m.", EIGHT_TO_FIVE],
    ["0800-1700", EIGHT_TO_FIVE],
    ["08:00-17:00", EIGHT_TO_FIVE],
    ["8–5", EIGHT_TO_FIVE],
    ["8-12, 1-5", EIGHT_TO_FIVE],
    ["8:00-12:00 / 1:00-5:00", EIGHT_TO_FIVE],
    ["8:00 AM - 12:00 NN / 1:00 PM - 5:00 PM", EIGHT_TO_FIVE],
    ["8:00 / 12:00 / 1:00 / 5:00", EIGHT_TO_FIVE],
    ["8:00 / 5:00", EIGHT_TO_FIVE],
    ["Regular", EIGHT_TO_FIVE],
    ["7-3", hours(420, 900)],
    ["10PM-6AM", hours(1320, 360)],
    ["10-6am", hours(1320, 360)],
    ["22:00-06:00", hours(1320, 360)],
    ["2-10", hours(840, 1320)],
    ["AM Shift (6AM-2PM)", hours(360, 840)],
    ["12MN-8AM", hours(0, 480)],
    ["7AM-7PM", hours(420, 1140)],
    ["OFF", OFF],
    ["Rest Day", OFF],
    ["D/O", OFF],
  ];
  for (const [text, expected] of cases) {
    assert.deepEqual(parseShiftText(text).shift, expected, text);
  }
});

test("a genuinely ambiguous range is never guessed", () => {
  for (const text of ["10-6", "11-7", "7-7", "12-8", "6-10"]) {
    const reading = parseShiftText(text);
    assert.equal(reading.shift, null, text);
    assert.ok(reading.alternatives.length >= 2, text);
  }
});

test("things that aren't hours aren't read as hours", () => {
  for (const text of ["Nurse 2", "Admin Aide IV", "11/3/2026", "2026-11-03", "L", "SG-4", "VL"]) {
    assert.equal(parseShiftText(text).shift, null, text);
    assert.equal(parseShiftText(text).alternatives.length, 0, text);
  }
});

// ── Templates ────────────────────────────────────────────────────

test("template: names down the side, day numbers across, split-hour text", async () => {
  const grids = await gridsFromAoa([
    ["CITY HEALTH OFFICE"],
    ["Schedule for November 2026"],
    [],
    ["No.", "Name", "Position", ...Array.from({ length: 30 }, (_, i) => i + 1)],
    [1, "DELA CRUZ, JUAN A.", "Nurse 2", "OFF", "8-5", "8-5"],
    [2, "Maria Clara Santos", "Midwife", "OFF", "7-3", "7-3"],
    [],
    ["", "Prepared by:", "HEAD OF OFFICE"],
  ]);
  const doc = mustRead(grids);
  assert.equal(doc.layout, "matrix");
  assert.equal(doc.rows.length, 2);
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-02"), EIGHT_TO_FIVE);
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-01"), OFF);
  assert.deepEqual(shiftOn(doc, "maria", "2026-11-03"), hours(420, 900));
});

test("template: shift codes explained by a legend in the file", async () => {
  const grids = await gridsFromAoa([
    ["Nov 2026 Duty"],
    ["Name", 1, 2, 3, 4, 5, 6, 7],
    ["Garcia, Ana D.", "N", "N", "OFF", "A", "A", "A", "OFF"],
    ["Reyes, Pedro C.", "A", "A", "A", "OFF", "N", "N", "N"],
    [],
    ["Legend:"],
    ["A = 8:00 AM - 5:00 PM"],
    ["N", "10:00 PM - 6:00 AM"],
  ]);
  const doc = mustRead(grids);
  assert.equal(doc.tokens["a"].source, "legend");
  assert.deepEqual(shiftOn(doc, "ana", "2026-11-04"), EIGHT_TO_FIVE);
  assert.deepEqual(shiftOn(doc, "ana", "2026-11-01"), hours(1320, 360));
});

test("template: a code with no legend waits for a person, then is remembered", async () => {
  const rows = [
    ["Name", 1, 2, 3, 4, 5, 6, 7],
    ["Garcia, Ana D.", "Q", "Q", "OFF", "Q", "Q", "Q", "OFF"],
    ["Dela Cruz, Juan A.", "Q", "OFF", "Q", "Q", "Q", "OFF", "Q"],
  ];
  const first = mustRead(await gridsFromAoa(rows));
  assert.equal(first.tokens["q"].shift, null);

  const later = mustRead(await gridsFromAoa(rows), new Map([["q", EIGHT_TO_FIVE]]));
  assert.equal(later.tokens["q"].source, "remembered");
  assert.deepEqual(later.tokens["q"].shift, EIGHT_TO_FIVE);
});

test("template: real Excel date headers, with cells merged across the week", async () => {
  const dates = [2, 3, 4, 5, 6].map((d) => new Date(Date.UTC(2026, 10, d)));
  const grids = await gridsFromAoa(
    [
      ["Employee", ...dates],
      ["Santos, Maria Clara B.", "8AM-5PM", "", "", "", ""],
    ],
    "xlsx",
    [{ s: { r: 1, c: 1 }, e: { r: 1, c: 5 } }],
  );
  const doc = mustRead(grids);
  for (const iso of ["2026-11-02", "2026-11-04", "2026-11-06"]) {
    assert.deepEqual(shiftOn(doc, "maria", iso), EIGHT_TO_FIVE, iso);
  }
  assert.equal(shiftOn(doc, "maria", "2026-11-09"), undefined, "a date not in the file keeps the usual schedule");
});

test("template: two lines per employee (AM over PM, name merged down)", async () => {
  const grids = await gridsFromAoa(
    [
      ["Name", 2, 3, 4, 5, 6],
      ["Dela Cruz, Juan A.", "8-12", "8-12", "8-12", "8-12", "OFF"],
      ["", "1-5", "1-5", "1-5", "1-5", ""],
      ["Garcia, Ana D.", "7-11", "7-11", "7-11", "7-11", "7-11"],
      ["Garcia, Ana D.", "12-4", "12-4", "12-4", "12-4", "12-4"],
    ],
  );
  const doc = mustRead(grids);
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-02"), EIGHT_TO_FIVE);
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-06"), OFF);
  assert.deepEqual(shiftOn(doc, "ana", "2026-11-03"), hours(420, 660, 720, 960));
});

test("template: hours Excel auto-converted into dates are recovered", async () => {
  const eightToFive = new Date(Date.UTC(2026, 7, 5)); // what typing 8-5 becomes
  const grids = await gridsFromAoa([
    ["Name", 2, 3, 4, 5, 6],
    ["Dela Cruz, Juan A.", eightToFive, eightToFive, "OFF", eightToFive, eightToFive],
  ]);
  const doc = mustRead(grids);
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-02"), EIGHT_TO_FIVE);
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-04"), OFF);
});

test("template: separate Last / First / M.I. columns", async () => {
  const grids = await gridsFromAoa([
    ["Last Name", "First Name", "M.I.", 2, 3, 4, 5, 6],
    ["Dela Cruz", "Juan", "A", "8-5", "8-5", "8-5", "8-5", "8-5"],
    ["Santos", "Maria Clara", "B", "8-5", "8-5", "8-5", "8-5", "OFF"],
  ]);
  const doc = mustRead(grids);
  assert.equal(doc.rows.filter((r) => r.employeeId).length, 2);
  assert.deepEqual(shiftOn(doc, "maria", "2026-11-06"), OFF);
});

test("template: flipped — dates down the side, one column per employee", async () => {
  const grids = await gridsFromAoa([
    ["Date", "Dela Cruz, Juan A.", "Santos, Maria Clara B."],
    ["11/02/2026", "8-5", "OFF"],
    ["11/03/2026", "OFF", "7-3"],
  ]);
  const doc = mustRead(grids);
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-02"), EIGHT_TO_FIVE);
  assert.deepEqual(shiftOn(doc, "maria", "2026-11-03"), hours(420, 900));
});

test("template: weekly pattern repeats across the whole month", async () => {
  const grids = await gridsFromAoa([
    ["Name", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    ["Dela Cruz, Juan A.", "8-5", "8-5", "8-5", "8-5", "8-5", "OFF", "OFF"],
    ["Garcia, Ana D.", "OFF", "OFF", "7-3", "7-3", "7-3", "7-3", "7-3"],
  ]);
  const doc = mustRead(grids);
  assert.equal(doc.layout, "weekly");
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-30"), EIGHT_TO_FIVE); // a Monday
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-07"), OFF); // a Saturday
  assert.deepEqual(shiftOn(doc, "ana", "2026-11-07"), hours(420, 900));
});

test("template: one line per employee and date, with four time columns", async () => {
  const grids = await gridsFromAoa([
    ["Employee", "Date", "AM In", "AM Out", "PM In", "PM Out"],
    ["Dela Cruz, Juan A.", "Nov 2, 2026", "8:00", "12:00", "1:00", "5:00"],
    ["", "Nov 3, 2026", "8:00", "12:00", "1:00", "5:00"],
    ["Santos, Maria Clara B.", "Nov 2, 2026", "7:00 AM", "3:00 PM", "", ""],
  ]);
  const doc = mustRead(grids);
  assert.equal(doc.layout, "list");
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-03"), EIGHT_TO_FIVE);
  assert.deepEqual(shiftOn(doc, "maria", "2026-11-02"), hours(420, 900));
});

test("template: a list using date spans and a Schedule column", async () => {
  const grids = await gridsFromAoa([
    ["Name", "Inclusive Dates", "Schedule"],
    ["Garcia, Ana D.", "Nov 2-6", "8-5"],
    ["Garcia, Ana D.", "Nov 9-13", "10PM-6AM"],
    ["Santos, Maria Clara B.", "Nov 16-20, 2026", "7-3"],
  ]);
  const doc = mustRead(grids);
  assert.deepEqual(shiftOn(doc, "ana", "2026-11-04"), EIGHT_TO_FIVE);
  assert.deepEqual(shiftOn(doc, "ana", "2026-11-10"), hours(1320, 360));
  assert.deepEqual(shiftOn(doc, "maria", "2026-11-18"), hours(420, 900));
});

test("template: summary lines of days and hours", async () => {
  const grids = await gridsFromAoa([
    ["Name", "Schedule"],
    ["Dela Cruz, Juan A.", "Mon-Fri 8:00-5:00"],
    ["Santos, Maria Clara B.", "MWF 7-3; Sat 8-12"],
    ["Garcia, Ana D.", "10PM-6AM"],
    ["Reyes, Pedro Jr. C.", "8-5, Rest Day: Sunday"],
  ]);
  const doc = mustRead(grids);
  assert.equal(doc.layout, "summary");
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-02"), EIGHT_TO_FIVE);
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-07"), OFF);
  assert.deepEqual(shiftOn(doc, "maria", "2026-11-04"), hours(420, 900)); // Wednesday
  assert.deepEqual(shiftOn(doc, "maria", "2026-11-03"), OFF); // Tuesday
  assert.deepEqual(shiftOn(doc, "maria", "2026-11-07"), hours(480, 720)); // Saturday
  assert.deepEqual(shiftOn(doc, "ana", "2026-11-07"), OFF);
  assert.ok(doc.warnings.some((w) => w.includes("Monday to Friday")), "assumed days must be called out");
});

test("template: duty roster with surnames listed under each shift", async () => {
  const grids = await gridsFromAoa([
    ["Date", "6AM-2PM", "2PM-10PM", "10PM-6AM", "OFF"],
    ["Nov 2", "Dela Cruz", "Santos", "Garcia", "Reyes"],
    ["Nov 3", "Santos", "Garcia", "Reyes", "Dela Cruz"],
  ]);
  const doc = mustRead(grids);
  assert.equal(doc.layout, "duty-roster");
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-02"), hours(360, 840));
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-03"), OFF);
  assert.deepEqual(shiftOn(doc, "ana", "2026-11-02"), hours(1320, 360));
  assert.equal(doc.rows.find((r) => r.employeeId === "ana")?.match, "loose");
});

test("template: several tables stacked by week on one sheet", async () => {
  const grids = await gridsFromAoa([
    ["Week 1"],
    ["Name", "Nov 2", "Nov 3", "Nov 4"],
    ["Dela Cruz, Juan A.", "8-5", "8-5", "OFF"],
    [],
    ["Week 2"],
    ["Name", "Nov 9", "Nov 10", "Nov 11"],
    ["Dela Cruz, Juan A.", "7-3", "7-3", "OFF"],
  ]);
  const doc = mustRead(grids);
  assert.equal(doc.rows.length, 1);
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-03"), EIGHT_TO_FIVE);
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-10"), hours(420, 900));
});

test("template: one tab per month only reads the chosen month", async () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([["Name", 1, 2, 3, 4, 5], ["Dela Cruz, Juan A.", "7-3", "7-3", "7-3", "7-3", "7-3"]]),
    "October 2026",
  );
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([["Name", 1, 2, 3, 4, 5], ["Dela Cruz, Juan A.", "8-5", "8-5", "8-5", "8-5", "8-5"]]),
    "November 2026",
  );
  const grids = await extractGrids("s.xlsx", XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
  const doc = mustRead(grids);
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-03"), EIGHT_TO_FIVE);
  assert.deepEqual(doc.sheets, ["November 2026"]);
});

// ── Formats ──────────────────────────────────────────────────────

const SIMPLE_ROWS = [
  ["Name", 2, 3, 4, 5, 6],
  ["Dela Cruz, Juan A.", "8-5", "8-5", "OFF", "8-5", "8-5"],
  ["Santos, Maria Clara B.", "OFF", "7-3", "7-3", "7-3", "7-3"],
];

function assertSimple(doc: ScheduleDocument) {
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-02"), EIGHT_TO_FIVE);
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-04"), OFF);
  assert.deepEqual(shiftOn(doc, "maria", "2026-11-03"), hours(420, 900));
}

test("format: legacy .xls and .ods", async () => {
  assertSimple(mustRead(await gridsFromAoa(SIMPLE_ROWS, "xls")));
  assertSimple(mustRead(await gridsFromAoa(SIMPLE_ROWS, "ods")));
});

test("format: .csv", async () => {
  const csv = SIMPLE_ROWS.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  assertSimple(mustRead(await extractGrids("s.csv", Buffer.from(csv))));
});

test("format: Word table, including spanned and merged cells", async () => {
  const cell = (text: string, extra = "") => `<w:tc><w:tcPr>${extra}</w:tcPr><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
  const row = (cells: string[]) => `<w:tr>${cells.join("")}</w:tr>`;
  const xml = `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>
    <w:p><w:r><w:t>Duty Schedule - November 2026</w:t></w:r></w:p>
    <w:tbl>
      ${row(["Name", "2", "3", "4", "5", "6"].map((t) => cell(t)))}
      ${row([cell("Dela Cruz, Juan A."), cell("8-5", '<w:gridSpan w:val="2"/>'), cell("OFF"), cell("8-5", '<w:gridSpan w:val="2"/>')])}
      ${row(["Santos, Maria Clara B.", "OFF", "7-3", "7-3", "7-3", "7-3"].map((t) => cell(t)))}
    </w:tbl>
    <w:p><w:r><w:t>N = 10PM-6AM</w:t></w:r></w:p>
  </w:body></w:document>`;
  const docx = Buffer.from(zipSync({ "word/document.xml": strToU8(xml) }));
  assertSimple(mustRead(await extractGrids("s.docx", docx)));
});

test("format: text-based PDF, read by position on the page", async () => {
  const pdf = new jsPDF({ orientation: "landscape" });
  pdf.setFontSize(10);
  pdf.text("Duty Schedule - November 2026", 10, 10);
  SIMPLE_ROWS.forEach((row, r) => {
    row.forEach((value, c) => {
      pdf.text(String(value), c === 0 ? 10 : 70 + (c - 1) * 18, 25 + r * 8);
    });
  });
  assertSimple(mustRead(await extractGrids("s.pdf", Buffer.from(pdf.output("arraybuffer")))));
});

test("format: a PDF with no text says it's a scan", async () => {
  const pdf = new jsPDF();
  pdf.rect(10, 10, 50, 50);
  await assert.rejects(extractGrids("s.pdf", Buffer.from(pdf.output("arraybuffer"))), (e: Error) => {
    assert.ok(e instanceof UnreadableFileError);
    assert.match(e.message, /scanned/);
    return true;
  });
});

test("format: photos and old .doc get a clear message, not a crash", async () => {
  await assert.rejects(extractGrids("s.jpg", Buffer.from("x")), UnreadableFileError);
  await assert.rejects(extractGrids("s.doc", Buffer.from("x")), UnreadableFileError);
});

test("the downloadable template reads back correctly once filled in", async () => {
  const blank = buildTemplateWorkbook(OFFICE, 2026, 11, officeRoster.map((e) => e.name));
  const book = XLSX.read(blank);
  const sheet = book.Sheets[book.SheetNames[0]];
  const juanRow = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 }).findIndex((r) => r[0] === "Dela Cruz, Juan A.");
  sheet[XLSX.utils.encode_cell({ r: juanRow, c: 2 })] = { t: "s", v: "A" };
  sheet[XLSX.utils.encode_cell({ r: juanRow, c: 3 })] = { t: "s", v: "N" };
  const doc = mustRead(await extractGrids("t.xlsx", XLSX.write(book, { type: "buffer", bookType: "xlsx" })));
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-02"), EIGHT_TO_FIVE);
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-03"), hours(1320, 360));
  assert.ok(!doc.warnings.some((w) => w.includes("weekday labels")), doc.warnings.join("; "));
});

// ── Safety ───────────────────────────────────────────────────────

test("an overnight shift's punches are never prefilled backwards", () => {
  // 06:00 ends last night's shift and 22:00 starts tonight's: two punches, the
  // expected count, but "first is the arrival" would swap them.
  const punches = [new Date(Date.UTC(2026, 10, 3, 6, 0)), new Date(Date.UTC(2026, 10, 3, 22, 0))];
  const overnight = classifyDayPunches(punches, { session1: null, session2: { start: 1320, end: 360 } });
  assert.equal(overnight.kind, "flagged");
  const daytime = classifyDayPunches(
    [new Date(Date.UTC(2026, 10, 3, 7, 0)), new Date(Date.UTC(2026, 10, 3, 15, 0))],
    { session1: { start: 420, end: 900 }, session2: null },
  );
  assert.equal(daytime.kind, "confident");
});

test("an unrecognised person is held for review, never dropped or guessed", async () => {
  const doc = mustRead(
    await gridsFromAoa([
      ["Name", 2, 3, 4, 5, 6],
      ["Dela Cruz, Juan A.", "8-5", "8-5", "8-5", "8-5", "8-5"],
      ["Zamora, Totally N.", "8-5", "8-5", "8-5", "8-5", "8-5"],
    ]),
  );
  const unknown = doc.rows.find((r) => r.rawName.startsWith("Zamora"));
  assert.equal(unknown?.employeeId, null);
  assert.equal(unknown?.match, "none");
});

test("a surname shared by two office employees isn't auto-matched", async () => {
  const twoReyes = [...officeRoster, { id: "rosa", name: "Reyes, Rosa F.", officeAssignment: OFFICE }];
  const result = detectSchedule({
    grids: await gridsFromAoa([
      ["Name", 2, 3, 4, 5, 6],
      ["Reyes", "8-5", "8-5", "8-5", "8-5", "8-5"],
      ["Dela Cruz, Juan A.", "8-5", "8-5", "8-5", "8-5", "8-5"],
    ]),
    year: 2026,
    month: 11,
    officeEmployees: twoReyes,
    allEmployees: twoReyes,
    remembered: new Map(),
  });
  assert.ok(result.ok);
  const row = result.document.rows.find((r) => r.rawName === "Reyes");
  assert.equal(row?.employeeId, null);
  assert.deepEqual(row?.candidates.map((c) => c.id).sort(), ["pedro", "rosa"]);
});

test("a blank cell is visibly treated as a day off, and only on dates the file covers", async () => {
  const doc = mustRead(
    await gridsFromAoa([
      ["Name", 2, 3, 4, 5, 6],
      ["Dela Cruz, Juan A.", "8-5", "", "8-5", "8-5", "8-5"],
    ]),
  );
  const row = doc.rows[0];
  assert.equal(row.cells["2026-11-03"], BLANK_TOKEN);
  assert.equal(doc.tokens[BLANK_TOKEN].source, "default");
  assert.equal(row.cells["2026-11-09"], undefined);
});

test("the wrong month is called out", async () => {
  const doc = mustRead(
    await gridsFromAoa([
      ["Schedule for October 2026"],
      ["", "Sun", "Mon", "Tue", "Wed", "Thu"],
      ["Name", 1, 2, 3, 4, 5],
      ["Dela Cruz, Juan A.", "8-5", "8-5", "8-5", "8-5", "8-5"],
    ]),
  );
  assert.ok(doc.warnings.some((w) => w.includes("October")), doc.warnings.join("; "));
});

test("a staff list with hire dates isn't mistaken for a schedule", async () => {
  // Found on the real manpower inventory: 2025-05 read as 20:25 to 05:00.
  const result = detect(
    await gridsFromAoa([
      ["Name", "Position", "Date Hired", "Contract End"],
      ["Dela Cruz, Juan A.", "Nurse 2", "2025-05-01", "2026-12-31"],
      ["Santos, Maria Clara B.", "Midwife", "2024-03-15", "2026-12-31"],
    ]),
  );
  assert.equal(result.ok, false);

  // Also real: a birthdate that happens to fall in the chosen month looked like
  // a dated list, with the age and ID columns read as its hours.
  const birthdays = detect(
    await gridsFromAoa([
      ["Name", "No.", "Birthdate", "Age", "Date of Birth Year"],
      ["Dela Cruz, Juan A.", 23, "November 02", 27, 1998],
      ["Santos, Maria Clara B.", 182, "November 22", 42, 1983],
    ]),
  );
  assert.equal(birthdays.ok, false);
});

test("an attendance sheet of late minutes isn't mistaken for a schedule", async () => {
  // Found on the real Daily Rate Computation PDF.
  const result = detect(
    await gridsFromAoa([
      ["Name", 2, 3, 4, 5, 6],
      ["Dela Cruz, Juan A.", 0, 3, 0, 12, 0],
      ["Santos, Maria Clara B.", 5, 0, 7, 0, 4],
    ]),
  );
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.reason, /attendance, payroll/);
});

test("numeric shift codes still work when the file explains them", async () => {
  const doc = mustRead(
    await gridsFromAoa([
      ["Name", 2, 3, 4, 5, 6],
      ["Dela Cruz, Juan A.", 1, 1, 2, 2, 3],
      [],
      ["1 = 8AM-5PM"],
      ["2 = 10PM-6AM"],
      ["3 = OFF"],
    ]),
  );
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-02"), EIGHT_TO_FIVE);
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-04"), hours(1320, 360));
  assert.deepEqual(shiftOn(doc, "juan", "2026-11-06"), OFF);
});

test("a file that isn't a schedule fails with an explanation", async () => {
  const result = detect(
    await gridsFromAoa([["Item", "Qty", "Cost"], ["Bond paper", 3, 240], ["Ink", 1, 500]]),
  );
  assert.equal(result.ok, false);
});
