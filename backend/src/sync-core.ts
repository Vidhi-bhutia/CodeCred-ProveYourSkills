import { HttpError } from "./github.js";

export type SyncCursor = { run: string; page: number; phase: string };
export type SyncStore = {
  checkpoint(): Promise<void>;
  progress(update: Record<string, unknown>): Promise<void>;
  discover(repositories: any[], run: string): Promise<void>;
  finishDiscovery(run: string): Promise<void>;
  next(run: string): Promise<any | null>;
  save(id: unknown, patch: Record<string, unknown>): Promise<void>;
  counts(
    run: string,
  ): Promise<{
    discovered: number;
    analyzed: number;
    skipped: number;
    processed: number;
  }>;
};
export type SyncSource = {
  page(page: number): Promise<{ data: any[]; next: number | null }>;
  repository(id: number): Promise<any>;
  analyze(
    repository: any,
    checkpoint: () => Promise<void>,
  ): Promise<Record<string, unknown>>;
  activity(repository: any): Promise<Record<string, unknown>>;
};
export function featurePatch(featured: boolean, order = 0) {
  return { featured, pinned: featured, featuredOrder: order };
}
export function canReuseAnalysis(record: any, repo: any) {
  return (
    record.status === "ready" &&
    record.analysisVersion === 1 &&
    record.analyzedPushedAt &&
    repo.pushed_at &&
    new Date(record.analyzedPushedAt).getTime() ===
      new Date(repo.pushed_at).getTime()
  );
}
// The cursor and every completed repository are persisted independently. A retry
// repeats only the unfinished work; all writes use stable owner/GitHub identities.
export async function performSync(
  job: SyncCursor,
  store: SyncStore,
  source: SyncSource,
) {
  if (job.phase === "discovering") {
    const visited = new Set<number>();
    let page = job.page;
    while (true) {
      await store.checkpoint();
      if (visited.has(page))
        throw new Error("GitHub returned a repeating pagination cursor.");
      visited.add(page);
      const result = await source.page(page);
      await store.discover(
        result.data.filter((repo) => !repo.private),
        job.run,
      );
      await store.progress(await store.counts(job.run));
      if (result.next === null) break;
      page = result.next;
      await store.progress({ page });
    }
    await store.finishDiscovery(job.run);
    await store.progress({ phase: "analyzing" });
  }
  let record;
  while ((record = await store.next(job.run))) {
    await store.checkpoint();
    // Keep previous successful analytics intact while a refresh is pending.
    try {
      const repo = await source.repository(record.githubId);
      if (repo.private || (repo.visibility && repo.visibility !== "public")) {
        await store.save(record._id, {
          eligible: false,
          status: "skipped",
          error: "Repository is no longer public.",
          processedRun: job.run,
        });
        continue;
      }
      let evidence: Record<string, unknown> = {};
      try {
        if (!canReuseAnalysis(record, repo))
          evidence = await source.analyze(repo, store.checkpoint);
      } catch (error) {
        if (!(error instanceof HttpError) || error.status !== 422) throw error;
        await store.save(record._id, {
          status: "skipped",
          error: error.message,
          processedRun: job.run,
        });
        await store.progress(await store.counts(job.run));
        continue;
      }
      const activity = await source.activity(repo);
      await store.checkpoint();
      await store.save(record._id, {
        ...evidence,
        eligible: true,
        status: "ready",
        error: null,
        analysisVersion: 1,
        analyzedPushedAt: repo.pushed_at,
        syncedAt: new Date(),
        activity,
        activitySyncedAt: new Date(),
        processedRun: job.run,
      });
    } catch (error) {
      if (
        !(error instanceof HttpError) ||
        error.status === 429 ||
        error.status === 401 ||
        error.status >= 500
      )
        throw error;
      await store.save(record._id, {
        status: "skipped",
        error: error.message,
        processedRun: job.run,
        ...(error.status === 404 ? { eligible: false } : {}),
      });
    }
    await store.progress(await store.counts(job.run));
  }
  await store.progress({
    ...(await store.counts(job.run)),
    state: "completed",
    completedAt: new Date(),
    error: null,
    attempts: 0,
  });
}
