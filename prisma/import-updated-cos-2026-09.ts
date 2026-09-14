// Reconciles the roster against "2026 Inventory of Manpower.xlsx" (sheet
// "Updated COS", uploaded 2026-09-07). Employee No. is the natural key for
// existing employees (matched by name — see biometric-match.ts's
// matchEmployeeByName, the same safe exact/typo/dropped-middle-name logic
// built for the biometrics feature); newly-seen names get the next free
// Employee No. after the prior max (202).
//
// Data-quality notes:
// - The source sheet has no Office Assignment column. Office for each new
//   hire was cross-referenced against the same workbook's "Charter" sheet
//   (which lists office section headers) via the same name matcher, mapped
//   to this system's existing office-string conventions. 18 of the 54 new
//   hires aren't in "Charter" either — imported as ACTIVE under "UNASSIGNED"
//   for HR to fill in via the Employees page.
// - Ayson, Ma. Erika Monique G. (Nutrition Clerk) and Ruguian, Shara Mae A.
//   (Medical Technologist I) are marked "INCOMING" in the source with no
//   salary grade set yet — imported with salaryGrade 0 as an explicit
//   not-yet-assigned marker rather than guessing a plausible number.
// - 0 currently-active employees are missing from the new sheet — nobody
//   needs to be marked as having left.
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type Change = { employeeNo: string; name: string; positionTitle: string; salaryGrade: number };

const CHANGES: Change[] = [
  { employeeNo: "134", name: "Agulay, Alexander A.", positionTitle: "Watchman II", salaryGrade: 4 },
  { employeeNo: "105", name: "Agulay, Ervin Nicko J.", positionTitle: "Admin Aide IV (Electrician I)", salaryGrade: 4 },
  { employeeNo: "136", name: "Baga, Edna Jean M.", positionTitle: "Medical Technologist I", salaryGrade: 11 },
  { employeeNo: "30", name: "Dela Cruz, Daisy N.", positionTitle: "Aministrative Aide III (Clerk I)", salaryGrade: 3 },
  { employeeNo: "182", name: "Espiritu, Rachel S.", positionTitle: "Livestock Inspector II", salaryGrade: 6 },
  { employeeNo: "33", name: "Gudoy, Miel Joshua D.", positionTitle: "Admin. Aide III (Clerk I)", salaryGrade: 3 },
  { employeeNo: "48", name: "Padunan, Lucky Raymundo", positionTitle: "Admin. Aide III (Driver I)", salaryGrade: 3 },
  { employeeNo: "12", name: "Real, Demilka Vienna A.", positionTitle: "Nursing Attendant II", salaryGrade: 6 },
  { employeeNo: "117", name: "Ribac, Eddie Lord B.", positionTitle: "Admin Aide IV (Electrician I)", salaryGrade: 4 },
  { employeeNo: "148", name: "Saludez, Shiela Madonna Sandee B.", positionTitle: "Nurse I", salaryGrade: 7 },
  { employeeNo: "121", name: "Sapaden, Paul Daverick M.", positionTitle: "Admin Aide IV (Electrician I)", salaryGrade: 4 },
  { employeeNo: "161", name: "Silac, John Paul", positionTitle: "Admin. Aide III (Clerk I)", salaryGrade: 3 },
  { employeeNo: "202", name: "Talaro, Angelou A.", positionTitle: "Admin. Aide III (Clerk I)", salaryGrade: 3 },
  { employeeNo: "151", name: "Tolentino, Cheenee Mae U.", positionTitle: "Nursing Attendant II", salaryGrade: 8 },
];

type NewHire = { employeeNo: string; name: string; positionTitle: string; salaryGrade: number; office: string };

