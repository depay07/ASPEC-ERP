#!/bin/bash
# Run from an extracted, reviewed release: sudo bash install.sh
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
[ "$(id -u)" = 0 ] || { echo 'sudo bash install.sh 로 실행하세요.'; exit 1; }
mode=${1:-initial}
if [ "$mode" = '--update-only' ]; then
    # Upgrade an already running installation without replacing its storage or unit configuration.
    systemctl is-active --quiet aspec-cloud
    test -f /data/aspec-cloud/meta/cloud.sqlite
    grep -qx 'CLOUD_DATA_DIR=/data/aspec-cloud' /opt/aspec-cloud/config/cloud.env
elif [ "$mode" = 'initial' ]; then
    mountpoint -q /data/aspec-cloud
    [ "$(findmnt -n -o UUID --target /data/aspec-cloud)" = '8298dcea-322f-46a2-b83a-9669dcbce5bd' ] || { echo '저장 디스크 UUID 불일치'; exit 1; }
else
    echo '지원하지 않는 설치 옵션'; exit 1
fi
/usr/bin/node -e "if(process.versions.node.split('.')[0]!=='24')process.exit(1)"
getent passwd aspec-cloud >/dev/null
test -f /opt/aspec-cloud/config/cloud.env
/usr/bin/node --test test.mjs contracts.test.mjs
stamp=$(date +%Y%m%d-%H%M%S)
backup="/opt/aspec-cloud/releases/$stamp"
install -d -m 700 "$backup"
cp -a /opt/aspec-cloud/app "$backup/app"
cp -a /etc/nginx/sites-available/aspec-cloud "$backup/nginx.conf"
if [ -f /etc/systemd/system/aspec-cloud.service ]; then cp -a /etc/systemd/system/aspec-cloud.service "$backup/"; fi
if systemctl is-active --quiet aspec-cloud; then systemctl stop aspec-cloud; fi
if [ "$mode" = '--update-only' ]; then
    install -o root -g root -m 644 server.mjs contracts.mjs share-page.html /opt/aspec-cloud/app/
    systemctl start aspec-cloud
else
    install -o root -g root -m 644 server.mjs contracts.mjs share-page.html project.json package.json /opt/aspec-cloud/app/
    install -o root -g root -m 644 aspec-cloud.service /etc/systemd/system/aspec-cloud.service
    systemctl daemon-reload
    systemctl enable --now aspec-cloud
fi
curl --fail --retry 8 --retry-connrefused --retry-delay 1 http://127.0.0.1:3100/cloud/health
python3 - <<'PY'
from pathlib import Path
p=Path('/etc/nginx/sites-available/aspec-cloud')
s=p.read_text()
old='''    location / {
        default_type text/plain;
        return 200 "ASPEC Cloud API setup in progress\\n";
    }'''
new='''    # ASPEC authenticated API; data directories are never served by nginx.
    location /cloud/ {
        client_max_body_size 9m;
        client_body_timeout 120s;
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_request_buffering off;
        proxy_buffering off;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }
    location / { return 404; }'''
if '# ASPEC authenticated API;' in s:
    print('기존 API 프록시 설정 유지')
elif old in s:
    p.write_text(s.replace(old,new,1))
else:
    raise SystemExit('Nginx 설정 형식이 예상과 다릅니다. 수동 검토가 필요합니다. 기존 설정은 변경하지 않았습니다.')
# Only the short share namespace is public; keep the rest of the root at 404.
s=p.read_text()
if 'location /s/' not in s:
    marker='    location / { return 404; }'
    if marker not in s:
        raise SystemExit('짧은 공유 경로를 추가할 위치를 찾지 못했습니다.')
    s=s.replace(marker, '''    location /s/ {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;
        proxy_read_timeout 180s;
    }
''' + marker, 1)
    p.write_text(s)
s=p.read_text()
if 'location = /cloud/contracts {' not in s:
    marker='    location /cloud/ {'
    if marker not in s: raise SystemExit('계약서 목록 경로를 추가할 위치를 찾지 못했습니다.')
    s=s.replace(marker, '''    # Avoid nginx's automatic slash redirect on CORS preflight/POST requests.
    location = /cloud/contracts {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
''' + marker,1)
    p.write_text(s)
if 'location ^~ /cloud/contracts/' not in s:
    marker='    location /cloud/ {'
    if marker not in s: raise SystemExit('계약서 업로드 경로를 추가할 위치를 찾지 못했습니다.')
    s=s.replace(marker, '''    location ^~ /cloud/contracts/ {
        client_max_body_size 50m;
        client_body_timeout 120s;
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_request_buffering off;
        proxy_buffering off;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }
''' + marker,1)
    p.write_text(s)
if 'location = / {' not in s:
    marker='    location / { return 404; }'
    if marker not in s: raise SystemExit('코드 입력 화면 경로를 추가할 위치를 찾지 못했습니다.')
    s=s.replace(marker, '''    location = / {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
''' + marker,1)
    p.write_text(s)
PY
if ! nginx -t; then
    cp -a "$backup/nginx.conf" /etc/nginx/sites-available/aspec-cloud
    echo "Nginx 설정을 복원했습니다. 백업: $backup"
    exit 1
fi
systemctl reload nginx
echo "설치 완료. 변경 전 파일: $backup"
echo '확인: curl -i https://api.aspec-tech.co.kr/cloud/files (401 예상)'
