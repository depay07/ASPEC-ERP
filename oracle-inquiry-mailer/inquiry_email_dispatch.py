"""Deliver ERP website inquiries with the existing ASPEC SMTP account."""
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

from aspec_email_alert import load_env, send_email


ENDPOINT = "https://gqttpmdpqotrkbdbstuu.supabase.co/functions/v1/website-inquiry-mail-queue"


def call_queue(payload):
    token = os.getenv("ASPEC_INQUIRY_QUEUE_TOKEN", "")
    if not token:
        raise RuntimeError("ASPEC_INQUIRY_QUEUE_TOKEN is not configured")
    request = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "ASPEC-Oracle-Inquiry-Mailer/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        result = json.loads(response.read().decode("utf-8"))
    if result.get("ok") is not True:
        raise RuntimeError(f"queue API rejected request: {result}")
    return result


def format_received(value):
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.astimezone(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d %H:%M:%S KST")
    except (TypeError, ValueError):
        return value or "확인 불가"


def mail_content(inquiry):
    inquiry_id = inquiry["id"]
    source_page = (inquiry.get("source_page") or "").lower()
    inquiry_type = inquiry.get("inquiry_type") or "간단 문의"
    is_sangjin = "sangjin-fa.com" in source_page or inquiry_type.startswith("SANGJIN -")
    brand = "SANGJIN" if is_sangjin else "ASPEC"
    subject = f"[{brand} 홈페이지 문의] {inquiry_type} ({inquiry_id[:8].upper()})"
    body = "\n".join([
        f"{brand} 홈페이지에 새로운 문의가 접수되었습니다.",
        "",
        f"접수번호: {inquiry_id}",
        f"접수시각: {format_received(inquiry.get('created_at'))}",
        f"문의유형: {inquiry_type}",
        f"연락처: {inquiry.get('contact') or '미입력'}",
        f"접수페이지: {inquiry.get('source_page') or '확인 불가'}",
        "",
        "[문의 원문]",
        inquiry.get("message") or "",
        "",
        "ERP 홈페이지 문의함에서도 처리 상태와 원문을 확인할 수 있습니다.",
        "https://erp.aspec-tech.co.kr/erp.html",
    ])
    return subject, body


def main():
    load_env()
    inquiries = call_queue({"action": "pull"}).get("inquiries", [])
    if not inquiries:
        print("미발송 홈페이지 문의 없음", flush=True)
        return 0

    failures = 0
    for inquiry in inquiries:
        attempts = int(inquiry.get("notification_attempts") or 0) + 1
        try:
            subject, body = mail_content(inquiry)
            send_email(subject, body)
            call_queue({"action": "sent", "id": inquiry["id"], "attempts": attempts})
            print("문의 이메일 전송 성공:", inquiry["id"], flush=True)
        except Exception as error:
            failures += 1
            detail = f"{type(error).__name__}: {error}"
            print("문의 이메일 전송 실패:", inquiry.get("id"), detail, flush=True)
            try:
                call_queue({"action": "failed", "id": inquiry["id"], "attempts": attempts, "error": detail})
            except Exception as update_error:
                print("실패 상태 기록도 실패:", update_error, flush=True)

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())

