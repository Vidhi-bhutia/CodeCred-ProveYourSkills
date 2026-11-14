import { repositoryRoutes } from "./repository-routes.js";
import { enqueueSync, migrateRepositories } from "./sync.js";
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import mongoose from "mongoose";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { config, configured } from "./config.js";
import { User, Repository, Edge, ProfileView, SyncJob } from "./models.js";
import { aggregate, badges, similarity } from "./analytics.js";
import {
  HttpError,
  github,
  metadata,
  analyze,
  encrypt,
  decrypt,
} from "./github.js";
declare module "express-session" {
  interface SessionData {
    userId?: string;
    oauthState?: string;
    oauthTime?: number;
  }
}
export const app = express();
app.disable("x-powered-by");
if (config.production) app.set("trust proxy", 1);
app.use(
  helmet(),
  cors({ origin: config.frontend, credentials: true }),
  express.json({ limit: "32kb" }),
);
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.get("/api/health", (_req, res) =>
  res.json({
    ok: true,
    configured: configured(),
    database: mongoose.connection.readyState === 1,
  }),
);
app.use("/api", (req, _res, next) => {
  if (!configured() || mongoose.connection.readyState !== 1)
    return next(
      new HttpError(
        503,
        "CodeCred is not configured yet. Follow README.md to connect MongoDB and GitHub OAuth.",
      ),
    );
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.origin !== config.frontend
  )
    return next(new HttpError(403, "Request origin is not allowed."));
  next();
});
let sessionMiddleware: express.RequestHandler | undefined;
if (configured())
  app.use((req, res, next) => {
    // The readiness guard above guarantees an established connection here.
    // Reuse it rather than creating a second, eager Atlas connection on import.
    if (!sessionMiddleware) {
      const store = MongoStore.create({
        client: mongoose.connection.getClient(),
        ttl: 7 * 86400,
      });
      store.on("error", () =>
        console.error("MongoDB session store operation failed."),
      );
      sessionMiddleware = session({
        name: "codecred.sid",
        secret: config.sessionSecret,
        store,
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: config.production,
          sameSite: "lax",
          maxAge: 7 * 86400000,
        },
      });
    }
    sessionMiddleware(req, res, next);
  });
