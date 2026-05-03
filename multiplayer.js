// ============================================================
//  multiplayer.js — лобби и сетевой обмен (2-4 игрока, без ботов)
// ============================================================

const MP = {
  ws: null,
  seat: null,           // мой seat 0..N-1
  numPlayers: 0,
  room: null,
  active: false,
  profile: { name: 'ИГРОК', avatar: 0 },
  peers: [],            // [{seat, name, avatar}] — все игроки, включая меня
  selectedCount: 4,     // выбор хоста при создании
};

const WS_PROTO = (location.protocol === 'https:') ? 'wss:' : 'ws:';
const WS_URL   = `${WS_PROTO}//${location.host}/ws`;

// ── ПРОФИЛЬ ────────────────────────────────────────────────
let _customAvatarData = null; // data URL загруженного пользователем

function mpProfileStatus(txt, col){
  const a = document.getElementById('mp-status-prof');
  if (a) { a.textContent = txt || ''; a.style.color = col || '#ffaadd'; }
  const b = document.getElementById('mp-status');
  if (b) { b.textContent = ''; }
}

function mpReadProfile() {
  const inp  = document.getElementById('mp-name-input');
  const name = (inp && inp.value.trim()) || '';
  const sel  = document.querySelector('#mp-av-grid .mp-av.sel');
  if (!name) { mpProfileStatus('Введите ник', '#ff5555'); return null; }
  if (!sel)  { mpProfileStatus('Выберите аватар', '#ff5555'); return null; }
  // Кастомный или встроенный
  let avatar;
  if (sel.id === 'mp-av-custom') {
    if (!_customAvatarData) { mpProfileStatus('Загрузите картинку', '#ff5555'); return null; }
    avatar = _customAvatarData;        // data URL
  } else {
    avatar = parseInt(sel.dataset.av, 10);
  }
  MP.profile = { name: name.slice(0, 12), avatar };
  return MP.profile;
}

// Шаги лобби: profile → room
function mpToRoomStep(){
  if (!mpReadProfile()) return;
  document.getElementById('online').dataset.step = 'room';
  mpSetStatus('');
}
function mpToProfileStep(){
  document.getElementById('online').dataset.step = 'profile';
  mpProfileStatus('');
  // если уже подключены — сбрасываем
  if (MP.ws) { try { MP.ws.close(); } catch(_){} MP.ws = null; }
  MP.active = false; MP.seat = null; MP.room = null; MP.peers = [];
  const w = document.getElementById('mp-waiting');
  if (w) w.style.display = 'none';
  const r = document.getElementById('mp-roster');
  if (r) r.innerHTML = '';
}
function onlineBack(){
  const step = document.getElementById('online').dataset.step;
  if (step === 'room') mpToProfileStep();
  else                 goTitle();
}

// Загрузка кастомной аватарки → сжатие до 128×128 JPEG → data URL
function mpHandleAvatarFile(file){
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const SIDE = 128;
      const cv = document.createElement('canvas');
      cv.width = SIDE; cv.height = SIDE;
      const ctx = cv.getContext('2d');
      // обрезаем по центру до квадрата
      const s = Math.min(img.width, img.height);
      const sx = (img.width - s) / 2, sy = (img.height - s) / 2;
      ctx.drawImage(img, sx, sy, s, s, 0, 0, SIDE, SIDE);
      _customAvatarData = cv.toDataURL('image/jpeg', 0.78);
      // Показ в карточке + выбираем её
      const cell = document.getElementById('mp-av-custom');
      if (cell) {
        cell.classList.add('has-img');
        let im = cell.querySelector('img');
        if (!im) { im = document.createElement('img'); cell.appendChild(im); }
        im.src = _customAvatarData;
        document.querySelectorAll('#mp-av-grid .mp-av').forEach(c => c.classList.remove('sel'));
        cell.classList.add('sel');
      }
      mpProfileStatus('');
    };
    img.onerror = () => mpProfileStatus('Не удалось загрузить картинку', '#ff5555');
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

