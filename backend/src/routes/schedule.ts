import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const scheduleRouter = Router();

// 指定期間の日付別スケジュール（最低人数含む）を取得
scheduleRouter.get("/days", async (req, res) => {
  const organizationId = req.query.organizationId as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  if (!organizationId || !from || !to) {
    return res.status(400).json({ error: "organizationId, from, to are required" });
  }
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const days = await prisma.scheduleDay.findMany({
    where: {
      organizationId,
      date: { gte: fromDate, lte: toDate },
    },
    orderBy: { date: "asc" },
    include: {
      shiftAssignments: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  res.json(days);
});

// その日の最低人数を設定・更新
scheduleRouter.put("/days/:date", async (req, res) => {
  const organizationId = req.body.organizationId as string | undefined;
  const dateStr = req.params.date;
  const minRequired = req.body.minRequired;
  if (!organizationId || !dateStr) {
    return res.status(400).json({ error: "organizationId and date are required" });
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return res.status(400).json({ error: "Invalid date" });
  }
  const num = typeof minRequired === "number" ? minRequired : parseInt(String(minRequired), 10);
  if (isNaN(num) || num < 0) {
    return res.status(400).json({ error: "minRequired must be a non-negative number" });
  }
  const day = await prisma.scheduleDay.upsert({
    where: {
      organizationId_date: { organizationId, date },
    },
    create: { organizationId, date, minRequired: num },
    update: { minRequired: num },
  });
  res.json(day);
});

// 日付単位で「最低人数を下回っているか」の警告一覧を返す
scheduleRouter.get("/warnings", async (req, res) => {
  const organizationId = req.query.organizationId as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  if (!organizationId || !from || !to) {
    return res.status(400).json({ error: "organizationId, from, to are required" });
  }
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const days = await prisma.scheduleDay.findMany({
    where: {
      organizationId,
      date: { gte: fromDate, lte: toDate },
    },
    orderBy: { date: "asc" },
    include: { shiftAssignments: true },
  });

  const result = days
    .map((d) => {
      const uniqueCount = new Set(d.shiftAssignments.map((a) => a.userId)).size;
      return {
        date: d.date,
        minRequired: d.minRequired,
        assignedCount: uniqueCount,
        insufficient: uniqueCount < d.minRequired,
      };
    })
    .filter((w) => w.insufficient);

  res.json(result);
});
