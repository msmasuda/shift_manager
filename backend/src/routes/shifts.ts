import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const shiftsRouter = Router();

// 自分のシフト一覧（一般向け）: userId で検索。認証実装時はセッションの userId を使用
shiftsRouter.get("/my", async (req, res) => {
  const userId = req.query.userId as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }
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
  const { organizationId, date, userId, startTime, endTime } = req.body;
  if (!organizationId || !date || !userId || !startTime || !endTime) {
    return res.status(400).json({
      error: "organizationId, date, userId, startTime, endTime are required",
    });
  }
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
      startTime: String(startTime),
      endTime: String(endTime),
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
  const { date, userId, startTime, endTime } = req.body;
  const assignment = await prisma.shiftAssignment.findUnique({ where: { id } });
  if (!assignment) {
    return res.status(404).json({ error: "Assignment not found" });
  }
  const updates: { scheduleDayId?: string; userId?: string; startTime?: string; endTime?: string } = {};
  if (userId !== undefined) updates.userId = userId;
  if (startTime !== undefined) updates.startTime = String(startTime);
  if (endTime !== undefined) updates.endTime = String(endTime);
  if (date !== undefined) {
    const dateObj = new Date(date);
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
    updates.scheduleDayId = scheduleDay.id;
  }
  const updated = await prisma.shiftAssignment.update({
    where: { id },
    data: updates,
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
