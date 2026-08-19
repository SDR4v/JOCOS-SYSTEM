// Shared "Application for Wellness Leave" form shell, adapted from the
// office's CS Form No. 6 layout. Used both for a specific (filled-in)
// request and for a blank form printed ahead of a request being filed.

import Image from "next/image";

type Balance = { allotted: number; used: number } | null;

export type WellnessLeaveApplicationFormProps = {
  employeeName: string;
  officeAssignment: string;
  positionTitle: string;
  salaryLabel: string;
  dateOfFilingLabel: string;
  semester: 1 | 2 | null;
  daysLabel: string;
  datesLabel: string;
  notesLabel: string;
  sem1Balance: Balance;
  sem2Balance: Balance;
  lessSem1Label: string;
  lessSem2Label: string;
  filedByLabel: string;
  displayStatus: "UPCOMING" | "TAKEN" | "CANCELLED" | null;
  pulledOutByLabel?: string | null;
  pulledOutAtLabel?: string | null;
  confirmedTakenByLabel?: string | null;
  confirmedTakenAtLabel?: string | null;
};

export function WellnessLeaveApplicationForm({
  employeeName,
  officeAssignment,
  positionTitle,
  salaryLabel,
  dateOfFilingLabel,
  semester,
  daysLabel,
  datesLabel,
  notesLabel,
  sem1Balance,
  sem2Balance,
  lessSem1Label,
  lessSem2Label,
  filedByLabel,
  displayStatus,
  pulledOutByLabel,
  pulledOutAtLabel,
  confirmedTakenByLabel,
  confirmedTakenAtLabel,
}: WellnessLeaveApplicationFormProps) {
  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-[13px] text-black print:m-0 print:max-w-none print:p-0">
      <p className="text-xs font-medium text-primary italic">
        Adapted from CS Form No. 6
        <br />
        (Revised 2020)
      </p>

      <div className="mb-1 flex items-center justify-center gap-3">
        <Image src="/batac-seal.jpg" alt="" width={56} height={56} className="shrink-0" />
        <div className="text-center">
          <p className="italic">Republic of the Philippines</p>
          <p className="font-bold italic">CITY GOVERNMENT OF BATAC</p>
          <p className="text-xs italic">Brgy. 1-S Valdez, City of Batac, Ilocos Norte</p>
        </div>
      </div>
      <h1 className="mb-4 text-center text-lg font-bold tracking-wide">APPLICATION FOR WELLNESS LEAVE</h1>

      <div className="border border-black">
        {/* 1-2: Office / Name */}
        <div className="flex border-b border-black">
          <Cell className="w-1/2 border-r border-black" label="1. OFFICE/DEPARTMENT" value={officeAssignment} />
          <Cell className="w-1/2" label="2. NAME (Last, First, Middle)" value={employeeName} />
        </div>

        {/* 3-5: Date filed / Position / Salary */}
        <div className="flex border-b border-black">
          <Cell className="w-1/3 border-r border-black" label="3. DATE OF FILING" value={dateOfFilingLabel} />
          <Cell className="w-1/3 border-r border-black" label="4. POSITION" value={positionTitle} />
          <Cell className="w-1/3" label="5. SALARY" value={salaryLabel} />
        </div>

        {/* Section 6 header */}
        <div className="border-b border-black bg-primary/10 py-1 text-center font-bold text-primary">6. DETAILS OF APPLICATION</div>

        {/* 6.A / 6.B */}
        <div className="flex border-b border-black">
          <div className="w-1/2 border-r border-black p-2">
            <p className="mb-2 font-bold">6.A TYPE OF LEAVE TO BE AVAILED OF</p>
            <p>☑ Wellness Leave</p>
            <p className="mt-1 text-xs text-gray-600">
              COS benefit: 5 days/year (3 for 1st Sem, 2 for 2nd Sem), not a Civil Service leave type.
            </p>
          </div>
          <div className="w-1/2 p-2">
            <p className="mb-2 font-bold">6.B DETAILS OF LEAVE</p>
            <p>{semester === 1 ? "☑" : "☐"} 1st Semester (Jan–Jun)</p>
            <p>{semester === 2 ? "☑" : "☐"} 2nd Semester (Jul–Dec)</p>
            <p className="mt-2">Reason/Notes: {notesLabel}</p>
          </div>
        </div>

        {/* 6.C / 6.D */}
        <div className="flex border-b border-black">
          <div className="w-1/2 border-r border-black p-2">
            <p className="mb-2 font-bold">6.C NUMBER OF WORKING DAYS APPLIED FOR</p>
            <p className="mb-2">{daysLabel}</p>
            <p className="font-bold">INCLUSIVE DATES</p>
            <p>{datesLabel}</p>
          </div>
          <div className="flex w-1/2 flex-col justify-end p-2">
            <div className="mb-1 h-10 border-b border-black" />
            <p className="text-center text-xs">(Signature of Applicant)</p>
          </div>
        </div>

        {/* Section 7 header */}
        <div className="border-b border-black bg-primary/10 py-1 text-center font-bold text-primary">
          7. WELLNESS LEAVE CREDITS &amp; STATUS
        </div>

        {/* 7.A / 7.B */}
        <div className="flex">
          <div className="w-1/2 border-r border-black p-2">
            <p className="mb-1 font-bold">7.A CERTIFICATION OF WELLNESS LEAVE CREDITS</p>
            <p className="mb-2 text-xs">As of {new Date().toLocaleDateString()}</p>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <td className="border border-black p-1"></td>
                  <td className="border border-black p-1 text-center font-bold">1st Sem</td>
                  <td className="border border-black p-1 text-center font-bold">2nd Sem</td>
                </tr>
              </thead>
              <tbody>
                <BalanceRow label="Total Allotted" sem1={sem1Balance} sem2={sem2Balance} field="allotted" />
                <tr>
                  <td className="border border-black p-1 italic">Less this application</td>
                  <td className="border border-black p-1 text-center">{lessSem1Label}</td>
                  <td className="border border-black p-1 text-center">{lessSem2Label}</td>
                </tr>
                <BalanceRow label="Balance" sem1={sem1Balance} sem2={sem2Balance} field="remaining" />
              </tbody>
            </table>
            <div className="mt-6 mb-1 h-8 border-b border-black" />
            <p className="text-center text-xs">
              {filedByLabel}
              <br />
              (Filed by)
            </p>
          </div>
          <div className="w-1/2 p-2">
            <p className="mb-2 font-bold">7.B STATUS</p>
            <p>{displayStatus === "UPCOMING" ? "☑" : "☐"} Upcoming — not yet taken</p>
            <p>{displayStatus === "TAKEN" ? "☑" : "☐"} Taken — leave period has passed or was confirmed received</p>
            <p>{displayStatus === "CANCELLED" ? "☑" : "☐"} Pulled out by the employee before it was taken</p>
            {displayStatus === "CANCELLED" && pulledOutByLabel && (
              <p className="mt-2 text-xs">
                Pulled out by {pulledOutByLabel}
                {pulledOutAtLabel ? ` on ${pulledOutAtLabel}` : ""}
              </p>
            )}
            {displayStatus === "TAKEN" && confirmedTakenByLabel && (
              <p className="mt-2 text-xs">
                Physical copy confirmed received by {confirmedTakenByLabel}
                {confirmedTakenAtLabel ? ` on ${confirmedTakenAtLabel}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="mt-4 text-right text-xs text-gray-500">Printed {new Date().toLocaleString()}</p>
    </div>
  );
}

function Cell({ className, label, value }: { className?: string; label: string; value: string }) {
  return (
    <div className={`p-2 ${className ?? ""}`}>
      <p className="text-xs font-bold">{label}</p>
      <p>{value}</p>
    </div>
  );
}

function BalanceRow({
  label,
  sem1,
  sem2,
  field,
}: {
  label: string;
  sem1: Balance;
  sem2: Balance;
  field: "allotted" | "remaining";
}) {
  const value = (b: Balance) => {
    if (!b) return "—";
    return field === "allotted" ? b.allotted : b.allotted - b.used;
  };
  return (
    <tr>
      <td className="border border-black p-1 italic">{label}</td>
      <td className="border border-black p-1 text-center">{value(sem1)}</td>
      <td className="border border-black p-1 text-center">{value(sem2)}</td>
    </tr>
  );
}

export function peso(amount: number): string {
  return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}
