import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcryptjs from "bcryptjs";
import "dotenv/config";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

const companies = [
  {
    name: "サンプルカフェ",
    users: [
      { name: "山田 太郎", email: "yamada@cafe.example.com", role: "ADMIN" as const },
      { name: "佐藤 花子", email: "sato@cafe.example.com", role: "MEMBER" as const },
      { name: "鈴木 一郎", email: "suzuki@cafe.example.com", role: "MEMBER" as const },
      { name: "高橋 美咲", email: "takahashi@cafe.example.com", role: "MEMBER" as const },
      { name: "伊藤 健太", email: "ito@cafe.example.com", role: "MEMBER" as const },
    ],
  },
  {
    name: "サンプルベーカリー",
    users: [
      { name: "中村 由美", email: "nakamura@bakery.example.com", role: "ADMIN" as const },
      { name: "小林 翔", email: "kobayashi@bakery.example.com", role: "MEMBER" as const },
      { name: "加藤 さくら", email: "kato@bakery.example.com", role: "MEMBER" as const },
      { name: "吉田 大輔", email: "yoshida@bakery.example.com", role: "MEMBER" as const },
    ],
  },
];

async function main() {
  console.log("Seeding started...");

  // 既存データがあればスキップ
  const existingOrg = await prisma.organization.findFirst();
  if (existingOrg) {
    console.log("Data already exists. Skipping seed.");
    return;
  }

  const passwordHash = await bcryptjs.hash("password123", 12);

  for (const company of companies) {
    const org = await prisma.organization.create({
      data: { name: company.name },
    });

    const users = [];
    for (const u of company.users) {
      const user = await prisma.user.create({
        data: { organizationId: org.id, ...u, passwordHash },
      });
      users.push(user);
    }

    const today = new Date();
    // 今月1日から末日まで生成
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const totalDays = endOfMonth.getDate();

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startOfMonth);
      d.setDate(startOfMonth.getDate() + i);
      d.setHours(0, 0, 0, 0);

      const minRequired = Math.floor(Math.random() * 3) + 2;

      const scheduleDay = await prisma.scheduleDay.create({
        data: { organizationId: org.id, date: d, minRequired },
      });

      const assignCount = Math.max(1, minRequired - 1 + Math.floor(Math.random() * 3));
      const selectedUsers = [...users].sort(() => 0.5 - Math.random()).slice(0, assignCount);

      for (const user of selectedUsers) {
        const startHour = Math.floor(Math.random() * 7) + 9;
        const endHour = Math.min(22, startHour + Math.floor(Math.random() * 5) + 4);
        await prisma.shiftAssignment.create({
          data: {
            scheduleDayId: scheduleDay.id,
            userId: user.id,
            startTime: `${startHour.toString().padStart(2, "0")}:00`,
            endTime: `${endHour.toString().padStart(2, "0")}:00`,
          },
        });
      }
    }

    console.log(`✓ ${company.name} (${company.users.length}名)`);
  }

  console.log("Seeding completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
