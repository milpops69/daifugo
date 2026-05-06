// ============================================================
//  multiplayer.js — полностью рабочий клиент для DaiFugo MP (2-4 игроков)
//
//  Протокол:
//    клиент → сервер:
//      { type:'create', max_players:N, profile:{name,avatar} }
//      { type:'join',   code, profile:{name,avatar} }
//      { type:'relay',  data:{...}, target?:seat }     // target=null → всем кроме отправителя
//
//    сервер → клиент:
//      { type:'created', code, max, seat:0 }
//      { type:'joined',  code, max, seat, players }
//      { type:'lobby_update', players, max }
//      { type:'start',   players, max }
//      { type:'relay',   from:seat, data:{...} }
//      { type:'opponent_left', seat }
//      { type:'error',   msg }
//
//  data.k:
//      'state' — хост → всем гостям (полное состояние игры)
//      'play'  — гость → хосту (мой ход с указанными ID карт)
//      'pass'  — гость → хосту (мой пас)
//      'err'   — хост → гостю (валидация не прошла)
//      'sync_req' — гость → хосту (запрос полного состояния)
// ============================================================

const MP = {
  ws: null,
  seat: null,
  numPlayers: 0,
  room: null,
  active: false,
  profile: { name: 'ИГРОК', avatar: 0 },
  peers: [],
  selectedCount: 4,
  stateSeq: 0,          // для отслеживания версий состояния
  lastSeq: -1,          // последняя примененная версия
  leaveTimer: null,     // таймер для выхода
};

const WS_PROTO = (location.protocol === 'https:') ? 'wss:' : 'ws:';
const WS_URL   = `${WS_PROTO}//${location.host}/ws`;

const MP_DEBUG = true;
function mlog(...a){ if (MP_DEBUG) console.log('[MP]', ...a); }

// Глобальные переменные игры (определяются в main.js)
let G;           // состояние игры
let prevRankings = null;

// ── ПРОФИЛЬ ────────────────────────────────────────────────
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
  MP.profile = { name: name.slice(0, 12), avatar: parseInt(sel.dataset.av, 10) };
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
  mpLeave();
  const w = document.getElementById('mp-waiting');  if (w) w.style.display = 'none';
  const r = document.getElementById('mp-roster');    if (r) r.innerHTML = '';
}
function onlineBack(){
  const step = document.getElementById('online').dataset.step;
  if (step === 'room') mpToProfileStep();
  else                 goTitle();
}