document.addEventListener('DOMContentLoaded', () => {
  // выбор аватара
  const grid = document.getElementById('mp-av-grid');
  if (grid) {
    const cells = grid.querySelectorAll('.mp-av');
    cells.forEach(c => c.addEventListener('click', () => {
      // Клик по "+" — открываем file picker (если файла ещё нет)
      if (c.id === 'mp-av-custom' && !_customAvatarData) {
        document.getElementById('mp-av-file').click();
        return;
      }
      cells.forEach(x => x.classList.remove('sel'));
      c.classList.add('sel');
    }));
  }
  // file input для кастомной аватарки
  const fi = document.getElementById('mp-av-file');
  if (fi) fi.addEventListener('change', e => {
    if (e.target.files && e.target.files[0]) mpHandleAvatarFile(e.target.files[0]);
  });

  // выбор кол-ва игроков
  const cnt = document.getElementById('mp-count-row');
  if (cnt) {
    const btns = cnt.querySelectorAll('.mp-count');
    btns.forEach(b => b.addEventListener('click', () => {
      btns.forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      MP.selectedCount = parseInt(b.dataset.n, 10);
    }));
  }
});

// ── СОЕДИНЕНИЕ ─────────────────────────────────────────────
function mpConnect(onOpen) {
  if (location.protocol === 'file:') {
    mpSetStatus('Откройте через http://… (не файл)', '#ff5555'); return;
  }
  if (MP.ws) { try { MP.ws.close(); } catch(_){} }
  try { MP.ws = new WebSocket(WS_URL); }
  catch (err) { mpSetStatus('Ошибка WS: ' + err.message, '#ff5555'); return; }

  let opened = false;
  MP.ws.onopen    = () => { opened = true; if (onOpen) onOpen(); };
  MP.ws.onmessage = e => mpHandleMsg(JSON.parse(e.data));
  MP.ws.onerror   = () => { mpSetStatus('Нет связи с сервером', '#ff5555'); };
  MP.ws.onclose   = () => {
    if (MP.active) { toast('СОЕДИНЕНИЕ ПОТЕРЯНО'); MP.active = false; goTitle(); }
    else if (!opened) mpSetStatus('Сервер не отвечает', '#ff5555');
  };
}

function mpSend(obj) {
  if (MP.ws && MP.ws.readyState === WebSocket.OPEN) {
    try { MP.ws.send(JSON.stringify(obj)); return true; }
    catch (_) { return false; }
  }
  return false;
}

function mpSetStatus(txt, col) {
  const el = document.getElementById('mp-status');
  if (el) { el.textContent = txt; el.style.color = col || '#ffaadd'; }
}

function goOnline() { show('online'); mpSetStatus(''); }

function mpResetLobbyUi(){
  const w  = document.getElementById('mp-waiting');
  if (w) w.style.display = 'none';
  const r  = document.getElementById('mp-roster');
  if (r) r.innerHTML = '';
  const cd = document.getElementById('mp-code-display');
  if (cd) cd.textContent = '';
  // полный сброс предыдущего состояния
  if (MP.ws) { try { MP.ws.close(); } catch(_){} MP.ws = null; }
  MP.active = false; MP.seat = null; MP.room = null;
  MP.peers = []; MP.numPlayers = 0;
}

// ── СОЗДАТЬ / ВОЙТИ ────────────────────────────────────────
function mpCreateRoom() {
  if (!mpReadProfile()) return;
  mpResetLobbyUi();
  mpSetStatus('Подключение…');
  mpConnect(() => mpSend({ type: 'create',
                            max_players: MP.selectedCount,
                            profile: MP.profile }));
}

function mpJoinRoom() {
  const inp  = document.getElementById('mp-code-input');
  const code = inp ? inp.value.trim().toUpperCase() : '';
  if (code.length < 2) { mpSetStatus('Введите код', '#ff5555'); return; }
  if (!mpReadProfile()) return;
  mpResetLobbyUi();
  mpSetStatus('Подключение…');
  mpConnect(() => mpSend({ type: 'join', code, profile: MP.profile }));
}

