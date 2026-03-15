import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";

export const orgRouter = Router();

const createOrgSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

// 開発用: 組織一覧（認証実装時に organizationId はセッションから取得）
orgRouter.get("/", async (_req, res) => {
  const orgs = await prisma.organization.findMany({ orderBy: { name: "asc" } });
  res.json(orgs);
});

orgRouter.post("/", async (req, res) => {
  const { name } = createOrgSchema.parse(req.body);
  const org = await prisma.organization.create({ data: { name } });
  res.status(201).json(org);
});
