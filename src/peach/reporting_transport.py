"""复用固定版 Sentry HTTP 传输，记录有界传输结果并阻止测试外发。"""
from __future__ import annotations

import os
import threading
from types import SimpleNamespace

from .peach_proxy import http_client


def transport_class(gate, callback):
    from sentry_sdk.transport import HttpTransport

    class ReportingTransport(HttpTransport):
        TIMEOUT = 5

        def __init__(self, options):
            self._delivery_context = threading.local()
            super().__init__(options)

        def _context(self, envelope):
            event = next((item.get_event() for item in envelope.items if item.get_event() is not None), None)
            if event is None:
                # 日志与会话汇总的同意凭据和回执编号在信封头；闸门移除前先取出。
                permit = envelope.headers.get("peach_permit", {})
                self._delivery_context.permit = permit
                self._delivery_context.event_id = permit.get("receipt") if isinstance(permit, dict) else None
                return
            self._delivery_context.permit = event.get("extra", {})
            self._delivery_context.event_id = event.get("event_id")

        def capture_envelope(self, envelope):
            self._context(envelope)
            self._delivery_context.queue_full = False
            super().capture_envelope(envelope)
            return not self._delivery_context.queue_full

        def _notify(self, status, reason=None, status_code=None):
            result = {"status": status}
            if reason:
                result["reason"] = reason
            if type(status_code) is int:
                result["status_code"] = status_code
            try:
                if callback is not None:
                    callback(result)
                else:
                    from .reporting_delivery import record
                    record(getattr(self._delivery_context, "permit", {}),
                           getattr(self._delivery_context, "event_id", None), result)
            except Exception:
                pass

        def _request(self, method, endpoint_type, body, headers):
            if os.environ.get("PEACH_REPORTING_TEST_MODE") == "1":
                raise OSError("remote diagnostics are disabled in test processes")
            with http_client(timeout=self.TIMEOUT, follow_redirects=False) as client:
                response = client.request(method, self._auth.get_api_url(endpoint_type),
                                          content=body, headers=headers)
            return SimpleNamespace(status=response.status_code, headers=response.headers,
                                   data=response.content, close=response.close)

        def _send_envelope(self, envelope):
            self._context(envelope)
            if not gate(envelope):
                self._notify("blocked", "consent")
                return
            retry = getattr(envelope, "peach_retry_on_limit", None)
            # SDK 会静默跳过限流的 log 条目。计数信封只含日志，可以确认这一批完全未发出。
            if retry is not None and all(self._check_disabled(item.data_category) for item in envelope.items):
                self._notify("failed", "rate_limit")
                retry()
                return
            self._outcome = False
            self._delivery_context.rate_limited = False
            try:
                super()._send_envelope(envelope)
            except Exception:
                if not self._outcome:
                    self._notify("unknown", "network")
                raise
            if not self._outcome:
                self._notify("unknown", "unknown")
            if self._delivery_context.rate_limited and retry is not None:
                retry()

        def _handle_response(self, response, envelope):
            super()._handle_response(response, envelope)
            self._outcome = True
            status = response.status
            if 200 <= status < 300:
                limited = bool(response.headers.get("x-sentry-rate-limits"))
                self._notify("unknown" if limited else "accepted", "rate_limit" if limited else None, status)
            else:
                self._notify("failed", "rate_limit" if status == 429 else "http_status", status)
                self._delivery_context.rate_limited = status == 429

        def _handle_request_error(self, envelope, loss_reason="network", record_reason="network_error"):
            super()._handle_request_error(envelope, loss_reason, record_reason)
            if loss_reason == "network":
                self._outcome = True
                self._notify("unknown", "network")

        def on_dropped_event(self, reason):
            super().on_dropped_event(reason)
            if reason in {"full_queue", "self_rate_limits"}:
                if reason == "self_rate_limits":
                    self._outcome = True
                    self._delivery_context.rate_limited = True
                else:
                    self._delivery_context.queue_full = True
                self._notify("failed", "queue_full" if reason == "full_queue" else "rate_limit")

    return ReportingTransport
