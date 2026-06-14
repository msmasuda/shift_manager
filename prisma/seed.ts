import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding started...");

  // 1. 既存のデータをリセットする場合（オプション、今回は新規追加のみでもよいがクリーンアップするなら）
  // await prisma.shiftAssignment.deleteMany();
  // await prisma.scheduleDay.deleteMany();
  // await prisma.user.deleteMany();
  // await prisma.organization.deleteMany();

  // 1. 組織の作成
  const org = await prisma.organization.create({
    data: {
      name: "サンプルカフェ (Seeded)",
    },
  });

  // 2. ユーザーの作成
  const userNames = ["山田 太郎", "佐藤 花子", "鈴木 一郎", "高橋 美咲", "伊藤 健太"];
  const users = [];
  for (let i = 0; i < userNames.length; i++) {
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        name: userNames[i],
        email: `user${i}@example.com`,
        role: i === 0 ? "ADMIN" : "MEMBER",
      },
    });
    users.push(user);
  }

  // 3. 今後14日間のスケジュール日とシフト割り当てを作成
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(today.getDate() + i);
    d.setHours(0, 0, 0, 0);

    const minRequired = Math.floor(Math.random() * 3) + 2; // 2〜4人の必要人数

    const scheduleDay = await prisma.scheduleDay.create({
      data: {
        organizationId: org.id,
        date: d,
        minRequired: minRequired,
      },
    });

    // ランダムなユーザーにシフトを割り当てる (必要人数マイナス1〜プラス1程度のアサインにして散らす)
    const assignCount = Math.max(1, minRequired - 1 + Math.floor(Math.random() * 3)); 
    const shuffledUsers = [...users].sort(() => 0.5 - Math.random());
    const selectedUsers = shuffledUsers.slice(0, assignCount);

    for (const u of selectedUsers) {
      // 09:00〜15:00 の間でランダムな開始時間
      const startHour = Math.floor(Math.random() * 7) + 9;
      // 開始時間から4〜8時間後の終了時間を設定（最大22:00まで）
      const duration = Math.floor(Math.random() * 5) + 4;
      const endHour = Math.min(22, startHour + duration);

      await prisma.shiftAssignment.create({
        data: {
          scheduleDayId: scheduleDay.id,
          userId: u.id,
          startTime: `${startHour.toString().padStart(2, "0")}:00`,
          endTime: `${endHour.toString().padStart(2, "0")}:00`,
        },
      });
    }
  }

  console.log("Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
