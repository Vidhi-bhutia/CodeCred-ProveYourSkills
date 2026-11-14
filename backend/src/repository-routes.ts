import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { Repository, User } from "./models.js";
import { HttpError } from "./github.js";
import { aggregate, badges } from "./analytics.js";
import { enqueueSync, migrateRepositories, syncStatus } from "./sync.js";
import { featurePatch } from "./sync-core.js";
export const repositoryRoutes = Router();
async function owner(req: Request) {
  const user = req.session?.userId
    ? await User.findById(req.session.userId)
    : null;
  if (!user) throw new HttpError(401, "Sign in with GitHub to continue.");
  await migrateRepositories(user._id);
  return user;
}
repositoryRoutes.get("/github/repositories", async (req, res) => {
  const user = await owner(req);
  const page = z.coerce.number().int().min(1).default(1).parse(req.query.page);
  const query = z.string().max(100).default("").parse(req.query.q);
  const literal = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter = {
    owner: user._id,
    eligible: { $ne: false },
    ...(query
      ? {
          $or: [
            { name: { $regex: literal, $options: "i" } },
            { description: { $regex: literal, $options: "i" } },
          ],
        }
      : {}),
  };
  const records = await Repository.find(filter)
    .sort({ name: 1, _id: 1 })
    .skip((page - 1) * 30)
    .limit(31);
  res.json({
    repositories: records.slice(0, 30),
    hasMore: records.length > 30,
  });
});
repositoryRoutes.get("/repositories", async (req, res) => {
  const user = await owner(req);
  res.json(
    await Repository.find({ owner: user._id, eligible: { $ne: false } }).sort({
      featured: -1,
      featuredOrder: 1,
      name: 1,
    }),
  );
});
repositoryRoutes.get("/featured", async (req, res) => {
  const user = await owner(req);
  res.json(
    await Repository.find({
      owner: user._id,
      eligible: { $ne: false },
      featured: true,
    }).sort({ featuredOrder: 1, name: 1 }),
  );
});
const idsSchema = z.object({
  ids: z
    .array(z.number().int().positive())
    .min(1)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Duplicate repository IDs",
    ),
});
async function feature(req: Request, res: Response) {
  const user = await owner(req);
  const { ids } = idsSchema.parse(req.body);
  const records = await Repository.find({
    owner: user._id,
    eligible: { $ne: false },
    githubId: { $in: ids },
  });
  if (records.length !== ids.length)
    throw new HttpError(
      409,
      "Some repositories are not available yet. Wait for discovery to finish and try again.",
    );
  const last = await Repository.findOne({
    owner: user._id,
    featured: true,
  }).sort({ featuredOrder: -1 });
  const offset = (last?.featuredOrder || 0) + 1;
  const operations = records
    .filter((repo) => !repo.featured)
    .map((repo, index) => ({
      updateOne: {
        filter: { _id: repo._id, owner: user._id },
        update: { $set: featurePatch(true, offset + index) },
      },
    }));
  if (operations.length) await Repository.bulkWrite(operations);
  res.json(
    await Repository.find({
      owner: user._id,
      featured: true,
      eligible: { $ne: false },
    }).sort({ featuredOrder: 1, name: 1 }),
  );
}
repositoryRoutes.post("/featured", feature);
// Compatibility for older clients: selection now affects presentation only.
repositoryRoutes.post("/repositories/import", feature);
repositoryRoutes.put("/featured/order", async (req, res) => {
  const user = await owner(req);
  const { ids } = z
    .object({
      ids: z
        .array(z.string().regex(/^[a-f\d]{24}$/i))
        .refine((ids) => new Set(ids).size === ids.length),
    })
    .parse(req.body);
  const records = await Repository.find({
    owner: user._id,
    featured: true,
    eligible: { $ne: false },
  });
  if (
    records.length !== ids.length ||
    records.some((repo) => !ids.includes(String(repo._id)))
  )
    throw new HttpError(
      409,
      "Featured repositories changed. Reload and try again.",
    );
  if (ids.length)
    await Repository.bulkWrite(
      ids.map((id, index) => ({
        updateOne: {
          filter: { _id: id, owner: user._id },
          update: { $set: { featuredOrder: index } },
        },
      })),
    );
  res.json({ ok: true });
});
repositoryRoutes.patch("/repositories/:id", async (req, res) => {
  const user = await owner(req);
  const { pinned } = z.object({ pinned: z.boolean() }).parse(req.body);
  const last = await Repository.findOne({
    owner: user._id,
    featured: true,
  }).sort({ featuredOrder: -1 });
  const record = await Repository.findOneAndUpdate(
    { _id: req.params.id, owner: user._id, eligible: { $ne: false } },
    { $set: featurePatch(pinned, (last?.featuredOrder || 0) + 1) },
    { new: true },
  );
  if (!record) throw new HttpError(404, "Repository not found.");
  res.json(record);
});
repositoryRoutes.delete("/repositories/:id", async (req, res) => {
  const user = await owner(req);
  const record = await Repository.findOneAndUpdate(
    { _id: req.params.id, owner: user._id },
    { $set: featurePatch(false) },
  );
  if (!record) throw new HttpError(404, "Repository not found.");
  res.json({ ok: true });
});
repositoryRoutes.post("/repositories/:id/refresh", async (req, res) => {
  const user = await owner(req);
  if (!(await Repository.exists({ _id: req.params.id, owner: user._id })))
    throw new HttpError(404, "Repository not found.");
  if (!user.connected)
    throw new HttpError(409, "Reconnect GitHub in Settings.");
  res.status(202).json(await enqueueSync(user._id, true));
});
repositoryRoutes.post("/analytics/refresh", async (req, res) => {
  const user = await owner(req);
  if (!user.connected)
    throw new HttpError(409, "Reconnect GitHub in Settings.");
  res.status(202).json(await enqueueSync(user._id, true));
});
repositoryRoutes.get("/analytics/sync", async (req, res) => {
  const user = await owner(req);
  res.json(await syncStatus(user._id));
});
repositoryRoutes.get("/analytics", async (req, res) => {
  const user = await owner(req);
  const stats = aggregate(
    await Repository.find({ owner: user._id, eligible: { $ne: false } }),
  );
  res.json({
    ...stats,
    badges: badges(stats),
    sync: await syncStatus(user._id),
  });
});