// ── ОБРАБОТКА СООБЩЕНИЙ ────────────────────────────────────
function mpHandleMsg(msg) {
  if (msg.type === 'created') {
    MP.seat = msg.seat;
    MP.numPlayers = msg.max;
    MP.room = msg.code;
    MP.active = false;
    document.getElementById('mp-code-display').textContent = msg.code;
    document.getElementById('mp-waiting').style.display = 'block';
    mpSetStatus('Ожидаем игроков…', '#ffcc44');
  }
  else if (msg.type === 'joined') {
    MP.seat = msg.seat;
    MP.numPlayers = msg.max;
    MP.room = msg.code;
    MP.active = false;
    document.getElementById('mp-code-display').textContent = msg.code;
    document.getElementById('mp-waiting').style.display = 'block';
    mpUpdateRoster(msg.players || []);
    mpSetStatus('Ожидаем игроков…', '#ffcc44');
  }
  else if (msg.type === 'lobby_update') {
    MP.numPlayers = msg.max;
    mpUpdateRoster(msg.players || []);
    const cur = (msg.players || []).length;
    mpSetStatus(`Ожидаем игроков… ${cur}/${msg.max}`, '#ffcc44');
  }
  else if (msg.type === 'start') {
    MP.peers = msg.players || [];
    MP.numPlayers = msg.max;
    MP.active = true;
    mpSetStatus('Все собрались! Начинаем…', '#44ff88');
    setTimeout(() => { show('game'); mpStartGame(); }, 600);
  }
  else if (msg.type === 'relay') {
    const data = msg.data, from = msg.from;
    if (!data) return;
    if (MP.seat === 0) mpHostHandle(from, data);
    else               mpGuestHandle(from, data);
  }
  else if (msg.type === 'opponent_left') {
    toast('ИГРОК ВЫШЕЛ');
    MP.active = false;
    setTimeout(goTitle, 1800);
  }
  else if (msg.type === 'error') {
    mpSetStatus(msg.msg, '#ff5555');
  }
}

function avatarSrcFromValue(v){
  if (typeof v === 'string' && v.startsWith('data:')) return v;
  const i = Math.max(0, Math.min(4, (v|0)));
  return `av${i+1}.jpg`;
}

function mpUpdateRoster(players) {
  const el = document.getElementById('mp-roster');
  if (!el) return;
  el.innerHTML = '';
  players.forEach(p => {
    const row = document.createElement('div');
    row.className = 'row' + (p.seat === MP.seat ? ' me' : '');
    const img = document.createElement('img');
    img.src = avatarSrcFromValue(p.avatar);
    img.alt = '';
    const nm = document.createElement('div');
    nm.textContent = p.name || ('Игрок ' + (p.seat+1));
    row.appendChild(img); row.appendChild(nm);
    el.appendChild(row);
  });
}

// ── СТАРТ ИГРЫ ─────────────────────────────────────────────
function mpStartGame() {
  prevRankings = null;
  if (MP.seat === 0) {
    // Хост запускает игру (newGame() сам расставит профили из MP.peers)
    newGame();
  } else {
    // Гость: ожидает первое состояние от хоста.
    // Сразу применяем layout и расставляем аватары/имена соперников.
    G = { hands: Array.from({length: MP.numPlayers}, () => []),
          currentCombo:null, pile:[], revolution:false,
          turn:0, passCount:0, finished:[], rankings:[],
          gameOver:false, busy:false, roundNum:1,
          numPlayers: MP.numPlayers };
    if (typeof applyLayoutForN === 'function') applyLayoutForN(MP.numPlayers);
    if (typeof assignBotPersonalities === 'function') assignBotPersonalities(MP.numPlayers);
    render();
  }
}

// ── ХОСТ → ВСЕМ: один broadcast с одинаковым состоянием ─────
// Раньше каждый получал свой "масочный" пакет — это давало рассинхрон.
// Теперь шлём всем одинаковое состояние, чужие руки в UI всё равно
// рисуются как "рубашки" (renderBotHands не показывает значения).
function mpSendState() {
  if (!MP.active || MP.seat !== 0) return;
  const state = {
    k: 'state',
    hands: G.hands.map(h => h.map(c => ({ r: c.r, s: c.s, id: c.id }))),
    currentCombo: G.currentCombo,
    revolution:   G.revolution,
    turn:         G.turn,
    passCount:    G.passCount,
    finished:     G.finished,
    rankings:     G.rankings,
    gameOver:     G.gameOver,
    roundNum:     G.roundNum || 1,
    numPlayers:   G.numPlayers,
  };
  mpSend({ type: 'relay', data: state });   // без target = broadcast всем кроме хоста
}

