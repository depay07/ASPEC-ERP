# ASPEC Cloud

Node.js 24 built-ins only; no npm runtime dependencies. Supabase remains the ERP database and identity provider. This SQLite database stores only cloud folder/file/upload metadata. Binary files use opaque UUID names on the dedicated block volume. No public file directory exists.

## Initial deployment (existing Oracle VM)

Prerequisites already configured: Ubuntu, Node 24, Nginx TLS, TCP 80/443, non-login aspec-cloud user, /data/aspec-cloud mounted by UUID, and /opt/aspec-cloud/config/cloud.env mode 640 root:aspec-cloud.

Run `sudo bash install.sh` inside this directory. The installer checks the disk UUID, runs isolated API tests in a temporary directory, snapshots application/configuration files for rollback, installs the service, and updates only the aspec-cloud Nginx virtual host. It never edits RustDesk, Docker, Supabase, or existing ERP data. These local config snapshots are NOT a backup of business files.

`project.json` contains the existing PUBLIC Supabase URL and anon key copied from js/config.js. No service_role or signing secret is used. For another ERP project override SUPABASE_URL and SUPABASE_ANON_KEY on the server. Do not use a service_role key.

Environment:
```
NODE_ENV=production
HOST=127.0.0.1
PORT=3100
CLOUD_DATA_DIR=/data/aspec-cloud
CORS_ORIGIN=https://erp.aspec-tech.co.kr
SUPABASE_URL=https://gqttpmdpqotrkbdbstuu.supabase.co
ALLOWED_USER_IDS=03cd1d2d-9d0e-4ac4-a785-ad78e34168ef
```

Allow additional users by comma-separated UUIDs and restart only aspec-cloud. Each user's entries and upload sessions are isolated. Shared folders/cross-company access are intentionally not enabled; those require an explicit membership/role model. Do not expose the same storage to another ERP project by changing the project URL alone.

## API

All endpoints except minimal /cloud/health and CORS preflight require Bearer authentication. Downloads require a short-lived HttpOnly Secure SameSite=Strict cookie, scoped to /cloud/download/, issued after Bearer verification. The cookie identifies one file, is server-side bound to its owner, lasts 90 seconds and is revalidated against Supabase when a download starts. Download streams already started continue to completion. Restarting a download later requires clicking Download again. No tokens appear in URLs.

- GET /cloud/files?parent=UUID&q=term: folder listing or owner-wide substring search, max 1000 results (UI reports truncation)
- GET /cloud/storage: actual statfs total, used, free, pending reservations and upload-available bytes; 1 GiB safety reserve
- POST /cloud/folders: {name,parent}
- GET/PATCH/DELETE /cloud/entries/:id: info, rename/move, delete; PATCH {name?,parent?}
- POST /cloud/uploads: {name,parent,size}; returns resumable upload ID
- GET /cloud/uploads: unfinished uploads owned by current user
- GET/DELETE /cloud/uploads/:id: offset/info or cancel
- PATCH /cloud/uploads/:id: binary body <=8 MiB, Content-Length and Upload-Offset required
- POST /cloud/uploads/:id/complete: atomic finalize, idempotent retry
- POST /cloud/download-session: {id}; returns authenticated download path
- GET/HEAD /cloud/download/:id: streaming, single HTTP Range supported
- POST /cloud/logout: revoke download tickets for owner

Upload protocol is a small offset-based HTTP protocol, not tus. A single 5 GiB file is supported with bounded memory; browser uploads run sequentially to suit the 1 GiB VM. Browser remembers an upload ID keyed by owner, parent, name, size, modification timestamp and first/last 64 KiB SHA-256. To resume after closing browser/logging in again select the original file in the original folder in the same browser profile. This fingerprint detects common wrong-file selection but is not a full-file integrity hash. Network retries query the server offset before resending. Original source file must not be modified mid-upload. Failed uploads expire after 7 inactive days. Folder deletion is allowed only when empty (including uploads); no recursive destructive delete and no recycle bin.

Filename text is never used as a physical filesystem path. All file types including EXE, ZIP, code and HTML are stored as inert bytes and downloaded as attachment/application/octet-stream with nosniff. Uploaded files are never executed or rendered inline. No malware scanner is included. SQL is parameterized; UI filenames use textContent. Supabase verifies access tokens through /auth/v1/user (15-second bounded authentication cache); UUID allowlist adds authorization. CORS is exact-origin. Service runs non-root; files cannot be executed by the service sandbox. OS mount configuration uses nofail, while the API service requires the data mount, so a missing volume does not prevent RustDesk boot but prevents API startup.

## Validation before production frontend rollout

1. `systemctl status aspec-cloud --no-pager` and `journalctl -u aspec-cloud -n 40 --no-pager`.
2. HTTPS /cloud/health -> 200; /cloud/files without auth -> 401. Direct /files/foo -> 404.
3. Preview frontend from the exact allowed ERP origin or use an explicitly configured temporary HTTPS preview origin. Do not set wildcard CORS. Deploy frontend only after backend health/auth checks.
4. Existing ERP login, 30-minute inactivity logout, dashboard, quotes/orders/sales, partners/search, memos/Storage, public PO/trade statement links.
5. Cloud folder, multi-upload/drop, search, rename/move, empty-folder delete and rejection of nonempty delete. Use a second allowed user to verify isolation.
6. On actual VM/browser upload 2 GiB and 5 GiB files; interrupt network, resume, compare SHA-256 after downloading. Check RAM/RustDesk responsiveness and disk safety reserve. Local API tests do not establish WAN throughput or these large-file results.
7. Verify logout revokes download cookie, re-login restores pending upload UI, denied users cannot use API. Across ERP tabs existing ERP session logout remains in control; short-lived download tickets also expire.

## Rollback

Frontend: revert the cloud integration commit (preserving later unrelated changes). Backend: `sudo systemctl disable --now aspec-cloud`; restore the saved Nginx config from `/opt/aspec-cloud/releases/<timestamp>/nginx.conf`, validate with `sudo nginx -t`, then reload nginx. To roll back an upgrade, restore saved app/service files and restart aspec-cloud. Do not delete or reformat /data/aspec-cloud. Initial rollback does not remove certificates or firewall rules.

## Backups (proposal only, NOT enabled)

Dedicated volume is not a backup. Compare Oracle volume backups within the account's verified free allocation against encrypted copies on the user's PC/NAS or another independent storage provider. Any backup must cover files + metadata consistently (pause writes/checkpoint SQLite or stop the API during snapshot), include a restore test, and have a retention schedule approved by the owner. No backup job, cloud billing resource, or retention policy is installed by this release.