async function current(req: express.Request) {
  const user = req.session?.userId
    ? await User.findById(req.session.userId)
    : null;
  if (!user) throw new HttpError(401, "Sign in with GitHub to continue.");
  return user;
}
async function tokenFor(user: Awaited<ReturnType<typeof current>>) {
  const account = await User.findById(user._id).select("+token");
  if (!account?.connected || !account.token)
    throw new HttpError(409, "GitHub is disconnected. Reconnect in Settings.");
  return decrypt(account.token);
}
function publicUser(u: any) {
  return {
    id: String(u._id),
    username: u.username,
    displayName: u.displayName,
    avatar: u.avatar,
    bio: u.bio,
    location: u.location,
    portfolio: u.portfolio,
    linkedin: u.linkedin,
    website: u.website,
    interests: u.interests,
    githubLogin: u.githubLogin,
    visibility: u.visibility,
    discovery: u.discovery,
    onboarded: u.onboarded,
    connected: u.connected,
    views: u.views,
    joinedAt: u.createdAt,
  };
}
app.get("/api/auth/github", (req, res) => {
  req.session.oauthState = randomBytes(32).toString("hex");
  req.session.oauthTime = Date.now();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callback,
    scope: "read:user user:email",
    state: req.session.oauthState,
  });
  req.session.save((error) => {
    if (error) return res.redirect(`${config.frontend}/?error=session`);
    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
  });
});
app.get("/api/auth/github/callback", async (req, res) => {
  try {
    const state = z.string().parse(req.query.state),
      expected = req.session.oauthState;
    const valid =
      expected &&
      state.length === expected.length &&
      timingSafeEqual(Buffer.from(state), Buffer.from(expected)) &&
      Date.now() - (req.session.oauthTime || 0) < 600000;
    delete req.session.oauthState;
    delete req.session.oauthTime;
    if (!valid || req.query.error)
      throw new HttpError(400, "Authorization could not be verified.");
    const response = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code: z.string().parse(req.query.code),
          redirect_uri: config.callback,
        }),
        signal: AbortSignal.timeout(20000),
      },
    );
    const data: any = await response.json();
    if (!data.access_token)
      throw new HttpError(401, "GitHub authorization failed.");
    const gh = await github("/user", data.access_token);
    // A reconnect may only restore the identity that owns the current session.
    if (req.session.userId) {
      const existing = await User.findById(req.session.userId);
      if (existing && existing.githubId !== String(gh.id))
        throw new HttpError(409, "Reconnect with the same GitHub account.");
    }
    const user = await User.findOneAndUpdate(
      { githubId: String(gh.id) },
      {
        $set: {
          githubLogin: gh.login,
          token: encrypt(data.access_token),
          connected: true,
        },
        $setOnInsert: {
          username: `${gh.login.toLowerCase()}-${gh.id}`,
          displayName: gh.name || gh.login,
          avatar: gh.avatar_url,
          bio: gh.bio || "",
        },
      },
      { upsert: true, new: true },
    );
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((e) => (e ? reject(e) : resolve())),
    );
    req.session.userId = String(user._id);
    await new Promise<void>((resolve, reject) =>
      req.session.save((e) => (e ? reject(e) : resolve())),
    );
    await enqueueSync(user._id, true).catch(() =>
      console.warn(
        "Analytics refresh could not be queued; retry from the dashboard.",
      ),
    );
    res.redirect(
      `${config.frontend}/${user.onboarded ? "dashboard" : "onboarding"}`,
    );
  } catch {
    res.redirect(`${config.frontend}/?error=oauth`);
  }
});
app.get("/api/me", async (req, res) => {
  const user = await current(req);
  if (user.connected) await enqueueSync(user._id);
  res.json(publicUser(user));
});
app.post("/api/auth/logout", async (req, res) => {
  await current(req);
  req.session.destroy(() => {
    res.clearCookie("codecred.sid");
    res.json({ ok: true });
  });
});
const safeUrl = z.union([
  z.literal(""),
  z
    .url()
    .refine(
      (v) =>
        new URL(v).protocol === "https:" || new URL(v).protocol === "http:",
      "Use an http or https URL",
    ),
]);
const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(70),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(39)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  bio: z.string().max(280),
  location: z.string().max(100),
  portfolio: safeUrl,
  website: safeUrl,
  linkedin: safeUrl,
  interests: z.string().max(200),
  visibility: z.enum(["public", "private"]),
  discovery: z.boolean(),
});
app.patch("/api/me", async (req, res) => {
  const user = await current(req);
  const data = profileSchema.parse(req.body);
  Object.assign(user, data, { onboarded: true });
  await user.save();
  res.json(publicUser(user));
});
app.post("/api/me/disconnect", async (req, res) => {
  const user = await current(req);
  const { deleteData } = z.object({ deleteData: z.boolean() }).parse(req.body);
  await SyncJob.updateOne(
    { owner: user._id },
    { $set: { state: "cancelled", leaseUntil: new Date(0) } },
  );
  user.connected = false;
  user.token = undefined;
  await user.save();
  if (deleteData) await Repository.deleteMany({ owner: user._id });
  res.json({ ok: true });
});
app.delete("/api/me", async (req, res) => {
  const user = await current(req);
  await Promise.all([
    SyncJob.deleteOne({ owner: user._id }),
    Repository.deleteMany({ owner: user._id }),
    Edge.deleteMany({ $or: [{ from: user._id }, { to: user._id }] }),
    ProfileView.deleteMany({ target: user._id }),
  ]);
  await user.deleteOne();
  req.session.destroy(() => {
    res.clearCookie("codecred.sid");
    res.json({ ok: true });
  });
});
app.use("/api", repositoryRoutes);
async function visibleProfile(username: string, viewer?: string) {
  const user = await User.findOne({ username });
  if (!user || (user.visibility !== "public" && String(user._id) !== viewer))
    throw new HttpError(404, "Profile not found or private.");
  return user;
}
app.get("/api/profiles/:username", async (req, res) => {
  const user = await visibleProfile(
    String(req.params.username),
    req.session.userId,
  );
  await migrateRepositories(user._id);
  const repos = await Repository.find({
    owner: user._id,
    eligible: { $ne: false },
  }).sort({ featuredOrder: 1, name: 1 });
  const stats = aggregate(repos);
  const [followers, following, kudos, isFollowing, hasKudos] =
    await Promise.all([
      Edge.countDocuments({ to: user._id, kind: "follow" }),
      Edge.countDocuments({ from: user._id, kind: "follow" }),
      Edge.countDocuments({ to: user._id, kind: "kudos" }),
      req.session.userId
        ? Edge.exists({
            from: req.session.userId,
            to: user._id,
            kind: "follow",
          })
        : false,
      req.session.userId
        ? Edge.exists({ from: req.session.userId, to: user._id, kind: "kudos" })
        : false,
    ]);
  res.json({
    user: publicUser(user),
    repositories: repos.filter((repo) => repo.featured),
    analytics: { ...stats, badges: badges(stats) },
    followers,
    following,
    kudos,
    isFollowing: !!isFollowing,
    hasKudos: !!hasKudos,
  });
});
app.post("/api/profiles/:username/view", async (req, res) => {
  const user = await visibleProfile(
    String(req.params.username),
    req.session.userId,
  );
  if (String(user._id) === req.session.userId) return res.json({ ok: true });
  const visitor = createHmac("sha256", config.sessionSecret)
    .update(
      `${req.session.userId || req.ip || "unknown"}:${new Date().toISOString().slice(0, 10)}`,
    )
    .digest("hex");
  const result = await ProfileView.updateOne(
    { target: user._id, visitor },
    { $setOnInsert: { expires: new Date(Date.now() + 86400000) } },
    { upsert: true },
  );
  if (result.upsertedCount)
    await User.updateOne({ _id: user._id }, { $inc: { views: 1 } });
  res.json({ ok: true });
});
app.get("/api/profiles/:username/connections", async (req, res) => {
  const user = await visibleProfile(
    String(req.params.username),
    req.session.userId,
  );
  const kind = z.enum(["followers", "following"]).parse(req.query.kind);
  const edges = await Edge.find({
    [kind === "followers" ? "to" : "from"]: user._id,
    kind: "follow",
  }).limit(100);
  const ids = edges.map((e) => (kind === "followers" ? e.from : e.to));
  res.json(
    (await User.find({ _id: { $in: ids }, visibility: "public" })).map(
      publicUser,
    ),
  );
});
app.put("/api/profiles/:username/:kind", async (req, res) => {
  const from = await current(req);
  const to = await visibleProfile(
    String(req.params.username),
    String(from._id),
  );
  const kind = z.enum(["follow", "kudos"]).parse(req.params.kind);
  const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
  if (String(from._id) === String(to._id))
    throw new HttpError(422, "You cannot follow or give kudos to yourself.");
  if (enabled)
    await Edge.updateOne(
      { from: from._id, to: to._id, kind },
      { $setOnInsert: { from: from._id, to: to._id, kind } },
      { upsert: true },
    );
  else await Edge.deleteOne({ from: from._id, to: to._id, kind });
  res.json({ ok: true });
});
app.get("/api/discover", async (req, res) => {
  const q = z.string().max(80).default("").parse(req.query.q).toLowerCase();
  const skill = z
    .string()
    .max(40)
    .default("")
    .parse(req.query.skill)
    .toLowerCase();
  const me = req.session.userId
    ? await User.findById(req.session.userId)
    : null;
  const mine =
    me?.visibility === "public" && me.discovery
      ? aggregate(await Repository.find({ owner: me._id }))
      : null;
  const users = await User.find({
    visibility: "public",
    discovery: true,
    ...(me ? { _id: { $ne: me._id } } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(200);
  const output = [];
  for (const user of users) {
    if (q && !`${user.username} ${user.displayName}`.toLowerCase().includes(q))
      continue;
    const stats = aggregate(await Repository.find({ owner: user._id }));
    if (skill && !stats.tags.some((t) => t.toLowerCase().includes(skill)))
      continue;
    output.push({
      user: publicUser(user),
      analytics: stats,
      match: mine ? similarity(mine, stats) : null,
      isFollowing: me
        ? !!(await Edge.exists({ from: me._id, to: user._id, kind: "follow" }))
        : false,
    });
  }
  res.json(
    output
      .sort((a, b) => (b.match?.score || 0) - (a.match?.score || 0))
      .slice(0, 30),
  );
});
app.use("/api", (_req, _res, next) =>
  next(new HttpError(404, "Endpoint not found.")),
);
app.use(
  (
    error: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof z.ZodError)
      return res.status(400).json({
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    if (error.code === 11000)
      return res
        .status(409)
        .json({ error: "That username or record already exists." });
    if (error.name === "CastError")
      return res.status(400).json({ error: "Invalid identifier." });
    if (error.type === "entity.parse.failed")
      return res.status(400).json({ error: "Invalid JSON body." });
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) console.error("Request failed:", error.name);
    res.status(status).json({
      error:
        status === 500
          ? "Something went wrong. Please try again."
          : error.message,
    });
  },
);
