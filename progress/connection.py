"""Transactional asyncpg connections, including Neon over TLS WebSockets."""
from __future__ import annotations

import asyncio
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
import aiohttp
import asyncpg


class NeonConnection:
    def __init__(self, connection, server, session, tasks):
        self.connection, self.server, self.session, self.tasks = connection, server, session, tasks

    def __getattr__(self, name):
        return getattr(self.connection, name)

    async def close(self):
        try:
            try:
                await self.connection.close(timeout=5)
            except Exception:
                self.connection.terminate()
        finally:
            self.server.close()
            await self.server.wait_closed()
            for task in list(self.tasks):
                task.cancel()
            await asyncio.gather(*list(self.tasks), return_exceptions=True)
            await self.session.close()


async def connect(dsn: str, *, timeout: float = 10, statement_cache_size: int = 0):
    parsed = urlsplit(dsn)
    hostname = parsed.hostname or ""
    if not hostname.endswith(".neon.tech"):
        return await asyncpg.connect(dsn, timeout=timeout, statement_cache_size=statement_cache_size)
    # Same proxy endpoint used by Neon's official serverless driver. All remote
    # traffic is TLS-protected WSS; plaintext Postgres is confined to loopback.
    remote = f"wss://{hostname}/v2?" + urlencode({"address": f"{hostname}:{parsed.port or 5432}"})
    session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=None, connect=timeout))
    tasks = set()
    accepted = False

    async def bridge(reader, writer):
        nonlocal accepted
        if accepted:
            writer.close()
            return
        accepted = True
        task = asyncio.current_task()
        tasks.add(task)
        try:
            async with session.ws_connect(remote, max_msg_size=0) as socket:
                async def upstream():
                    while data := await reader.read(65536):
                        await socket.send_bytes(data)
                async def downstream():
                    async for message in socket:
                        if message.type == aiohttp.WSMsgType.BINARY:
                            writer.write(message.data)
                            await writer.drain()
                        elif message.type in {aiohttp.WSMsgType.ERROR, aiohttp.WSMsgType.CLOSE}:
                            break
                forwarding = [asyncio.create_task(upstream()), asyncio.create_task(downstream())]
                try:
                    await asyncio.wait(forwarding, return_when=asyncio.FIRST_COMPLETED)
                finally:
                    for pending in forwarding:
                        pending.cancel()
                    await asyncio.gather(*forwarding, return_exceptions=True)
        except (aiohttp.ClientError, OSError):
            pass  # asyncpg reports the failed connection; never log credentials.
        finally:
            writer.close()
            try:
                await writer.wait_closed()
            except OSError:
                pass
            finally:
                tasks.discard(task)

    server = await asyncio.start_server(bridge, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    userinfo = parsed.netloc.rsplit("@", 1)[0]
    query = [(k, v) for k, v in parse_qsl(parsed.query) if k not in {
        "sslmode", "channel_binding", "sslcert", "sslkey", "sslrootcert",
    }]
    local_dsn = urlunsplit((parsed.scheme, f"{userinfo}@127.0.0.1:{port}", parsed.path, urlencode(query), ""))
    try:
        connection = await asyncpg.connect(local_dsn, ssl=False, timeout=timeout,
                                          statement_cache_size=statement_cache_size)
        return NeonConnection(connection, server, session, tasks)
    except BaseException:
        server.close()
        await server.wait_closed()
        for task in list(tasks):
            task.cancel()
        await asyncio.gather(*list(tasks), return_exceptions=True)
        await session.close()
        raise
