import { randomUUID } from "node:crypto";
import { Repository, SyncJob, User } from "./models.js";
import {
  analyze,
  decrypt,
  github,
  githubPage,
  HttpError,
  metadata,
} from "./github.js";
import { performSync, type SyncStore } from "./sync-core.js";
import { repositoryActivity } from "./activity.js";

const runningStates = ["queued", "running", "waiting"];
export async function migrateRepositories(owner: unknown) {
  // Legacy records were explicitly imported for presentation. Keep them featured
  // without changing their analytics. Newly discovered records have featured=false.
  await Repository.updateMany(
    { owner, featured: { $exists: false } },
    { $set: { featured: true, featuredOrder: 0, eligible: true } },
  );
}
export async function enqueueSync(owner: unknown, refresh = false) {
  await migrateRepositories(owner);
  let job = await SyncJob.findOne({ owner });
  if (job && runningStates.includes(job.state || "")) return job;
  if (job && !refresh) return job;
  if (job?.startedAt && Date.now() - job.startedAt.getTime() < 60000)
    throw new HttpError(
      429,
      "Analytics were refreshed recently. Please wait one minute.",
    );
  const update = {
    state: "queued",
    phase: "discovering",
    run: randomUUID(),
    page: 1,
    discovered: 0,
    analyzed: 0,
    skipped: 0,
    processed: 0,
    error: null,
    retryAt: new Date(),
    lease: null,
    leaseUntil: new Date(0),
    attempts: 0,
    startedAt: new Date(),
    completedAt: null,
  };
  if (!job) {
    try {
      return await SyncJob.create({ owner, ...update });
    } catch (error: any) {
      if (error.code !== 11000) throw error;
      return SyncJob.findOne({ owner });
    }
  }
  return SyncJob.findOneAndUpdate(
    { _id: job._id, state: { $nin: runningStates } },
    { $set: update },
    { new: true },
  );
}
export async function syncStatus(owner: unknown) {
  const job = await SyncJob.findOne({ owner }).lean();
  const reasons = await Repository.find({
    owner,
    status: { $in: ["error", "skipped"] },
  })
    .select("name fullName status error")
    .lean();
  return job
    ? {
        state: job.state,
        phase: job.phase,
        discovered: job.discovered,
        analyzed: job.analyzed,
        skipped: job.skipped,
        pending: Math.max(0, (job.discovered || 0) - (job.processed || 0)),
        error: job.error,
        retryAt: job.retryAt,
        completedAt: job.completedAt,
        repositories: reasons,
      }
    : {
        state: "idle",
        discovered: 0,
        analyzed: 0,
        skipped: 0,
        pending: 0,
        repositories: reasons,
      };
}
async function runJob(job: any) {
  const filter = { _id: job._id, lease: job.lease, state: "running" };
  const checkpoint = async () => {
    if (
      !(await User.exists({ _id: job.owner, connected: true })) ||
      !(await SyncJob.exists({ ...filter, leaseUntil: { $gt: new Date() } }))
    )
      throw new HttpError(409, "Synchronization cancelled or lease expired.");
  };
  const heartbeat = setInterval(() => {
    void SyncJob.updateOne(filter, {
      $set: { leaseUntil: new Date(Date.now() + 120000) },
    }).catch(() => {});
  }, 20000);
  try {
    const user = await User.findById(job.owner).select("+token");
    if (!user?.connected || !user.token)
      throw new HttpError(409, "Reconnect GitHub to synchronize analytics.");
    const token = decrypt(user.token);
    const store: SyncStore = {
      checkpoint,
      progress: async (patch) => {
        const result = await SyncJob.updateOne(filter, { $set: patch });
        if (!result.matchedCount)
          throw new HttpError(409, "Synchronization was cancelled.");
      },
      discover: async (repos, run) => {
        await checkpoint();
        if (repos.length)
          await Repository.bulkWrite(
            repos.map((repo) => ({
              updateOne: {
                filter: { owner: job.owner, githubId: repo.id },
                update: {
                  $set: { ...metadata(repo), eligible: true, seenRun: run },
                  $setOnInsert: {
                    featured: false,
                    pinned: false,
                    featuredOrder: 0,
                    status: "pending",
                  },
                },
                upsert: true,
              },
            })),
          );
      },
      finishDiscovery: async (run) => {
        await checkpoint();
        await Repository.updateMany(
          { owner: job.owner, seenRun: { $ne: run } },
          {
            $set: {
              eligible: false,
              status: "skipped",
              error:
                "No longer returned by the authorized public repository listing (removed, private, or access changed).",
            },
          },
        );
      },
      next: async (run) =>
        Repository.findOne({
          owner: job.owner,
          seenRun: run,
          eligible: true,
          processedRun: { $ne: run },
        })
          .sort({ githubId: 1 })
          .lean(),
      save: async (id, patch) => {
        await checkpoint();
        await Repository.updateOne(
          { _id: id, owner: job.owner },
          { $set: patch },
        );
      },
      counts: async (run) => {
        const base = { owner: job.owner, seenRun: run };
        const [discovered, analyzed, skipped, processed] = await Promise.all([
          Repository.countDocuments(base),
          Repository.countDocuments({
            ...base,
            processedRun: run,
            status: "ready",
          }),
          Repository.countDocuments({
            ...base,
            processedRun: run,
            status: { $in: ["skipped", "error"] },
          }),
          Repository.countDocuments({ ...base, processedRun: run }),
        ]);
        return { discovered, analyzed, skipped, processed };
      },
    };
    await performSync(job, store, {
      page: (page) =>
        githubPage(
          `/user/repos?visibility=public&affiliation=owner,collaborator,organization_member&sort=full_name&direction=asc&per_page=100&page=${page}`,
          token,
        ),
      repository: (id) => github(`/repositories/${id}`, token),
      analyze: (repo, check) => analyze(repo, token, check),
      activity: (repo) => repositoryActivity(repo, user.githubLogin, token),
    });
    await User.updateOne({ _id: user._id }, { $set: { analyticsVersion: 1 } });
  } catch (error) {
    const http = error instanceof HttpError ? error : null;
    if (http?.status === 401)
      await User.updateOne({ _id: job.owner }, { $set: { connected: false } });
    const retry =
      (!http || http.status === 429 || http.status >= 500) && job.attempts < 8;
    await SyncJob.updateOne(filter, {
      $set: {
        state: retry ? "waiting" : http?.status === 409 ? "cancelled" : "error",
        error:
          http?.message ||
          "GitHub synchronization interrupted. Retrying automatically.",
        retryAt:
          http?.retryAt ||
          new Date(Date.now() + Math.min(3600000, 60000 * 2 ** job.attempts)),
        leaseUntil: new Date(0),
      },
      $inc: { attempts: 1 },
    });
  } finally {
    clearInterval(heartbeat);
  }
}
export function startSyncWorker() {
  let busy = false,
    stopped = false;
  const tick = async () => {
    if (busy || stopped) return;
    busy = true;
    try {
      const now = new Date();
      const job = await SyncJob.findOneAndUpdate(
        {
          $or: [
            { state: { $in: ["queued", "waiting"] }, retryAt: { $lte: now } },
            { state: "running", leaseUntil: { $lte: now } },
          ],
        },
        {
          $set: {
            state: "running",
            lease: randomUUID(),
            leaseUntil: new Date(Date.now() + 120000),
          },
        },
        { new: true, sort: { updatedAt: 1 } },
      );
      if (job) await runJob(job);
    } catch {
      console.error("Analytics worker unavailable; will retry.");
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => void tick(), 2000);
  void tick();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
