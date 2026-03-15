import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";

export const scheduleRouter = Router();

const daysQuerySchema = z.object({
  organizationId: z.string().min(1),
  from: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  to: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

// 指定期間の日付別スケジュール（最低人数含む）を取得
scheduleRouter.get("/days", async (req, res) => {
  const { organizationId, from, to } = daysQuerySchema.parse(req.query);
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

const putDayParamsSchema = z.object({ date: z.string() });
const putDayBodySchema = z.object({ 
  organizationId: z.string().min(1),
  minRequired: z.number().int().min(0).or(z.string().regex(/^\d+$/).transform(Number))
});

// その日の最低人数を設定・更新
scheduleRouter.put("/days/:date", async (req, res) => {
  const { date: dateStr } = putDayParamsSchema.parse(req.params);
  const { organizationId, minRequired } = putDayBodySchema.parse(req.body);
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return res.status(400).json({ error: "Invalid date" });
  }
  const day = await prisma.scheduleDay.upsert({
    where: {
      organizationId_date: { organizationId, date },
    },
    create: { organizationId, date, minRequired },
    update: { minRequired },
  });
  res.json(day);
});

// 日付単位で「最低人数を下回っているか」の警告一覧を返す
scheduleRouter.get("/warnings", async (req, res) => {
  const { organizationId, from, to } = daysQuerySchema.parse(req.query);
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
