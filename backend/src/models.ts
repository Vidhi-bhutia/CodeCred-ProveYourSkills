import mongoose, { Schema } from "mongoose";
const userSchema = new Schema(
  {
    githubId: { type: String, required: true, unique: true },
    githubLogin: { type: String, required: true },
    token: { type: String, select: false },
    connected: { type: Boolean, default: true },
    username: { type: String, required: true, unique: true, lowercase: true },
    displayName: { type: String, required: true },
    avatar: String,
    bio: { type: String, default: "" },
    location: { type: String, default: "" },
    portfolio: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    website: { type: String, default: "" },
    interests: { type: String, default: "" },
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "private",
    },
    discovery: { type: Boolean, default: false },
    onboarded: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
    analyticsVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);
userSchema.index({ visibility: 1, discovery: 1, username: 1 });
export const User = mongoose.model("User", userSchema);
const repositorySchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    githubId: { type: Number, required: true },
    name: String,
    fullName: String,
    description: String,
    url: String,
    language: String,
    stars: Number,
    forks: Number,
    archived: Boolean,
    fork: Boolean,
    updatedAtGithub: Date,
    pinned: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    featuredOrder: { type: Number, default: 0 },
    eligible: { type: Boolean, default: true },
    seenRun: String,
    processedRun: String,
    pushedAtGithub: Date,
    analyzedPushedAt: Date,
    analysisVersion: Number,
    activity: Schema.Types.Mixed,
    activitySyncedAt: Date,
    status: { type: String, default: "pending" },
    error: String,
    loc: { type: Number, default: null },
    languages: { type: Map, of: Number },
    tags: [String],
    analyzedFiles: Number,
    excludedFiles: Number,
    syncedAt: Date,
    analyzedSha: String,
  },
  { timestamps: true },
);
repositorySchema.index({ owner: 1, githubId: 1 }, { unique: true });
export const Repository = mongoose.model("Repository", repositorySchema);
const syncJobSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      ref: "User",
    },
    state: { type: String, default: "queued" },
    phase: { type: String, default: "discovering" },
    run: { type: String, required: true },
    page: { type: Number, default: 1 },
    discovered: { type: Number, default: 0 },
    analyzed: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    processed: { type: Number, default: 0 },
    lease: String,
    leaseUntil: Date,
    retryAt: Date,
    attempts: { type: Number, default: 0 },
    error: String,
    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true },
);
syncJobSchema.index({ state: 1, retryAt: 1, leaseUntil: 1 });
export const SyncJob = mongoose.model("SyncJob", syncJobSchema);
const edgeSchema = new Schema(
  {
    from: { type: Schema.Types.ObjectId, required: true },
    to: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ["follow", "kudos"], required: true },
  },
  { timestamps: true },
);
edgeSchema.index({ from: 1, to: 1, kind: 1 }, { unique: true });
edgeSchema.index({ to: 1, kind: 1 });
export const Edge = mongoose.model("Edge", edgeSchema);
const viewSchema = new Schema({
  target: { type: Schema.Types.ObjectId, required: true },
  visitor: { type: String, required: true },
  expires: { type: Date, required: true },
});
viewSchema.index({ target: 1, visitor: 1 }, { unique: true });
viewSchema.index({ expires: 1 }, { expireAfterSeconds: 0 });
export const ProfileView = mongoose.model("ProfileView", viewSchema);
