import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { reviewEmployeePunches, planEmployeeDays, type EmployeeDayPlan } from "@/lib/biometric-review";
import { buildNameMatchIndex, suggestCandidates } from "@/lib/biometric-match";
import { formatDisplayDate } from "@/lib/period";
import { ProcessButton } from "../process-button";
import { ApplyButton } from "./apply-button";
import { LinkEmployeeForm } from "./link-employee-form";
import { IgnoreNameButton, UnignoreNameButton } from "./ignore-name-button";
import { UnlinkButton } from "./unlink-button";

function formatPunchTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

function PunchListCell({ punches }: { punches: Date[] }) {
  if (punches.length === 0) return <span className="text-muted-foreground">—</span>;
  return <span>{punches.map((p) => formatPunchTime(p)).join(", ")}</span>;
}

function BackLink() {
  return (
    <Link href="/admin/biometrics">
      <Button type="button" variant="outline" size="sm">
        <ArrowLeft />
        Back to Biometrics
      </Button>
    </Link>
  );
}

export default async function BiometricReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const upload = await prisma.biometricUpload.findUnique({
    where: { id },
    include: { uploadedBy: { select: { username: true } } },
  });
  if (!upload) notFound();

  if (upload.status === "UPLOADED") {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{upload.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This file hasn&apos;t been processed yet — process it to read the punches and match them to employees.
            </p>
            <ProcessButton id={id} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const punchRecords = await prisma.punchRecord.findMany({
    where: { biometricUploadId: id, isDuplicate: false },
    orderBy: { timestamp: "asc" },
    include: { employee: { include: { daySchedules: true } } },
  });

  const ignoredNames = await prisma.ignoredBiometricName.findMany({ select: { rawName: true } });
  const ignoredNameSet = new Set(ignoredNames.map((n) => n.rawName));

  const unmatched = punchRecords.filter((p) => !p.employeeId && !ignoredNameSet.has(p.rawName));
  const unmatchedGroups = new Map<string, { rawDept: string | null; rawName: string; count: number }>();
  for (const p of unmatched) {
    const g = unmatchedGroups.get(p.rawName);
    if (g) g.count++;
    else unmatchedGroups.set(p.rawName, { rawDept: p.rawDept, rawName: p.rawName, count: 1 });
  }

  // Only the ignored names actually relevant to THIS upload's punches — the
  // ignore list itself is global (see IgnoredBiometricName), but showing
  // every name ever ignored on every upload's page would be noise.
  const ignoredInThisUpload = new Map<string, { rawDept: string | null; rawName: string; count: number }>();
  for (const p of punchRecords) {
    if (p.employeeId || !ignoredNameSet.has(p.rawName)) continue;
    const g = ignoredInThisUpload.get(p.rawName);
    if (g) g.count++;
    else ignoredInThisUpload.set(p.rawName, { rawDept: p.rawDept, rawName: p.rawName, count: 1 });
  }

  // Hand-made links only (see linkPunchesToEmployee) — a name the automatic
  // matcher resolved on its own never shows up here, so this stays a short,
  // reviewable list of exactly the judgment calls an admin made themselves
  // and might want to undo.
  const linkedGroups = new Map<string, { rawDept: string | null; rawName: string; count: number; employeeName: string }>();
  for (const p of punchRecords) {
    if (!p.linkedManually || !p.employee) continue;
    const g = linkedGroups.get(p.rawName);
    if (g) g.count++;
    else linkedGroups.set(p.rawName, { rawDept: p.rawDept, rawName: p.rawName, count: 1, employeeName: p.employee.name });
  }

  const activeEmployees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, officeAssignment: true, employeeNo: true },
    orderBy: { name: "asc" },
  });
  const employeeOptions = activeEmployees;
  // Loosely (same-or-near last name, no given-name check — see
  // suggestCandidates) points out which unmatched names are even worth an
  // admin's time to review vs. ones nobody in the roster resembles at all.
  const suggestionIndex = buildNameMatchIndex(employeeOptions);
  const suggestionsByName = new Map(
    [...unmatchedGroups.keys()].map((rawName) => [rawName, suggestCandidates(rawName, suggestionIndex)]),
  );

  const matchedByEmployee = new Map<string, { employee: (typeof punchRecords)[number]["employee"]; punches: Date[] }>();
  for (const p of punchRecords) {
    if (!p.employeeId || !p.employee) continue;
    const g = matchedByEmployee.get(p.employeeId);
    if (g) g.punches.push(p.timestamp);
    else matchedByEmployee.set(p.employeeId, { employee: p.employee, punches: [p.timestamp] });
  }
  // The number that actually answers "who's missing from this file" — as
  // opposed to unmatchedGroups, which counts scanned names in the log that
  // never resolved to anyone (mostly people from other offices, not your
  // roster) and has no arithmetic relationship to your headcount at all.
  const employeesWithNoPunches = activeEmployees.filter((e) => !matchedByEmployee.has(e.id));

  const [existingDays, existingRequests] = await Promise.all([
    prisma.attendanceDay.findMany({
      where: { employeeId: { in: [...matchedByEmployee.keys()] } },
      select: { employeeId: true, date: true },
    }),
    prisma.dtrEntryRequest.findMany({
      where: { employeeId: { in: [...matchedByEmployee.keys()] } },
      select: { employeeId: true, date: true },
    }),
  ]);
  const blockedByEmployee = new Map<string, Set<string>>();
  for (const d of [...existingDays, ...existingRequests]) {
    const iso = d.date.toISOString().slice(0, 10);
    const set = blockedByEmployee.get(d.employeeId);
    if (set) set.add(iso);
    else blockedByEmployee.set(d.employeeId, new Set([iso]));
  }

  type EmployeeRow = { employeeId: string; name: string; employeeNo: string; plans: EmployeeDayPlan[] };
  const employeeRows: EmployeeRow[] = [];
  let applyReady = 0;
  let flaggedTotal = 0;
  for (const [employeeId, { employee, punches }] of matchedByEmployee) {
    if (!employee) continue;
    const days = reviewEmployeePunches(employee, punches);
    const plans = planEmployeeDays(days, blockedByEmployee.get(employeeId) ?? new Set());
    applyReady += plans.filter((p) => p.planAction === "apply").length;
    flaggedTotal += plans.filter((p) => p.planAction === "flag").length;
    employeeRows.push({ employeeId, name: employee.name, employeeNo: employee.employeeNo, plans });
  }
  employeeRows.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <BackLink />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">{upload.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {upload.filename} &middot; uploaded by {upload.uploadedBy.username}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={upload.status === "REVIEWED" ? "default" : "secondary"}>{upload.status}</Badge>
            <ProcessButton id={id} label="Re-process" variant="outline" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              <strong>{matchedByEmployee.size}</strong> employees matched
            </span>
            <span>
              <strong>{applyReady}</strong> day(s) ready to send
            </span>
            <span>
              <strong>{flaggedTotal}</strong> day(s) flagged for review
            </span>
            {employeesWithNoPunches.length > 0 && (
              <span className="text-amber-600">
                <strong>{employeesWithNoPunches.length}</strong> of your employees have no punch in this file
              </span>
            )}
            {unmatchedGroups.size > 0 && (
              <span className="text-muted-foreground">
                <strong>{unmatchedGroups.size}</strong> scanned name(s) in the log unmatched to an employee
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Sending pre-fills each ready day&apos;s time in/out on the employee&apos;s own <strong>My DTR</strong> page —
            still fully editable, not yet submitted anywhere. The employee checks it, fills in whatever&apos;s flagged
            below by hand, and clicks Submit themselves — that&apos;s what actually sends it to an admin to approve.
            Re-process if the matching rules change or the roster gets updated — it only re-reads this same PDF and
            re-links names, it never touches anything already sent or submitted.
          </p>
          <ApplyButton uploadId={id} disabled={applyReady === 0} />
        </CardContent>
      </Card>

      {(() => {
        const withSuggestions = [...unmatchedGroups.values()].filter((g) => (suggestionsByName.get(g.rawName)?.length ?? 0) > 0);
        const withoutSuggestions = [...unmatchedGroups.values()].filter((g) => (suggestionsByName.get(g.rawName)?.length ?? 0) === 0);
        const ignoredList = [...ignoredInThisUpload.values()];
        const linkedList = [...linkedGroups.values()];

        const tabs = [
          { value: "nopunches", label: "No punches", count: employeesWithNoPunches.length },
          { value: "flagged", label: "Flagged days", count: flaggedTotal },
          { value: "possible", label: "Possible matches", count: withSuggestions.length },
          { value: "none", label: "No similar name", count: withoutSuggestions.length },
          { value: "linked", label: "Linked by you", count: linkedList.length },
          { value: "ignored", label: "Ignored", count: ignoredList.length },
        ].filter((t) => t.count > 0);

        if (tabs.length === 0) return null;

        return (
          <Tabs defaultValue={tabs[0].value}>
            <TabsList>
              {tabs.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label} ({t.count})
                </TabsTrigger>
              ))}
            </TabsList>

            {employeesWithNoPunches.length > 0 && (
              <TabsContent value="nopunches" className="pt-2">
                <Card>
                  <CardHeader>
                    <p className="text-sm text-muted-foreground">
                      These employees have zero punches in this specific file — could mean they were on leave the whole
                      period, aren&apos;t enrolled on the biometric device yet, are assigned to a different office that
                      uses its own machine, or genuinely need a follow-up with HR.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[28rem] overflow-y-auto overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee No.</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Office</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {employeesWithNoPunches.map((e) => (
                            <TableRow key={e.id}>
                              <TableCell>{e.employeeNo}</TableCell>
                              <TableCell className="font-medium">{e.name}</TableCell>
                              <TableCell className="text-muted-foreground">{e.officeAssignment}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {flaggedTotal > 0 && (
              <TabsContent value="flagged" className="pt-2">
                <Card>
                  <CardHeader>
                    <p className="text-sm text-muted-foreground">
                      These days had a punch count that couldn&apos;t be resolved without guessing — nothing was pre-filled
                      for them. The employee (or an admin, on the DTR grid) fills these in by hand using the raw punch
                      time(s) shown.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[28rem] overflow-y-auto overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>AM punches</TableHead>
                            <TableHead>PM punches</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {employeeRows.flatMap((row) =>
                            row.plans
                              .filter((p) => p.planAction === "flag")
                              .map((p) => {
                                const c = p.classification;
                                if (c.kind !== "flagged") return null;
                                return (
                                  <TableRow key={`${row.employeeId}_${p.iso}`}>
                                    <TableCell className="font-medium">
                                      {row.name} <span className="text-muted-foreground">({row.employeeNo})</span>
                                    </TableCell>
                                    <TableCell>{formatDisplayDate(p.iso)}</TableCell>
                                    <TableCell>
                                      <Badge variant={c.reason === "too_many" ? "destructive" : "secondary"}>
                                        {c.reason === "too_many" ? "Duplicate punches" : "Missing punch(es)"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <PunchListCell punches={c.am} />
                                    </TableCell>
                                    <TableCell>
                                      <PunchListCell punches={c.pm} />
                                    </TableCell>
                                  </TableRow>
                                );
                              }),
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {withSuggestions.length > 0 && (
              <TabsContent value="possible" className="pt-2">
                <Card>
                  <CardHeader>
                    <p className="text-sm text-muted-foreground">
                      Someone in the roster shares this last name (or a near-spelling of it), but the given name
                      didn&apos;t line up closely enough to link automatically. Confirm the right one, or leave it if
                      it&apos;s a different person entirely.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[28rem] overflow-y-auto overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name (as scanned)</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Punches</TableHead>
                            <TableHead>Possible match</TableHead>
                            <TableHead>Link to</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {withSuggestions.map((g) => {
                            const suggestions = suggestionsByName.get(g.rawName) ?? [];
                            return (
                              <TableRow key={g.rawName}>
                                <TableCell className="font-medium">{g.rawName}</TableCell>
                                <TableCell className="text-muted-foreground">{g.rawDept ?? "—"}</TableCell>
                                <TableCell>{g.count}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {suggestions.map((s) => s.name).join(", ")}
                                </TableCell>
                                <TableCell>
                                  <LinkEmployeeForm
                                    uploadId={id}
                                    rawName={g.rawName}
                                    employees={employeeOptions}
                                    defaultEmployeeId={suggestions.length === 1 ? suggestions[0].id : undefined}
                                  />
                                </TableCell>
                                <TableCell>
                                  <IgnoreNameButton rawName={g.rawName} />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {withoutSuggestions.length > 0 && (
              <TabsContent value="none" className="pt-2">
                <Card>
                  <CardHeader>
                    <p className="text-sm text-muted-foreground">
                      Nobody in your active roster has even a similar last name to these — almost certainly people from
                      another office scanned by the same shared device. Still linkable by hand if one actually is your
                      employee, otherwise mark it &quot;Not an employee&quot; so it stops showing up here.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[28rem] overflow-y-auto overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name (as scanned)</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Punches</TableHead>
                            <TableHead>Link to</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {withoutSuggestions.map((g) => (
                            <TableRow key={g.rawName}>
                              <TableCell className="font-medium text-muted-foreground">{g.rawName}</TableCell>
                              <TableCell className="text-muted-foreground">{g.rawDept ?? "—"}</TableCell>
                              <TableCell>{g.count}</TableCell>
                              <TableCell>
                                <LinkEmployeeForm uploadId={id} rawName={g.rawName} employees={employeeOptions} />
                              </TableCell>
                              <TableCell>
                                <IgnoreNameButton rawName={g.rawName} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {linkedList.length > 0 && (
              <TabsContent value="linked" className="pt-2">
                <Card>
                  <CardHeader>
                    <p className="text-sm text-muted-foreground">
                      Names you linked by hand on this upload — a quick place to double-check them and undo one if it
                      turns out to be the wrong person. This never includes anything the automatic name matching
                      resolved on its own.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[28rem] overflow-y-auto overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name (as scanned)</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Punches</TableHead>
                            <TableHead>Linked to</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {linkedList.map((g) => (
                            <TableRow key={g.rawName}>
                              <TableCell className="font-medium">{g.rawName}</TableCell>
                              <TableCell className="text-muted-foreground">{g.rawDept ?? "—"}</TableCell>
                              <TableCell>{g.count}</TableCell>
                              <TableCell>{g.employeeName}</TableCell>
                              <TableCell>
                                <UnlinkButton uploadId={id} rawName={g.rawName} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {ignoredList.length > 0 && (
              <TabsContent value="ignored" className="pt-2">
                <Card>
                  <CardHeader>
                    <p className="text-sm text-muted-foreground">
                      Marked as outside your roster — hidden from unmatched review on every upload, not just this one.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[28rem] overflow-y-auto overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name (as scanned)</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Punches</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ignoredList.map((g) => (
                            <TableRow key={g.rawName}>
                              <TableCell className="font-medium">{g.rawName}</TableCell>
                              <TableCell className="text-muted-foreground">{g.rawDept ?? "—"}</TableCell>
                              <TableCell>{g.count}</TableCell>
                              <TableCell>
                                <UnignoreNameButton rawName={g.rawName} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        );
      })()}
    </div>
  );
}
