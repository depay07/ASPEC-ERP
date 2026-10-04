# FTP folder bridge

This optional worker mirrors the configured ERP owner's existing folder tree into `/home/aspecftp` every five seconds. Configure an In-Sight file path such as `1` or `CustomerA/Camera2` after creating that path in ERP and waiting for the next scan. Files stable for ten seconds are copied into the matching cloud folder. FTP originals remain.

Run `install-ftp-bridge.sh COMMIT_SHA` as root. It is intended for the existing ASPEC Ubuntu installation with `aspec-ftp-importer.service`, `/opt/aspec-cloud/ftp-importer/importer.mjs`, and `start-time`. It extracts the owner from the old importer; no user UUID is shipped in the worker. It backs up the previous service, importer, configuration, and SQLite database, then replaces only the importer service. The cloud API, authentication and FTP daemon configuration remain unchanged. Existing FTP directories receive group write/traverse permissions for the bridge. A failed installation leaves the importer stopped and prints its backup path.

Import history is independent of cloud entries and migrates the existing root importer's history. Deleting a cloud file does not import the unchanged FTP original again. Files with a new modification time are treated as new revisions; name conflicts receive a UUID suffix. Folder names must be valid single path components. Symbolic links are rejected. Only the configured owner's cloud folders are traversed. This is folder organization for a shared FTP account, not isolation between FTP customers.

Cloud folder renames create the new FTP path and retain the old directory. Old directories whose path no longer exists in the cloud are not scanned. To keep receiving new images after a rename, change the camera path too. Deleting a cloud folder does not delete its FTP originals. Recreating exactly the same path retains the old import history. The worker never creates cloud folders from arbitrary FTP directories.

Validation: `node --check ftp-bridge.mjs`, `bash -n install-ftp-bridge.sh`, `node ftp-bridge.test.mjs` (Node 24 with built-in SQLite). Tests use isolated temporary data only.

Rollback: stop `aspec-ftp-importer.service`, restore its unit file from the printed backup directory to `/etc/systemd/system/`, run `systemctl daemon-reload`, and start the service. The old `importer.mjs` is retained. Do not restore the database backup over newer production uploads without a deliberate data recovery plan.
