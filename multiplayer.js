// ============================================================
//  multiplayer.js — WebSocket lobby & state sync for DaiFugo
// ============================================================

const MP = { ws: null, seat: null, room: null, active: false,
             profile: { name: 'ИГРОК', avatar: 0 }, peer: null };
// WS на том же хосте/порту, что и страница, по пути /ws.
// Работает и локально (ws://localhost:8000/ws), и на Render (wss://app.onrender.com/ws).
const WS_PROTO = (location.protocol === 'https:') ? 'wss:' : 'ws:';
const WS_URL   = `${WS_PROTO}//${location.host}/ws`;

function mpReadProfile() {
  const inp  = document.getElementById('mp-name-input');
  const name = (inp && inp.value.trim()) || '';
  const sel  = document.querySelector('#mp-av-grid .mp-av.sel');
  if (!name) {
    mpSetStatus('Введите ник', '#ff5555');
    return null;
  }
  if (!sel) {
    mpSetStatus('Выберите аватар', '#ff5555');
    return null;
  }
  const avatar = parseInt(sel.dataset.av, 10);
  MP.profile = { name: name.slice(0, 12), avatar };
  return MP.profile;
}

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('mp-av-grid');
  if (grid) {
    const cells = grid.querySelectorAll('.mp-av');
    cells.forEach(c => c.addEventListener('click', () => {
      cells.forEach(x => x.classList.remove('sel'));
      c.classList.add('sel');
    }));
    // не выбираем аватар по умолчанию — пусть пользователь выберет сам
  }
});

// ── CONNECTION ────────────────────────────────────────────
function mpConnect(onOpen) {
  // Sanity checks before opening the socket
  if (location.protocol === 'file:') {
    mpSetStatus('Откройте http://localhost:8000 (не файл!)', '#ff5555');
    return;
  }
  if (!location.hostname) {
    mpSetStatus('Нет адреса хоста. Откройте через http://…', '#ff5555');
    return;
  }
  if (MP.ws) { try { MP.ws.close(); } catch(_){} }
  try { MP.ws = new WebSocket(WS_URL); }
  catch (err) { mpSetStatus('Ошибка WebSocket: ' + err.message, '#ff5555'); return; }

  let opened = false;
  MP.ws.onopen    = () => { opened = true; if (onOpen) onOpen(); };
  MP.ws.onmessage = e => mpHandleMsg(JSON.parse(e.data));
  MP.ws.onerror   = () => {
    mpSetStatus('Нет связи с ' + WS_URL +
      ' — проверьте, что server.py запущен и установлен пакет websockets', '#ff5555');
  };
  MP.ws.onclose   = () => {
    if (MP.active) { toast('СОЕДИНЕНИЕ ПОТЕРЯНО'); MP.active = false; goTitle(); }
    else if (!opened) {
      mpSetStatus('Сервер не отвечает на ' + WS_URL +
        '. Запустите: pip install websockets, затем python server.py', '#ff5555');
    }
  };
}

function mpSend(obj) {
  if (MP.ws && MP.ws.readyState === WebSocket.OPEN)
    MP.ws.send(JSON.stringify(obj));
}

// ── UI HELPERS ────────────────────────────────────────────
function mpSetStatus(txt, col) {
  const el = document.getElementById('mp-status');
  if (el) { el.textContent = txt; el.style.color = col || '#ffaadd'; }
}

function goOnline() { show('online'); mpSetStatus(''); }

// ── CREATE ROOM ───────────────────────────────────────────
function mpCreateRoom() {
  if (!mpReadProfile()) return;
  mpSetStatus('Подключение…');
  mpConnect(() => mpSend({ type: 'create', profile: MP.profile }));
}

// ── JOIN ROOM ─────────────────────────────────────────────
function mpJoinRoom() {
  const inp = document.getElementById('mp-code-input');
  const code = inp ? inp.value.trim().toUpperCase() : '';
  if (code.length < 2) { mpSetStatus('Введите код!', '#ff5555'); return; }
  if (!mpReadProfile()) return;
  mpSetStatus('Подключение…');
  mpConnect(() => mpSend({ type: 'join', code, profile: MP.profile }));
}

