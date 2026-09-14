import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Salary Grade monthly rates for 2026, from the source "SG TABLE".
const SG_TABLE_2026: Record<number, number> = {
  1: 14061, 2: 14925, 3: 15852, 4: 16833, 5: 17866, 6: 18957, 7: 20110,
  8: 21448, 9: 23226, 10: 25586, 11: 30024, 12: 32245, 13: 34421, 14: 37024,
  15: 40208, 16: 43560, 17: 47247, 18: 51304, 19: 56390, 20: 62967, 21: 70013,
  22: 78162, 23: 87315, 24: 98185, 25: 111727, 26: 126252, 27: 142663,
  28: 160469, 29: 180492, 30: 203200, 31: 293191, 32: 347888, 33: 438844,
};

async function main() {
  for (const [salaryGrade, monthlyAmount] of Object.entries(SG_TABLE_2026)) {
    await prisma.salaryGradeRate.upsert({
      where: { year_salaryGrade: { year: 2026, salaryGrade: Number(salaryGrade) } },
      update: { monthlyAmount },
      create: { year: 2026, salaryGrade: Number(salaryGrade), monthlyAmount },
    });
  }
  console.log(`Seeded ${Object.keys(SG_TABLE_2026).length} salary grade rates for 2026.`);

  const adminUsername = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  const existingAdmin = await prisma.user.findUnique({ where: { username: adminUsername } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: { username: adminUsername, passwordHash, role: "ADMIN" },
    });
    console.log(`Created admin user "${adminUsername}" with password "${adminPassword}". CHANGE THIS PASSWORD.`);
  } else {
    console.log(`Admin user "${adminUsername}" already exists, skipping.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
