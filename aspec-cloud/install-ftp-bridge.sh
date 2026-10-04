#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) -eq 0 ]] || { echo 'sudo로 실행하세요.'; exit 1; }
ref=${1:?검증된 커밋 SHA를 지정하세요}
[[ $ref =~ ^[0-9a-f]{40}$ ]] || exit 1
base=/opt/aspec-cloud/ftp-importer
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
curl --fail --silent --show-error --location "https://raw.githubusercontent.com/depay07/ASPEC-ERP/$ref/aspec-cloud/ftp-bridge.mjs" -o "$stage/ftp-bridge.mjs"
/usr/bin/node --check "$stage/ftp-bridge.mjs"
/usr/bin/node --input-type=module -e "import {DatabaseSync} from 'node:sqlite';"
mountpoint -q /data/aspec-cloud
getent passwd aspec-cloud >/dev/null
getent group aspecftp >/dev/null
[[ -d /home/aspecftp && ! -L /home/aspecftp ]]
backup="$base/backup-$(date +%Y%m%d-%H%M%S)"
install -d -m 700 "$backup"
cp -a /etc/systemd/system/aspec-ftp-importer.service "$backup/"
cp -a "$base/importer.mjs" "$backup/"
if [[ -f "$base/bridge-config.json" ]]; then cp -a "$base/bridge-config.json" "$backup/"; fi
if [[ -f "$base/ftp-bridge.mjs" ]]; then cp -a "$base/ftp-bridge.mjs" "$backup/"; fi
systemctl stop aspec-ftp-importer.service
trap 'echo "설치 실패. 백업 위치: '"$backup"' — 서비스를 중지한 상태로 유지합니다."; rm -rf "$stage"' ERR
python3 - "$base" "$backup" <<'PY'
import pathlib, re, json, sqlite3, sys
base, backup = map(pathlib.Path, sys.argv[1:])
config_file = base / 'bridge-config.json'
if config_file.exists():
    config = json.loads(config_file.read_text())
else:
    src = (base / 'importer.mjs').read_text()
    match = re.search(r"const OWNER\s*=\s*['\"]([a-f0-9-]{36})['\"]", src)
    if not match: raise SystemExit('기존 OWNER를 확인할 수 없어 중지합니다.')
    config = dict(ftpDir='/home/aspecftp', dataDir='/data/aspec-cloud', owner=match[1],
                  startTime=float((base/'start-time').read_text().strip()) * 1000)
assert config['ftpDir'] == '/home/aspecftp' and config['dataDir'] == '/data/aspec-cloud'
db = sqlite3.connect('/data/aspec-cloud/meta/cloud.sqlite', timeout=30)
dst = sqlite3.connect(str(backup/'cloud.sqlite'))
db.backup(dst)
dst.close()
assert db.execute("SELECT 1 FROM sqlite_master WHERE name='entries'").fetchone()
db.close()
config_file.write_text(json.dumps(config, indent=2))
config_file.chmod(0o644)
PY
usermod -aG aspecftp aspec-cloud
# FTP용 폴더에만 그룹 쓰기/접근 권한을 부여합니다. 파일 내용은 변경하지 않습니다.
find /home/aspecftp -type d -exec chgrp aspecftp {} +
find /home/aspecftp -type d -exec chmod g+rwx,g+s {} +
install -o root -g root -m 644 "$stage/ftp-bridge.mjs" "$base/ftp-bridge.mjs"
cat > /etc/systemd/system/aspec-ftp-importer.service <<'EOF'
[Unit]
Description=ASPEC FTP Cloud Folder Bridge
After=aspec-cloud.service
RequiresMountsFor=/data/aspec-cloud /home/aspecftp
ConditionPathIsMountPoint=/data/aspec-cloud

[Service]
Type=simple
User=aspec-cloud
Group=aspecftp
WorkingDirectory=/opt/aspec-cloud/ftp-importer
ExecStart=/usr/bin/node /opt/aspec-cloud/ftp-importer/ftp-bridge.mjs /opt/aspec-cloud/ftp-importer/bridge-config.json
Restart=always
RestartSec=5
UMask=0007
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/data/aspec-cloud /home/aspecftp

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now aspec-ftp-importer.service
systemctl is-active --quiet aspec-ftp-importer.service
echo "설치 완료. 백업: $backup"
echo 'ERP에서 폴더를 만든 뒤 약 5초 후 In-Sight에서 같은 경로로 전송하세요.'
journalctl -u aspec-ftp-importer.service -n 8 --no-pager