const NEW_HIRES: NewHire[] = [
  { employeeNo: "203", name: "Aguibitin, Richard", positionTitle: "Admin. Aide III (Driver I)", salaryGrade: 3, office: "UNASSIGNED" },
  { employeeNo: "204", name: "Alcantara, Yvonne Melody J.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "205", name: "Alibuyog, Bryan Joshua A.", positionTitle: "Engineer I (Electrical Engineer)", salaryGrade: 12, office: "UNASSIGNED" },
  { employeeNo: "206", name: "Austria, Orland Vince G.", positionTitle: "Admin. Aide IV (Electrician I)", salaryGrade: 4, office: "UNASSIGNED" },
  { employeeNo: "207", name: "Ayson, Ma. Erika Monique G.", positionTitle: "Nutrition Clerk", salaryGrade: 0, office: "UNASSIGNED" },
  { employeeNo: "208", name: "Bagaoisan, Raniel N.", positionTitle: "Admin. Aide IV", salaryGrade: 4, office: "OFFICE OF THE CITY MAYOR - CAD" },
  { employeeNo: "209", name: "Baldivino, Darrelle Lisa M.", positionTitle: "Admin. Aide III (Clerk I)", salaryGrade: 3, office: "OFFICE OF THE CITY ENGINEER" },
  { employeeNo: "210", name: "Baldovi, Marie Mar A.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "211", name: "Basamot, Jenevy D.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "212", name: "Biag, Joy Angie D.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "213", name: "Cacao, Gilmar M.", positionTitle: "Admin. Aide III (Driver I)", salaryGrade: 3, office: "UNASSIGNED" },
  { employeeNo: "214", name: "Calacal, Charlie B.", positionTitle: "Admin. Aide II (Reproduction Machine Operator)", salaryGrade: 2, office: "OFFICE OF THE CITY MAYOR - CAD" },
  { employeeNo: "215", name: "Calacal, Mark Angelo G.", positionTitle: "Admin. Aide III (Driver I)", salaryGrade: 3, office: "UNASSIGNED" },
  { employeeNo: "216", name: "Calapao, Arsenia C.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "217", name: "Cupay, Rienrev T.", positionTitle: "Admin. Aide III (Clerk I)", salaryGrade: 3, office: "UNASSIGNED" },
  { employeeNo: "218", name: "Cusay, Elizabeth H.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "219", name: "Dalag, Josephine A.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "220", name: "Gabbac, Aileen N.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "221", name: "Gaoat, John Dane F.", positionTitle: "Watchman I", salaryGrade: 2, office: "UNASSIGNED" },
  { employeeNo: "222", name: "Garaña, Cathleah D.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "223", name: "Gudoy, Benedict John M.", positionTitle: "Admin. Aide III (Clerk I)", salaryGrade: 3, office: "OFFICE OF THE CITY BUILDING OFFICIAL" },
  { employeeNo: "224", name: "Ilaga, Florestina V.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "225", name: "Jerez, Enelia M.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "226", name: "Madrid, Maryrose B.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "227", name: "Manglal-lan, Edralin I.", positionTitle: "Watchman I", salaryGrade: 2, office: "UNASSIGNED" },
  { employeeNo: "228", name: "Manzano, Jocelyn S.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "229", name: "Naanep, Jona-Ann A.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "230", name: "Natividad, Michelle T.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "231", name: "Ortal, Dyanara G.", positionTitle: "Admin. Aide IV", salaryGrade: 4, office: "OFFICE OF THE CITY MAYOR - CAD" },
  { employeeNo: "232", name: "Ortal, John Andrew D.", positionTitle: "Admin. Aide I (Utility Worker I)", salaryGrade: 1, office: "UNASSIGNED" },
  { employeeNo: "233", name: "Pacaoan, Jonalie B.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "234", name: "Pagat, Angelita C.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "235", name: "Palapal, Hanscel Mae D.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "236", name: "Pataray, Corazon C.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "237", name: "Pucan, Rexxian D.", positionTitle: "Administrative Aide III (Clerk I)", salaryGrade: 3, office: "OFFICE OF THE CITY MAYOR - BPLS" },
  { employeeNo: "238", name: "Pungtilan, John Lester A.", positionTitle: "Aquaculture Technician", salaryGrade: 6, office: "UNASSIGNED" },
  { employeeNo: "239", name: "Puyot, Ludivina D.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "240", name: "Quibin, Frederick P.", positionTitle: "Watchman I", salaryGrade: 2, office: "UNASSIGNED" },
  { employeeNo: "241", name: "Quiel, Sonny A.", positionTitle: "Administrative Aide I (Utility Worker I)", salaryGrade: 1, office: "ASSIGNED AT DEPED" },
  { employeeNo: "242", name: "Quilit, Imela Marie T.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "243", name: "Razalan, Noren C.", positionTitle: "Admin. Aide I (Utility Worker I)", salaryGrade: 1, office: "UNASSIGNED" },
  { employeeNo: "244", name: "Rola, Crystel Joy B.", positionTitle: "Engineer I (Civil Engineer)", salaryGrade: 12, office: "UNASSIGNED" },
  { employeeNo: "245", name: "Ruguian, Shara Mae A.", positionTitle: "Medical Technologist I", salaryGrade: 0, office: "UNASSIGNED" },
  { employeeNo: "246", name: "Sabundayo, May-Ann O.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "247", name: "Sadorra, Trixie Aira", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "248", name: "Saguiguit, Rafael Jr. M.", positionTitle: "Administrative Aide I (Utility Worker I)", salaryGrade: 1, office: "ASSIGNED AT DEPED" },
  { employeeNo: "249", name: "Sagun, Arthur M.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "250", name: "Sagun, Johna Jill F.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "251", name: "Sagun, Maria Christina D.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "252", name: "Salvatera, Christopher P.", positionTitle: "Admin. Aide III (Driver I)", salaryGrade: 3, office: "UNASSIGNED" },
  { employeeNo: "253", name: "Sampayan, Lance Margaux Nathaniel", positionTitle: "Admin. Aide III (Clerk I)", salaryGrade: 3, office: "UNASSIGNED" },
  { employeeNo: "254", name: "Suagao, Jhon James V.", positionTitle: "Watchman I", salaryGrade: 2, office: "UNASSIGNED" },
  { employeeNo: "255", name: "Tutaan, Trisha Izabelle A.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
  { employeeNo: "256", name: "Ulep, Leonida A.", positionTitle: "Day Care Worker I", salaryGrade: 6, office: "OFFICE OF THE CSWDO" },
];

async function main() {
  let updated = 0;
  for (const c of CHANGES) {
    await prisma.employee.update({
      where: { employeeNo: c.employeeNo },
      data: { positionTitle: c.positionTitle, salaryGrade: c.salaryGrade },
    });
    updated++;
  }

  let created = 0;
  for (const h of NEW_HIRES) {
    await prisma.employee.create({
      data: {
        employeeNo: h.employeeNo,
        name: h.name,
        positionTitle: h.positionTitle,
        salaryGrade: h.salaryGrade,
        officeAssignment: h.office,
        status: "ACTIVE",
      },
    });
    created++;
  }

  console.log(`Reconciliation complete: ${updated} updated, ${created} created.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
