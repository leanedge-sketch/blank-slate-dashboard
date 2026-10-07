import unittest

from starlette.datastructures import Headers, MutableHeaders
from starlette.types import Message

from app.cors_relaxed import ReflectingWildcardCORSMiddleware


class CorsRelaxedTest(unittest.IsolatedAsyncioTestCase):
    async def test_send_without_origin_does_not_crash(self) -> None:
        middleware = ReflectingWildcardCORSMiddleware(
            app=None,  # type: ignore[arg-type]
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        sent: list[Message] = []

        async def send(message: Message) -> None:
            sent.append(message)

        message: Message = {"type": "http.response.start", "status": 200, "headers": []}
        await middleware.send(message, send, Headers())
        self.assertEqual(len(sent), 1)
        self.assertEqual(sent[0]["status"], 200)

    async def test_send_with_origin_reflects_header(self) -> None:
        middleware = ReflectingWildcardCORSMiddleware(
            app=None,  # type: ignore[arg-type]
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        sent: list[Message] = []

        async def send(message: Message) -> None:
            sent.append(message)

        message: Message = {"type": "http.response.start", "status": 200, "headers": []}
        await middleware.send(
            message,
            send,
            Headers({"origin": "https://blank-slate-dashboard-plum.vercel.app"}),
        )
        headers = MutableHeaders(scope=sent[0])
        self.assertEqual(
            headers["access-control-allow-origin"],
            "https://blank-slate-dashboard-plum.vercel.app",
        )