// ── ГОСТЬ ← ХОСТ: применить состояние ──────────────────────
function mpGuestHandle(fromSeat, data) {
  if (data.k === 'err') { sndError(); toast(data.msg || 'НЕЛЬЗЯ'); G.busy = false; render(); return; }
  if (data.k !== 'state') return;

  const my = MP.seat;
  // Сохраняем локальные выделения только для своей руки
  const oldHand = (G.hands && G.hands[my]) || [];
  const selMap  = {};
  oldHand.forEach(c => { if (c.sel) selMap[c.id] = true; });

  G.hands = data.hands.map((h, i) =>
    h.map(c => ({ r: c.r, s: c.s, id: c.id, sel: (i === my && !!selMap[c.id]) }))
  );
  G.currentCombo = data.currentCombo;
  G.revolution   = data.revolution;
  G.turn         = data.turn;
  G.passCount    = data.passCount;
  G.finished     = data.finished;
  G.rankings     = data.rankings;
  G.gameOver     = data.gameOver;
  G.roundNum     = data.roundNum;
  G.numPlayers   = data.numPlayers;
  G.busy         = false;

  if (typeof applyLayoutForN === 'function') applyLayoutForN(G.numPlayers);
  if (typeof assignBotPersonalities === 'function') assignBotPersonalities(G.numPlayers);
  render();
  if (G.gameOver) setTimeout(showResults, 1400);
}

// ── ГОСТЬ → ХОСТУ: действие ────────────────────────────────
function mpGuestPlay(cardIds) {
  if (!mpSend({ type: 'relay', target: 0, data: { k: 'play', cardIds } })) {
    toast('НЕТ СОЕДИНЕНИЯ С ХОСТОМ');
    return;
  }
  G.hands[MP.seat].forEach(c => c.sel = false);
  // Блокируем интерфейс и таймер до ответа хоста — иначе авто-пас
  // сработает прямо во время сетевого роундтрипа.
  G.busy = true;
  if (typeof clearTurnTimer === 'function') clearTurnTimer();
  render();
  // Защита от зависания: если хост не ответил за 8 сек — снимаем блок
  setTimeout(() => {
    if (G && G.busy && MP.active) {
      G.busy = false;
      toast('ХОСТ НЕ ОТВЕТИЛ — ПОПРОБУЙТЕ ЕЩЁ');
      render();
    }
  }, 8000);
}
function mpGuestPass() {
  if (!mpSend({ type: 'relay', target: 0, data: { k: 'pass' } })) {
    toast('НЕТ СОЕДИНЕНИЯ С ХОСТОМ');
    return;
  }
  G.busy = true;
  if (typeof clearTurnTimer === 'function') clearTurnTimer();
  render();
  setTimeout(() => {
    if (G && G.busy && MP.active) { G.busy = false; render(); }
  }, 8000);
}

// ── ХОСТ ← ГОСТЬ: обработать действие ──────────────────────
function mpHostHandle(fromSeat, data) {
  if (G.gameOver) return;
  // На любые проблемы — шлём свежее состояние, чтобы гость пересинхронился.
  if (G.turn !== fromSeat || G.finished.includes(fromSeat)) {
    mpSendState();
    return;
  }
  if (data.k === 'pass') {
    sndPass();
    doPass(fromSeat);
  } else if (data.k === 'play') {
    const cards = (data.cardIds || [])
      .map(id => G.hands[fromSeat].find(c => c.id === id))
      .filter(Boolean);
    if (!cards.length) {
      mpSend({ type:'relay', target: fromSeat, data:{ k:'err', msg:'НЕТ ТАКИХ КАРТ' }});
      mpSendState();
      return;
    }
    const res = validate(cards);
    if (!res.ok) {
      mpSend({ type:'relay', target: fromSeat,
               data:{ k:'err', msg:res.msg }});
      mpSendState();
      return;
    }
    sndCard();
    flyCards(cards, cards.map(() => getBotPos(fromSeat)),
             () => commitPlay(fromSeat, cards, res));
  }
}

// ── ВЫХОД ──────────────────────────────────────────────────
function mpLeave() {
  MP.active = false;
  if (MP.ws) { try { MP.ws.close(); } catch(_){} MP.ws = null; }
  MP.seat = null; MP.room = null; MP.peers = []; MP.numPlayers = 0;
}
