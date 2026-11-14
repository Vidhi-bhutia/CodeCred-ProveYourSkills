# CodeCred

Developer identity backed by explicitly selected public GitHub projects. The existing `frontend/` and `backend/` folders contain separate applications.

## Local setup

Requires Node.js 22+ and MongoDB 7+ (local or Atlas).

```sh
npm install
npm install --prefix frontend
npm install --prefix backend
```

Copy `backend/.env.example` to `backend/.env`. Fill in MongoDB and GitHub OAuth credentials. Generate two independent secrets with this command (run it once for SESSION_SECRET and once for TOKEN_ENCRYPTION_KEY):

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

In GitHub Settings → Developer settings → OAuth Apps, create an app with homepage `http://localhost:5173` and callback `http://localhost:4000/api/auth/github/callback`. Place its client ID and secret in **backend/.env only**. The app requests `read:user user:email`, never private repository access. Email is not retained.

```sh
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api` to port 4000. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`. You can also run the dev script separately in each folder.

Without configuration, the landing page works and `/api/health` reports readiness. Protected routes return a setup error. There is no mock login, fabricated analytics, or seeded user data.

## Implemented flows

- GitHub authorization-code OAuth: expiring state validation, regenerated sessions, HTTP-only cookies, encrypted tokens, stable GitHub identity and logout.
- Onboarding and profile editing: unique username, GitHub avatar, bio, location, interests, optional links. Private profiles and discovery-off are the defaults.
- `/u/username` profiles; private profiles are owner-only. Additional authorized private viewers are not supported yet.
- Paginated public repository selection, search over loaded pages, explicit import confirmation, pin/unpin, removal and manual refresh. Three imports per request; twenty selected repositories per account.
- Real repository language/line analysis, supported technology evidence, timestamps, synchronization errors and evidence badges.
- Public opted-in discovery, name/username and technology filtering, weighted similarities, follow/unfollow, kudos and public connection lists.
- Daily deduplicated profile views excluding self-visits; disconnect with a data-retention choice; reconnect; account deletion.
- Responsive light interface with loading, empty, error and success states.

## Measurement

### Atlas DNS troubleshooting

If startup fails with `querySrv ECONNREFUSED` or `ETIMEOUT`, Node cannot resolve Atlas's DNS SRV record. This happens before database authentication. On this Windows machine, Node used an unavailable resolver at `127.0.0.1` while an explicit resolver succeeded.

Set `DNS_SERVERS=1.1.1.1,8.8.8.8` in `backend/.env` and restart the backend. This only changes DNS for the backend process; it does not change Windows settings. Use your network's approved resolver addresses on managed networks. Alternatively, obtain the complete non-SRV connection string from Atlas's Connect dialog; do not guess hostnames or drop TLS/replica-set options. If DNS works but the connection still fails, check cluster availability, your current IP in Atlas Network Access, and database credentials.

**Repository size is not personal authorship.** LOC means physical non-blank source lines, including comments. Language percentages use those same counts, not GitHub language bytes. Analysis pins the current branch commit before reading its tree and blobs. Source is processed transiently in memory and is not stored.

Supported extensions are defined in `backend/src/analytics.ts`. Common dependency, generated, vendored and build folders, declarations, lockfiles, binary contents, minified names, generated-file headers and very long source lines are excluded. These are documented heuristics, not perfect Linguist classification. Forks and archived projects are labeled; their codebase is never claimed as original personal work.

Analysis is bounded to 350 eligible files, 500 KB per file, and 8 MB total. Truncated trees and oversized repositories fail without publishing partial figures. Requests are sequential with timeouts and upstream error handling. Empty repositories have zero lines. Interrupted analyses are marked for retry on startup. A five-minute successful-sync cooldown limits refreshes.

Language tags require 20 eligible lines. React requires JSX/TSX implementation with a React import/reference and ten lines. Django and Express require implementation imports and ten lines. README mentions do not award tags. Project cards expose supporting language lines.

Similarity: 65% cosine similarity of normalized language LOC, 25% Jaccard evidence-tag overlap, 10% language-count diversity similarity. It is calculated only when the requesting account is public and opted in. Total LOC is not used as a skill ranking. Search scans the newest 200 eligible profiles and returns up to 30; indexed, paginated discovery is future scaling work.

Badge rules: first successful analysis; at least 100 lines in each of three languages; five successfully analyzed projects. Badges describe repository evidence rather than expertise or personal authorship.

**Unavailable:** personal additions/deletions, personal commits, PRs, issues, external contributions, collaboration attribution, contribution calendars and trend graphs. The UI labels personal contribution metrics unavailable instead of substituting repository-wide activity.

## Security and data

MongoDB models store users/preferences/encrypted tokens, repository metadata/analytics/tags, follow/kudos edges, and expiring hashed view records. Badges and matches are derived. Unique indexes protect GitHub identity, username, selected repository identity, social edges and view deduplication. Sessions use MongoDB with a seven-day expiry.

Tokens use AES-256-GCM with random IVs and an independent encryption key. The API uses Helmet, exact frontend CORS, Origin validation on mutations, Zod input validation, JSON limits, rate limiting and ownership checks. Private profiles return the same 404 as nonexistent profiles. Discovery requires public visibility and explicit opt-in on every request. Connection lists omit private profiles.

View deduplication uses a daily HMAC of authenticated identity or network address; raw addresses are not stored in view records. Shared networks can undercount anonymous views. Visitor identities are never exposed. View records expire after one day.

Disconnect deletes the local token. Revoke the OAuth grant separately in GitHub Settings → Applications if desired. Account deletion removes profile, analytics, relationships and target view records. Other existing sessions contain an unusable deleted user ID and expire naturally.

## Validation

```sh
npm run build
npm test
```

Tests cover line counting, excluded paths, aggregate integrity, badge evidence, similarity, and HTTP readiness/security behavior without credentials. Builds type-check both applications.

Additional tests verify token encryption/tamper detection, commit-pinned GitHub analysis, generated-source exclusion, framework evidence, and refusal to publish truncated analytics. GitHub responses in these tests are mocked; live authentication and MongoDB acceptance checks remain separate.

The frontend uses Rollup's official WebAssembly package through an npm alias/override because Windows Application Control blocked its native binary on the development machine. This keeps builds portable without changing OS security settings.

Authenticated acceptance checklist after configuration:

1. Sign in and onboard. Confirm private/off defaults and check private profile denial from another browser.
2. Import a small public project. Compare its metadata and eligible lines with GitHub. Confirm unselected projects never appear.
3. Pin, refresh and remove projects; verify aggregates update. Test oversized/empty/fork repositories and GitHub errors.
4. With two public opted-in accounts, search, compare matches, follow/unfollow, give/remove kudos and inspect public connections.
5. Opt out or make a profile private; verify discovery and public endpoints reflect the change immediately.
6. Visit a public profile and refresh; verify daily deduplication and exclusion of self-visits.
7. Test disconnect with retention/deletion, reconnect, externally revoked authorization, logout and account deletion.

## Deployment

Build `frontend/dist` for static hosting with an SPA fallback to `index.html`. Run `backend/dist/server.js` on a Node host with MongoDB access. Set `VITE_API_URL` before building if changing `/api`. Use a same-site frontend/API arrangement; a shared domain reverse-proxying `/api` is simplest. Cross-site domains require a deliberate cookie and CSRF redesign.

Set production `FRONTEND_URL`, `GITHUB_CALLBACK_URL`, `NODE_ENV=production` and strong secrets. Update the GitHub OAuth callback. Terminate HTTPS at a trusted proxy, strip client-supplied forwarded headers, and allow one proxy hop. Secure cookies require HTTPS. Keep encryption keys stable and backed up; changing the key requires reconnecting accounts or re-encrypting tokens.

Use a single API process: the current import lock is process-local. Before multi-instance production, add a durable worker queue, distributed locking, cached conditional GitHub requests and observability, and run the authenticated acceptance checklist. Review database indexes as migrations if disabling Mongoose auto-indexing. No hosted deployment or external credential provisioning is included.
