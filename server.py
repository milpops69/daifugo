#!/usr/bin/env python3
"""
DaiFugo — единый сервер на одном порту.
  • HTTP   →  /  (статические файлы)
  • WS     →  /ws (мультиплеер)
  • Локально:    python server.py   → порт 8000
  • На хостинге: берёт порт из env PORT (Render / Railway / Fly.io / Heroku)
"""
import os, sys, json, random, string, asyncio, socket, mimetypes, webbrowser
from pathlib import Path

PORT = int(os.environ.get("PORT", 8000))
ROOT = Path(__file__).parent.resolve()
IS_CLOUD = "PORT" in os.environ

try:
    import websockets
    try:
        from websockets.legacy.server import serve as ws_serve
    except ImportError:
        from websockets import serve as ws_serve
except ImportError:
    print("=" * 60)
    print("Установите websockets: pip install websockets")
    print("=" * 60)
    sys.exit(1)


def get_lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


# ── Игровое состояние ────────────────────────────────────
rooms   = {}   # code -> {host, guest, host_profile, guest_profile}
clients = {}   # ws   -> {room, seat}


def gen_code():
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        if code not in rooms:
            return code


async def tx(ws, obj):
    try:
        await ws.send(json.dumps(obj))
    except Exception:
        pass


async def ws_handler(ws, path=None):
    clients[ws] = {}
    try:
        async for raw in ws:
            m = json.loads(raw)
            t = m.get("type")

            if t == "create":
                code = gen_code()
                rooms[code] = {
                    "host": ws, "guest": None,
                    "host_profile": m.get("profile") or {},
                    "guest_profile": None,
                }
                clients[ws] = {"room": code, "seat": 0}
                await tx(ws, {"type": "created", "code": code})

            elif t == "join":
                code = m.get("code", "").upper().strip()
                r = rooms.get(code)
                if not r:
                    await tx(ws, {"type": "error", "msg": "Комната не найдена"})
                elif r["guest"] is not None:
                    await tx(ws, {"type": "error", "msg": "Комната заполнена"})
                else:
                    r["guest"] = ws
                    r["guest_profile"] = m.get("profile") or {}
                    clients[ws] = {"room": code, "seat": 1}
                    await tx(ws, {"type": "joined", "code": code,
                                  "host_profile": r["host_profile"]})
                    await tx(r["host"], {"type": "guest_joined",
                                         "profile": r["guest_profile"]})

            elif t == "relay":
                info = clients.get(ws, {})
                code = info.get("room")
                r = rooms.get(code)
                if not r:
                    continue
                seat = info.get("seat", 0)
                dest = r["guest"] if seat == 0 else r["host"]
                if dest:
                    await tx(dest, {"type": "relay", "seat": seat,
                                    "data": m.get("data")})
    except websockets.ConnectionClosed:
        pass
    finally:
        info = clients.pop(ws, {})
        code = info.get("room")
        if code and code in rooms:
            r = rooms[code]
            if r["host"] == ws:
                if r["guest"]:
                    await tx(r["guest"], {"type": "opponent_left"})
                del rooms[code]
            elif r["guest"] == ws:
                r["guest"] = None
                if r["host"]:
                    await tx(r["host"], {"type": "opponent_left"})


# ── HTTP-обработчик (для не-WS запросов) ─────────────────
def http_response(status, body, content_type="text/plain; charset=utf-8",
                  extra=None):
    if isinstance(body, str):
        body = body.encode("utf-8")
    headers = [
        ("Content-Type", content_type),
        ("Content-Length", str(len(body))),
        ("Cache-Control", "no-cache"),
        ("Access-Control-Allow-Origin", "*"),
    ]
    if extra:
        headers.extend(extra)
    return (status, headers, body)


async def process_request(path, request_headers):
    upgrade = request_headers.get("Upgrade", "") or ""
    # WebSocket upgrade — пропускаем дальше в ws_handler
    if upgrade.lower() == "websocket":
        if path.startswith("/ws"):
            return None
        return http_response(404, "WebSocket доступен только на /ws")

    # Обычный HTTP
    clean = path.split("?", 1)[0]
    if clean == "/lan-ip":
        return http_response(200, json.dumps({"ip": get_lan_ip(), "port": PORT}),
                             "application/json; charset=utf-8")

    rel = clean.lstrip("/") or "index.html"
    fp = (ROOT / rel).resolve()
    try:
        fp.relative_to(ROOT)
    except ValueError:
        return http_response(403, "Forbidden")
    if not fp.is_file():
        return http_response(404, f"Not found: {clean}")
    mime, _ = mimetypes.guess_type(str(fp))
    return http_response(200, fp.read_bytes(),
                         mime or "application/octet-stream")


# ── Запуск ───────────────────────────────────────────────
async def main():
    async with ws_serve(ws_handler, "0.0.0.0", PORT,
                        process_request=process_request):
        if IS_CLOUD:
            print(f"✅  DaiFugo (cloud) — порт {PORT}")
        else:
            url = f"http://localhost:{PORT}"
            lan = get_lan_ip()
            print(f"✅  DaiFugo:        {url}")
            print(f"🌐  Локальная сеть: http://{lan}:{PORT}")
            print( "    Ctrl+C для остановки.\n")
            try:
                webbrowser.open(url)
            except Exception:
                pass
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⛔  Сервер остановлен.")
