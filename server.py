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

# Чтобы Render отдавал .woff2 с правильным MIME-типом
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("font/woff",  ".woff")

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
# rooms[code] = {
#   "max":   int,                 # 2..4
#   "players": [{ws, profile, seat}, ...],
#   "started": bool,
# }
rooms   = {}
clients = {}   # ws -> {room, seat}


def gen_code():
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        if code not in rooms:
            return code


async def tx(ws, obj):
    if ws is None:
        return
    try:
        await ws.send(json.dumps(obj))
    except Exception:
        pass


async def broadcast(room, obj, exclude=None):
    for p in room["players"]:
        if p["ws"] is exclude:
            continue
        await tx(p["ws"], obj)


def roster(room):
    """Список профилей игроков в комнате (для лобби)."""
    return [{"seat": p["seat"], "name": p["profile"].get("name", ""),
             "avatar": p["profile"].get("avatar", 0)} for p in room["players"]]


async def send_lobby_update(room):
    msg = {"type": "lobby_update", "players": roster(room),
           "max": room["max"]}
    await broadcast(room, msg)


async def ws_handler(ws, path=None):
    clients[ws] = {}
    try:
        async for raw in ws:
            m = json.loads(raw)
            t = m.get("type")

            if t == "create":
                max_p = int(m.get("max_players") or 4)
                if max_p < 2 or max_p > 4:
                    max_p = 4
                code = gen_code()
                rooms[code] = {
                    "max": max_p,
                    "players": [{"ws": ws, "profile": m.get("profile") or {},
                                 "seat": 0}],
                    "started": False,
                }
                clients[ws] = {"room": code, "seat": 0}
                await tx(ws, {"type": "created", "code": code,
                              "max": max_p, "seat": 0})
                await send_lobby_update(rooms[code])

            elif t == "join":
                code = (m.get("code") or "").upper().strip()
                r = rooms.get(code)
                if not r:
                    await tx(ws, {"type": "error", "msg": "Комната не найдена"})
                elif r["started"]:
                    await tx(ws, {"type": "error", "msg": "Игра уже идёт"})
                elif len(r["players"]) >= r["max"]:
                    await tx(ws, {"type": "error", "msg": "Комната заполнена"})
                else:
                    seat = len(r["players"])
                    r["players"].append({"ws": ws,
                                         "profile": m.get("profile") or {},
                                         "seat": seat})
                    clients[ws] = {"room": code, "seat": seat}
                    await tx(ws, {"type": "joined", "code": code,
                                  "max": r["max"], "seat": seat,
                                  "players": roster(r)})
                    await send_lobby_update(r)
                    if len(r["players"]) >= r["max"]:
                        r["started"] = True
                        await broadcast(r, {"type": "start",
                                            "players": roster(r),
                                            "max": r["max"]})

            elif t == "relay":
                info = clients.get(ws, {})
                code = info.get("room")
                r = rooms.get(code)
                if not r:
                    continue
                from_seat = info.get("seat", 0)
                target = m.get("target")  # int seat | None
                payload = {"type": "relay", "from": from_seat,
                           "data": m.get("data")}
                if target is not None:
                    tp = next((p for p in r["players"]
                               if p["seat"] == int(target)), None)
                    if tp:
                        await tx(tp["ws"], payload)
                else:
                    await broadcast(r, payload, exclude=ws)
    except websockets.ConnectionClosed:
        pass
    finally:
        info = clients.pop(ws, {})
        code = info.get("room")
        if code and code in rooms:
            r = rooms[code]
            r["players"] = [p for p in r["players"] if p["ws"] is not ws]
            if not r["players"]:
                del rooms[code]
            elif r["started"]:
                await broadcast(r, {"type": "opponent_left",
                                    "seat": info.get("seat")})
            else:
                # подтянуть seat'ы (никто ещё не начал)
                for i, p in enumerate(r["players"]):
                    p["seat"] = i
                    if p["ws"] in clients:
                        clients[p["ws"]]["seat"] = i
                await send_lobby_update(r)


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
