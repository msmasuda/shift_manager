import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";

export const shiftsRouter = Router();

// Zod schemas
const myShiftsQuerySchema = z.object({
  userId: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
});

const createShiftSchema = z.object({
  organizationId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/),
  userId: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const updateShiftSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/).optional(),
  userId: z.string().min(1).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

// 自分のシフト一覧（一般向け）: userId で検索。認証実装時はセッションの userId を使用
shiftsRouter.get("/my", async (req, res) => {
  const { userId, from, to } = myShiftsQuerySchema.parse(req.query);
  
  const fromDate = from ? new Date(from) : new Date();
  const toDate = to ? new Date(to) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  
  const assignments = await prisma.shiftAssignment.findMany({
    where: {
      userId,
      scheduleDay: {
        date: { gte: fromDate, lte: toDate },
      },
    },
    orderBy: { scheduleDay: { date: "asc" } },
    include: {
      scheduleDay: { select: { date: true, minRequired: true } },
    },
  });
  res.json(assignments);
});

// シフト割り当ての作成（管理者用）
shiftsRouter.post("/", async (req, res) => {
  const { organizationId, date, userId, startTime, endTime } = createShiftSchema.parse(req.body);
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return res.status(400).json({ error: "Invalid date" });
  }
  
  const scheduleDay = await prisma.scheduleDay.upsert({
    where: {
      organizationId_date: { organizationId, date: dateObj },
    },
    create: { organizationId, date: dateObj, minRequired: 1 },
    update: {},
  });
  
  const assignment = await prisma.shiftAssignment.create({
    data: {
      scheduleDayId: scheduleDay.id,
      userId,
      startTime,
      endTime,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      scheduleDay: { select: { date: true, minRequired: true } },
    },
  });
  
  res.status(201).json(assignment);
});

// シフト割り当ての更新（ドラッグで移動: 日付・時間・担当者変更）
shiftsRouter.patch("/:id", async (req, res) => {
  const id = req.params.id;
  const updates = updateShiftSchema.parse(req.body);
  
  const assignment = await prisma.shiftAssignment.findUnique({ where: { id } });
  if (!assignment) {
    return res.status(404).json({ error: "Assignment not found" });
  }
  
  const data: { scheduleDayId?: string; userId?: string; startTime?: string; endTime?: string } = {};
  if (updates.userId !== undefined) data.userId = updates.userId;
  if (updates.startTime !== undefined) data.startTime = updates.startTime;
  if (updates.endTime !== undefined) data.endTime = updates.endTime;
  
  if (updates.date !== undefined) {
    const dateObj = new Date(updates.date);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: "Invalid date" });
    }
    const org = await prisma.scheduleDay.findUnique({
      where: { id: assignment.scheduleDayId },
      select: { organizationId: true },
    });
    if (!org) return res.status(404).json({ error: "Schedule day not found" });
    
    const scheduleDay = await prisma.scheduleDay.upsert({
      where: {
        organizationId_date: { organizationId: org.organizationId, date: dateObj },
      },
      create: { organizationId: org.organizationId, date: dateObj, minRequired: 1 },
      update: {},
    });
    data.scheduleDayId = scheduleDay.id;
  }
  
  const updated = await prisma.shiftAssignment.update({
    where: { id },
    data,
    include: {
      user: { select: { id: true, name: true, email: true } },
      scheduleDay: { select: { date: true, minRequired: true } },
    },
  });
  res.json(updated);
});

// シフト割り当ての削除
shiftsRouter.delete("/:id", async (req, res) => {
  const id = req.params.id;
  await prisma.shiftAssignment.delete({ where: { id } }).catch(() => null);
  res.status(204).send();
});