// ── MESSAGE HANDLER ───────────────────────────────────────
function mpHandleMsg(msg) {
  if (msg.type === 'created') {
    MP.seat = 0; MP.room = msg.code; MP.active = false;
    mpSetStatus('Код комнаты: ' + msg.code + ' — ждём гостя…', '#ffcc44');
    document.getElementById('mp-code-display').textContent = msg.code;
    document.getElementById('mp-waiting').style.display = 'block';
  }
  else if (msg.type === 'guest_joined') {
    MP.active = true;
    MP.peer = msg.profile || { name: 'Гость', avatar: 1 };
    mpSetStatus('Гость подключился! Начинаем…', '#44ff88');
    setTimeout(() => { show('game'); mpStartGame(); }, 600);
  }
  else if (msg.type === 'joined') {
    MP.seat = 1; MP.room = msg.code; MP.active = true;
    MP.peer = msg.host_profile || { name: 'Хост', avatar: 0 };
    mpSetStatus('Подключено! Ожидаем старта…', '#44ff88');
    show('game');
    G = { hands:[[],[],[],[]], currentCombo:null, pile:[],
          revolution:false, turn:0, passCount:0,
          finished:[], rankings:[], gameOver:false, busy:false, roundNum:1 };
    render();
  }
  else if (msg.type === 'relay') {
    const data = msg.data;
    if (!data) return;
    if (MP.seat === 0) mpApplyGuestAction(data);
    else               mpApplyHostState(data);
  }
  else if (msg.type === 'opponent_left') {
    toast('ПРОТИВНИК ОТКЛЮЧИЛСЯ');
    MP.active = false;
    setTimeout(goTitle, 1800);
  }
  else if (msg.type === 'error') {
    mpSetStatus(msg.msg, '#ff5555');
  }
}

// ── HOST: start game ──────────────────────────────────────
function mpStartGame() {
  prevRankings = null;
  newGame();
}

// ── HOST: send state to guest ─────────────────────────────
function mpSendState() {
  if (!MP.active || MP.seat !== 0) return;
  // send guest's real hand; mask all others
  const maskedHands = G.hands.map((h, i) =>
    i === 1
      ? h.map(c => ({ r: c.r, s: c.s, id: c.id, sel: false }))
      : h.map(c => ({ r: '?',  s: '?',  id: c.id, sel: false }))
  );
  mpSend({ type: 'relay', data: {
    k: 'state',
    hands:        maskedHands,
    handLens:     G.hands.map(h => h.length),
    currentCombo: G.currentCombo,
    revolution:   G.revolution,
    turn:         G.turn,
    passCount:    G.passCount,
    finished:     G.finished,
    rankings:     G.rankings,
    gameOver:     G.gameOver,
    roundNum:     G.roundNum || 1
  }});
}

// ── GUEST: apply state from host ──────────────────────────
function mpApplyHostState(data) {
  if (data.k !== 'state') return;
  // preserve local sel state on guest's hand
  const oldHand = (G.hands && G.hands[1]) || [];
  const selMap  = {};
  oldHand.forEach(c => { if (c.sel) selMap[c.id] = true; });

  G.hands = data.hands.map((h, i) =>
    h.map(c => ({ ...c, sel: (i === 1 && selMap[c.id]) || false }))
  );
  G.currentCombo = data.currentCombo;
  G.revolution   = data.revolution;
  G.turn         = data.turn;
  G.passCount    = data.passCount;
  G.finished     = data.finished;
  G.rankings     = data.rankings;
  G.gameOver     = data.gameOver;
  G.roundNum     = data.roundNum;
  G.busy         = false;
  render();
  if (G.gameOver) setTimeout(showResults, 1400);
}

// ── GUEST: send action to host ────────────────────────────
function mpGuestPlay(cardIds) {
  mpSend({ type: 'relay', data: { k: 'play', cardIds } });
  G.hands[1].forEach(c => c.sel = false);
  render();
}
function mpGuestPass() {
  mpSend({ type: 'relay', data: { k: 'pass' } });
}

// ── HOST: apply guest action ──────────────────────────────
function mpApplyGuestAction(data) {
  if (G.turn !== 1 || G.finished.includes(1) || G.gameOver) return;
  if (data.k === 'pass') {
    sndPass();
    doPass(1);
  } else if (data.k === 'play') {
    const cards = (data.cardIds || [])
      .map(id => G.hands[1].find(c => c.id === id))
      .filter(Boolean);
    if (!cards.length) return;
    const res = validate(cards);
    if (!res.ok) { mpSend({ type:'relay', data:{ k:'err', msg:res.msg }}); return; }
    sndCard();
    flyCards(cards, cards.map(() => getBotPos(1)), () => commitPlay(1, cards, res));
  } else if (data.k === 'err') {
    sndError();
    toast(data.msg);
  }
}

// ── DISCONNECT ────────────────────────────────────────────
function mpLeave() {
  MP.active = false;
  if (MP.ws) { try { MP.ws.close(); } catch(_){} MP.ws = null; }
  MP.seat = null; MP.room = null;
}