document.addEventListener('DOMContentLoaded', () => {
  // Выбор аватара
  const grid = document.getElementById('mp-av-grid');
  if (grid) {
    const cells = grid.querySelectorAll('.mp-av');
    cells.forEach(c => c.addEventListener('click', () => {
      cells.forEach(x => x.classList.remove('sel'));
      c.classList.add('sel');
    }));
  }
  // Выбор кол-ва игроков
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
  MP.ws.onopen    = () => { opened = true; mlog('WS open'); if (onOpen) onOpen(); };
  MP.ws.onmessage = e => {
    let m; try { m = JSON.parse(e.data); } catch (_) { return; }
    mlog('recv', m.type, m);
    mpHandleMsg(m);
  };
  MP.ws.onerror   = () => { mpSetStatus('Нет связи с сервером', '#ff5555'); };
  MP.ws.onclose   = () => {
    mlog('WS close');
    if (MP.active) { 
      toast('СОЕДИНЕНИЕ ПОТЕРЯНО'); 
      MP.active = false; 
      setTimeout(() => goTitle(), 1500);
    }
    else if (!opened) mpSetStatus('Сервер не отвечает', '#ff5555');
  };
}

function mpSend(obj) {
  if (!MP.ws || MP.ws.readyState !== WebSocket.OPEN) return false;
  try {
    MP.ws.send(JSON.stringify(obj));
    mlog('send', obj.type, obj);
    return true;
  } catch (_) { return false; }
}

function mpSetStatus(txt, col) {
  const el = document.getElementById('mp-status');
  if (el) { el.textContent = txt || ''; el.style.color = col || '#ffaadd'; }
}

function goOnline() { show('online'); mpSetStatus(''); }

// ── СОЗДАТЬ / ВОЙТИ ────────────────────────────────────────
function mpResetLobbyUi(){
  const w  = document.getElementById('mp-waiting');  if (w) w.style.display = 'none';
  const r  = document.getElementById('mp-roster');    if (r) r.innerHTML = '';
  const cd = document.getElementById('mp-code-display'); if (cd) cd.textContent = '';
  if (MP.leaveTimer) clearTimeout(MP.leaveTimer);
  MP.active = false; MP.seat = null; MP.room = null;
  MP.peers = []; MP.numPlayers = 0;
  MP.stateSeq = 0; MP.lastSeq = -1;
}

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

// ── ОБРАБОТКА СООБЩЕНИЙ ОТ СЕРВЕРА ─────────────────────────
function mpHandleMsg(msg) {
  switch (msg.type) {
    case 'created':
      MP.seat = msg.seat; MP.numPlayers = msg.max; MP.room = msg.code;
      MP.active = false;
      document.getElementById('mp-code-display').textContent = msg.code;
      document.getElementById('mp-waiting').style.display = 'block';
      mpSetStatus('Ожидаем игроков…', '#ffcc44');
      return;

    case 'joined':
      MP.seat = msg.seat; MP.numPlayers = msg.max; MP.room = msg.code;
      MP.active = false;
      document.getElementById('mp-code-display').textContent = msg.code;
      document.getElementById('mp-waiting').style.display = 'block';
      mpUpdateRoster(msg.players || []);
      mpSetStatus('Ожидаем игроков…', '#ffcc44');
      return;

    case 'lobby_update':
      MP.numPlayers = msg.max;
      mpUpdateRoster(msg.players || []);
      mpSetStatus(`Ожидаем игроков… ${(msg.players||[]).length}/${msg.max}`, '#ffcc44');
      return;

    case 'start':
      MP.peers = msg.players || [];
      MP.numPlayers = msg.max;
      MP.active = true;
      mpSetStatus('Поехали!', '#44ff88');
      show('game');
      mpStartGame();
      return;

    case 'relay':
      const data = msg.data;
      const from = msg.from;
      if (!data) return;
      if (MP.seat === 0) mpHostHandle(from, data);
      else               mpGuestHandle(from, data);
      return;

    case 'opponent_left':
      if (msg.seat === 0 && MP.seat !== 0) {
        toast('Хост покинул игру');
        MP.active = false;
        mpLeave();
        setTimeout(() => goTitle(), 1500);
      } else {
        toast('ИГРОК ВЫШЕЛ');
        if (MP.seat === 0) {
          // Хост должен пересобрать игру
          mpSendState();
        }
      }
      return;

    case 'error':
      mpSetStatus(msg.msg, '#ff5555');
      if (MP.active) {
        toast('Ошибка: ' + msg.msg);
        setTimeout(() => goTitle(), 2000);
      }
      return;
  }
}

function mpUpdateRoster(players) {
  const el = document.getElementById('mp-roster');
  if (!el) return;
  el.innerHTML = '';
  const maxAvatars = 12; // количество доступных аватаров
  players.forEach(p => {
    const row = document.createElement('div');
    row.className = 'row' + (p.seat === MP.seat ? ' me' : '');
    const img = document.createElement('img');
    let idx = Math.max(0, Math.min(maxAvatars - 1, (p.avatar || 0)));
    img.src = `av${idx+1}.jpg`;
    img.alt = '';
    img.onerror = () => { img.src = 'av1.jpg'; }; // fallback
    const nm = document.createElement('div');
    nm.textContent = p.name || ('Игрок ' + (p.seat+1));
    row.appendChild(img); row.appendChild(nm);
    el.appendChild(row);
  });
}

// ── ВАЛИДАЦИЯ ХОДА (базовая, нужно дополнить под ваши правила) ──
function validate(cards) {
  if (!cards || cards.length === 0) {
    return { ok: false, msg: 'Нет карт' };
  }
  
  // Базовая проверка - все карты одного ранга
  const rank = cards[0].r;
  const allSameRank = cards.every(c => c.r === rank);
  
  if (!allSameRank) {
    return { ok: false, msg: 'Карты должны быть одного ранга' };
  }
  
  // Проверка комбинации с текущей на столе
  if (G.currentCombo && G.currentCombo.cards && G.currentCombo.cards.length > 0) {
    const currentRank = G.currentCombo.cards[0].r;
    const currentCount = G.currentCombo.cards.length;
    const isRevolution = G.revolution;
    
    // При революции нужно бить младшим рангом
    if (isRevolution) {
      if (rank >= currentRank && currentRank !== 2) { // 2 всегда бьет
        return { ok: false, msg: 'При революции нужно бить младшей картой' };
      }
    } else {
      if (rank <= currentRank && rank !== 2) { // 2 всегда бьет
        return { ok: false, msg: 'Нужно бить старшей картой' };
      }
    }
    
    if (cards.length !== currentCount) {
      return { ok: false, msg: `Нужно ${currentCount} карт` };
    }
  }
  
  return { ok: true, msg: '' };
}

// ── СТАРТ ИГРЫ ─────────────────────────────────────────────
function mpStartGame() {
  prevRankings = null;
  if (MP.seat === 0) {
    // Хост — запускает игру
    newGame();
    // Отправляем состояние через 100ms чтобы render() успел отработать
    setTimeout(() => mpSendState(), 100);
  } else {
    // Гость — ждём первый state от хоста
    G = {
      hands: Array.from({length: MP.numPlayers}, () => []),
      currentCombo: null, pile: [], revolution: false,
      turn: 0, passCount: 0, finished: [], rankings: [],
      gameOver: false, busy: false, roundNum: 1,
      numPlayers: MP.numPlayers
    };
    if (typeof applyLayoutForN === 'function') applyLayoutForN(MP.numPlayers);
    if (typeof assignBotPersonalities === 'function') assignBotPersonalities(MP.numPlayers);
    render();
    
    // Запрашиваем состояние у хоста
    setTimeout(() => mpRequestSync(), 500);
  }
}

function mpRequestSync() {
  if (!MP.active || MP.seat === 0) return;
  mpSend({ type: 'relay', target: 0, data: { k: 'sync_req' } });
}

// ── ХОСТ → ВСЕМ: единый broadcast полного состояния ────────
function mpSendState() {
  if (!MP.active || MP.seat !== 0) return;
  if (!G) return;
  
  MP.stateSeq++;
  const state = {
    seq: MP.stateSeq,
    k: 'state',
    hands: G.hands.map(h => h ? h.map(c => ({ r: c.r, s: c.s, id: c.id })) : []),
    currentCombo: G.currentCombo ? {
      cards: G.currentCombo.cards.map(c => ({ r: c.r, s: c.s, id: c.id })),
      type: G.currentCombo.type,
      rank: G.currentCombo.rank
    } : null,
    revolution:   G.revolution,
    turn:         G.turn,
    passCount:    G.passCount,
    finished:     G.finished,
    rankings:     G.rankings,
    gameOver:     G.gameOver,
    roundNum:     G.roundNum || 1,
    numPlayers:   G.numPlayers,
  };
  mpSend({ type: 'relay', data: state });    // без target = всем гостям
}

// ── ГОСТЬ ← ХОСТ: применяем состояние ──────────────────────
function mpGuestHandle(fromSeat, data) {
  if (data.k === 'err') {
    if (typeof sndError === 'function') sndError();
    toast(data.msg || 'НЕЛЬЗЯ');
    if (G) G.busy = false;
    render();
    return;
  }
  
  if (data.k === 'state') {
    // Пропускаем старые версии
    if (data.seq && data.seq <= MP.lastSeq) return;
    if (data.seq) MP.lastSeq = data.seq;
    
    if (!G) {
      G = {
        hands: [],
        currentCombo: null,
        pile: [],
        revolution: false,
        turn: 0,
        passCount: 0,
        finished: [],
        rankings: [],
        gameOver: false,
        busy: false,
        roundNum: 1,
        numPlayers: data.numPlayers || MP.numPlayers
      };
    }
    
    const my = MP.seat;
    const oldHand = (G.hands && G.hands[my]) ? G.hands[my] : [];
    const selMap = {};
    if (oldHand) oldHand.forEach(c => { if (c && c.sel) selMap[c.id] = true; });
    
    G.hands = data.hands.map((h, i) =>
      h.map(c => ({ r: c.r, s: c.s, id: c.id, sel: (i === my && !!selMap[c.id]) }))
    );
    
    G.currentCombo = data.currentCombo;
    G.revolution   = data.revolution;
    G.turn         = data.turn;
    G.passCount    = data.passCount;
    G.finished     = data.finished || [];
    G.rankings     = data.rankings || [];
    G.gameOver     = data.gameOver;
    G.roundNum     = data.roundNum || 1;
    G.numPlayers   = data.numPlayers;
    G.busy         = false;
    
    if (typeof applyLayoutForN === 'function') applyLayoutForN(G.numPlayers);
    if (typeof assignBotPersonalities === 'function') assignBotPersonalities(G.numPlayers);
    render();
    if (G.gameOver) setTimeout(() => showResults(), 1400);
    return;
  }
  
  if (data.k === 'sync_req' && MP.seat === 0) {
    // Гость запросил синхронизацию
    mpSendState();
  }
}

// ── ГОСТЬ → ХОСТУ: действие ────────────────────────────────
function mpGuestPlay(cardIds) {
  if (!G || G.gameOver) {
    toast('Игра окончена');
    return;
  }
  if (G.turn !== MP.seat) {
    toast('Сейчас не ваш ход');
    return;
  }
  if (G.finished.includes(MP.seat)) {
    toast('Вы уже вышли');
    return;
  }
  if (!mpSend({ type: 'relay', target: 0, data: { k: 'play', cardIds } })) {
    toast('НЕТ СОЕДИНЕНИЯ');
    return;
  }
  G.busy = true;
  if (G.hands && G.hands[MP.seat]) {
    G.hands[MP.seat].forEach(c => { if (c) c.sel = false; });
  }
  render();
}

function mpGuestPass() {
  if (!G || G.gameOver) {
    toast('Игра окончена');
    return;
  }
  if (G.turn !== MP.seat) {
    toast('Сейчас не ваш ход');
    return;
  }
  if (G.finished.includes(MP.seat)) {
    toast('Вы уже вышли');
    return;
  }
  if (!mpSend({ type: 'relay', target: 0, data: { k: 'pass' } })) {
    toast('НЕТ СОЕДИНЕНИЯ');
    return;
  }
  G.busy = true;
  render();
}

// ── ХОСТ ← ГОСТЬ: обработать действие ──────────────────────
function mpHostHandle(fromSeat, data) {
  if (!G || G.gameOver) return;

  // Запрос синхронизации
  if (data.k === 'sync_req') {
    mpSendState();
    return;
  }
  
  // Если очередь не того игрока или игрок уже finished - отправляем свежее состояние
  if (G.turn !== fromSeat || (G.finished && G.finished.includes(fromSeat))) {
    mpSendState();
    return;
  }

  if (data.k === 'pass') {
    if (typeof sndPass === 'function') sndPass();
    if (typeof doPass === 'function') {
      doPass(fromSeat);
    } else {
      // fallback если doPass не определена
      G.passCount++;
      let nextTurn = (fromSeat + 1) % G.numPlayers;
      while (G.finished.includes(nextTurn)) {
        nextTurn = (nextTurn + 1) % G.numPlayers;
      }
      G.turn = nextTurn;
    }
    mpSendState();
    render();
    return;
  }
  
  if (data.k === 'play') {
    if (!G.hands || !G.hands[fromSeat]) {
      mpSendState();
      return;
    }
    
    const cards = (data.cardIds || [])
      .map(id => G.hands[fromSeat].find(c => c && c.id === id))
      .filter(Boolean);
      
    // Проверка на дубликаты
    const uniqueIds = new Set(cards.map(c => c.id));
    if (cards.length !== uniqueIds.size) {
      mpSend({ type: 'relay', target: fromSeat, data: { k: 'err', msg: 'Нельзя играть одну карту дважды' } });
      mpSendState();
      return;
    }
    
    if (!cards.length) { 
      mpSendState(); 
      return; 
    }
    
    const res = validate(cards);
    if (!res.ok) {
      mpSend({ type: 'relay', target: fromSeat, data: { k: 'err', msg: res.msg } });
      mpSendState();
      return;
    }
    
    if (typeof sndCard === 'function') sndCard();
    
    if (typeof flyCards === 'function' && typeof getBotPos === 'function' && typeof commitPlay === 'function') {
      flyCards(cards, cards.map(() => getBotPos(fromSeat)),
               () => {
                 commitPlay(fromSeat, cards, res);
                 mpSendState();
               });
    } else {
      // fallback если функции анимации не определены
      if (typeof commitPlay === 'function') {
        commitPlay(fromSeat, cards, res);
      } else {
        // Минимальная реализация хода
        for (const card of cards) {
          const idx = G.hands[fromSeat].findIndex(c => c.id === card.id);
          if (idx !== -1) G.hands[fromSeat].splice(idx, 1);
        }
        G.currentCombo = { cards: cards, type: 'single', rank: cards[0].r };
        G.passCount = 0;
        let nextTurn = (fromSeat + 1) % G.numPlayers;
        while (G.finished.includes(nextTurn)) {
          nextTurn = (nextTurn + 1) % G.numPlayers;
        }
        G.turn = nextTurn;
      }
      mpSendState();
      render();
    }
  }
}

// ── ВЫХОД ──────────────────────────────────────────────────
function mpLeave() {
  MP.active = false;
  if (MP.leaveTimer) clearTimeout(MP.leaveTimer);
  if (MP.ws) { 
    try { 
      MP.ws.close(); 
    } catch(_){} 
    MP.ws = null; 
  }
  MP.seat = null; 
  MP.room = null; 
  MP.peers = []; 
  MP.numPlayers = 0;
  MP.stateSeq = 0;
  MP.lastSeq = -1;
}

// Экспорт функций для использования из game.js
window.mpGuestPlay = mpGuestPlay;
window.mpGuestPass = mpGuestPass;
window.mpLeave = mpLeave;
window.mpSendState = mpSendState;
window.mpRequestSync = mpRequestSync;