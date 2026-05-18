"""
CORS helper: Starlette's CORSMiddleware with allow_origins=["*"] and allow_credentials=True
only reflects the request Origin on preflight and on simple responses when a Cookie is sent.
Browsers reject Access-Control-Allow-Origin: * together with Allow-Credentials: true on
normal responses. This subclass mirrors upstream Starlette behavior (reflect Origin whenever
wildcard origins and credentials are both enabled).
"""
from starlette.datastructures import Headers, MutableHeaders
from starlette.middleware.cors import CORSMiddleware
from starlette.types import Message, Send


class ReflectingWildcardCORSMiddleware(CORSMiddleware):
    async def send(self, message: Message, send: Send, request_headers: Headers) -> None:
        if message["type"] != "http.response.start":
            await send(message)
            return

        message.setdefault("headers", [])
        headers = MutableHeaders(scope=message)
        headers.update(self.simple_headers)
        origin = request_headers["Origin"]

        if self.allow_all_origins and self.allow_credentials:
            self.allow_explicit_origin(headers, origin)
        elif self.allow_all_origins and "cookie" in request_headers:
            self.allow_explicit_origin(headers, origin)
        elif not self.allow_all_origins and self.is_allowed_origin(origin=origin):
            self.allow_explicit_origin(headers, origin)

        await send(message)
