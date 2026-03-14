import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const usersRouter = Router();

// 組織に紐づくユーザー一覧（認証実装時は organizationId をセッションから）
usersRouter.get("/", async (req, res) => {
  const organizationId = req.query.organizationId as string | undefined;
  if (!organizationId) {
    return res.status(400).json({ error: "organizationId is required" });
  }
  const users = await prisma.user.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });
  res.json(users);
});

usersRouter.post("/", async (req, res) => {
  const { organizationId, email, name, role } = req.body;
  if (!organizationId || !email || !name) {
    return res.status(400).json({ error: "organizationId, email, name are required" });
  }
  const user = await prisma.user.create({
    data: {
      organizationId,
      email,
      name,
      role: role === "ADMIN" ? "ADMIN" : "MEMBER",
    },
  });
  res.status(201).json(user);
});
