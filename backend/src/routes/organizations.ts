import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const orgRouter = Router();

// 開発用: 組織一覧（認証実装時に organizationId はセッションから取得）
orgRouter.get("/", async (_req, res) => {
  const orgs = await prisma.organization.findMany({ orderBy: { name: "asc" } });
  res.json(orgs);
});

orgRouter.post("/", async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "name is required" });
  }
  const org = await prisma.organization.create({ data: { name } });
  res.status(201).json(org);
});
