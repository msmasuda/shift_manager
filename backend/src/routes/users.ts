import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";

export const usersRouter = Router();

const querySchema = z.object({
  organizationId: z.string().min(1, "organizationId is required"),
});

const createUserSchema = z.object({
  organizationId: z.string().min(1, "organizationId is required"),
  email: z.string().email("Invalid email"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["ADMIN", "MEMBER"]).optional(),
});

// 組織に紐づくユーザー一覧（認証実装時は organizationId をセッションから）
usersRouter.get("/", async (req, res) => {
  const { organizationId } = querySchema.parse(req.query);
  const users = await prisma.user.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });
  res.json(users);
});

usersRouter.post("/", async (req, res) => {
  const { organizationId, email, name, role } = createUserSchema.parse(req.body);
  const user = await prisma.user.create({
    data: {
      organizationId,
      email,
      name,
      role: role ?? "MEMBER",
    },
  });
  res.status(201).json(user);
});
