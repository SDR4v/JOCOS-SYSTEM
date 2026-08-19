// Shared "Application for Wellness Leave" form shell, adapted from the
// office's CS Form No. 6 layout. Used both for a specific (filled-in)
// request and for a blank form printed ahead of a request being filed.

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
  requestedByLabel: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | null;
  approvedForDaysLabel: string;
  approvalSignature: { name: string; role: string } | null;
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
  requestedByLabel,
  status,
  approvedForDaysLabel,
  approvalSignature,
}: WellnessLeaveApplicationFormProps) {
  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-[13px] text-black print:m-0 print:max-w-none print:p-0">
      <p className="text-xs italic">
        Adapted from CS Form No. 6
        <br />
        (Revised 2020)
      </p>

      <div className="mb-1 text-center">
        <p className="italic">Republic of the Philippines</p>
        <p className="font-bold italic">CITY GOVERNMENT OF BATAC</p>
        <p className="text-xs italic">Brgy. 1-S Valdez, City of Batac, Ilocos Norte</p>
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
        <div className="border-b border-black bg-gray-100 py-1 text-center font-bold">6. DETAILS OF APPLICATION</div>

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
        <div className="border-b border-black bg-gray-100 py-1 text-center font-bold">
          7. DETAILS OF ACTION ON APPLICATION
        </div>

        {/* 7.A / 7.B */}
        <div className="flex border-b border-black">
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
              {requestedByLabel}
              <br />
              (Authorized Officer)
            </p>
          </div>
          <div className="w-1/2 p-2">
            <p className="mb-2 font-bold">7.B RECOMMENDATION</p>
            <p>{status === "APPROVED" ? "☑" : "☐"} For approval</p>
            <p>
              {status === "REJECTED" ? "☑" : "☐"} For disapproval due to
              {status === "REJECTED" ? " " : " ______________________"}
            </p>
            <p className="mt-4 border-b border-black">&nbsp;</p>
            <p className="mt-1 border-b border-black">&nbsp;</p>
          </div>
        </div>

        {/* 7.C / 7.D */}
        <div className="flex">
          <div className="w-1/2 border-r border-black p-2">
            <p className="mb-2 font-bold">7.C APPROVED FOR:</p>
            <p>{approvedForDaysLabel} days with pay</p>
            <p>____ days without pay</p>
            <p>____ others (Specify) ________________</p>
            {approvalSignature && (
              <>
                <div className="mt-6 mb-1 h-8 border-b border-black" />
                <p className="text-center text-xs">
                  {approvalSignature.name}
                  <br />({approvalSignature.role})
                </p>
              </>
            )}
          </div>
          <div className="w-1/2 p-2">
            <p className="mb-2 font-bold">7.D DISAPPROVED DUE TO:</p>
            <p className="mt-4 border-b border-black">&nbsp;</p>
            <p className="mt-4 border-b border-black">&nbsp;</p>
            <p className="mt-4 border-b border-black">&nbsp;</p>
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
