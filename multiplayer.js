
const MP = {
  ws: null,
  seat: null,
  numPlayers: 0,
  room: null,
  active: false,
  profile: { name: 'ИГРОК', avatar: 0 },
  peers: [],
  selectedCount: 4,

  stateSeq: 0,
  lastSeq: -1,

  leaveTimer: null,
};

const WS_PROTO = (location.protocol === 'https:') ? 'wss:' : 'ws:';
const WS_URL   = `${WS_PROTO}//${location.host}/ws`;

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

  const grid = document.getElementById('mp-av-grid');
  if (grid) {
    const cells = grid.querySelectorAll('.mp-av');
    cells.forEach(c => c.addEventListener('click', () => {
      cells.forEach(x => x.classList.remove('sel'));
      c.classList.add('sel');
    }));
  }

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
    const k = (m.data && m.data.k) ? m.data.k : '';
    mpHandleMsg(m);
  };
  MP.ws.onerror   = () => { mpSetStatus('Нет связи с сервером', '#ff5555'); };
  MP.ws.onclose   = () => {
    if (MP.active) {
      toast('СОЕДИНЕНИЕ ПОТЕРЯНО');
      MP.active = false;
      if (MP.leaveTimer) clearTimeout(MP.leaveTimer);
      MP.leaveTimer = setTimeout(goTitle, 1500);
    }
    else if (!opened) mpSetStatus('Сервер не отвечает', '#ff5555');
  };
}

function mpSend(obj) {
  if (!MP.ws || MP.ws.readyState !== WebSocket.OPEN) return false;
  try {
    MP.ws.send(JSON.stringify(obj));
    const k = (obj.data && obj.data.k) ? obj.data.k : '';
    const tg = (obj.target !== undefined) ? ('→' + obj.target) : '→ALL';
    return true;
  } catch (_) { return false; }
}

function mpSetStatus(txt, col) {
  const el = document.getElementById('mp-status');
  if (el) { el.textContent = txt || ''; el.style.color = col || '#ffaadd'; }
}

function goOnline() { show('online'); mpSetStatus(''); }

function mpResetLobbyUi(){
  const w  = document.getElementById('mp-waiting');  if (w) w.style.display = 'none';
  const r  = document.getElementById('mp-roster');    if (r) r.innerHTML = '';
  const cd = document.getElementById('mp-code-display'); if (cd) cd.textContent = '';
  if (MP.leaveTimer) { clearTimeout(MP.leaveTimer); MP.leaveTimer = null; }
  if (MP.ws) { try { MP.ws.close(); } catch(_){} MP.ws = null; }
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

    case 'relay': {
      const data = msg.data;
      const from = msg.from;
      if (!data) return;
      if (MP.seat === 0) mpHostHandle(from, data);
      else               mpGuestHandle(from, data);
      return;
    }

    case 'opponent_left':

      if (msg.seat === 0 && MP.seat !== 0) {
        toast('ХОСТ ВЫШЕЛ');
        MP.active = false;
        if (MP.leaveTimer) clearTimeout(MP.leaveTimer);
        MP.leaveTimer = setTimeout(goTitle, 1500);
      } else if (MP.seat === 0) {

        toast('ИГРОК ВЫШЕЛ');
        if (MP.active && G && !G.gameOver) mpSendState();
      } else {

        toast('ИГРОК ВЫШЕЛ');
      }
      return;

    case 'error':
      mpSetStatus(msg.msg, '#ff5555');
      return;
  }
}

function mpUpdateRoster(players) {
  const el = document.getElementById('mp-roster');
  if (!el) return;
  el.innerHTML = '';
  players.forEach(p => {
    const row = document.createElement('div');
    row.className = 'row' + (p.seat === MP.seat ? ' me' : '');
    const img = document.createElement('img');
    const idx = Math.max(0, Math.min(4, (p.avatar|0)));
    img.src = `av${idx+1}.jpg`;
    img.alt = '';
    img.onerror = () => { img.onerror = null; img.src = 'av1.jpg'; };
    const nm = document.createElement('div');
    nm.textContent = p.name || ('Игрок ' + (p.seat+1));
    row.appendChild(img); row.appendChild(nm);
    el.appendChild(row);
  });
}

function mpStartGame() {
  prevRankings = null;

  if (typeof _pileSig !== 'undefined') _pileSig = null;
  const _pc = document.getElementById('pcards');
  if (_pc) _pc.innerHTML = '';

  if (MP.seat === 0) {

    newGame();
  } else {

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

    setTimeout(mpRequestSync, 600);
  }
}

function mpSendState() {
  if (!MP.active || MP.seat !== 0 || !G) return;
  MP.stateSeq++;
  const state = {
    k: 'state',
    seq: MP.stateSeq,
    hands: G.hands.map(h => h ? h.map(c => ({ r: c.r, s: c.s, id: c.id })) : []),
    currentCombo: G.currentCombo
      ? { cards: G.currentCombo.cards.map(c => ({ r: c.r, s: c.s, id: c.id })),
          rank: G.currentCombo.rank, count: G.currentCombo.count }
      : null,
    revolution:   G.revolution,
    turn:         G.turn,
    passCount:    G.passCount,
    finished:     G.finished,
    rankings:     G.rankings,
    gameOver:     G.gameOver,
    roundNum:     G.roundNum || 1,
    numPlayers:   G.numPlayers,
  };
  mlog('host sendState seq=', MP.stateSeq, 'turn=', G.turn,
       'combo=', state.currentCombo);
  mpSend({ type: 'relay', data: state });
}

function mpRequestSync() {
  if (!MP.active || MP.seat === 0) return;
  mpSend({ type: 'relay', target: 0, data: { k: 'sync_req' } });
}

function mpGuestHandle(fromSeat, data) {
  if (data.k === 'err') {
    sndError(); toast(data.msg || 'НЕЛЬЗЯ');
    if (G) G.busy = false;
    render();
    return;
  }
  if (data.k === 'rematch_status') {
    mpUpdateRematchUi(data.votes, data.total);
    return;
  }
  if (data.k !== 'state') return;

  if (typeof data.seq === 'number') {
    if (data.seq <= MP.lastSeq) {
      return;
    }
    MP.lastSeq = data.seq;
  }

  const my = MP.seat;
  const oldHand = (G && G.hands && G.hands[my]) || [];
  const selMap  = {};
  oldHand.forEach(c => { if (c && c.sel) selMap[c.id] = true; });

  const prev = G ? {
    combo:      G.currentCombo,
    turn:       G.turn,
    passCount:  G.passCount,
    revolution: G.revolution,
    gameOver:   G.gameOver,
    finishedLen: (G.finished || []).length,
  } : null;

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
  G.roundNum     = data.roundNum;
  G.numPlayers   = data.numPlayers;
  G.busy         = false;

  if (typeof applyLayoutForN === 'function') applyLayoutForN(G.numPlayers);
  if (typeof assignBotPersonalities === 'function') assignBotPersonalities(G.numPlayers);

  if (prev) {
    if (prev.gameOver && !data.gameOver) {
      const ov = document.getElementById('overlay');
      if (ov) ov.classList.add('h');
      const btn = document.getElementById('again-btn');
      if (btn) { btn.disabled = false; btn.textContent = '▶ ЕЩЁ РАЗ'; }
    }
    if (data.passCount > prev.passCount && prev.turn != null && prev.turn !== my) {
      if (typeof showPas === 'function') showPas(prev.turn);
    }
    if (prev.combo && !data.currentCombo) {
      if (typeof sndClear === 'function') sndClear();
      const is8 = prev.combo.rank === '8';
      if (typeof toast === 'function') toast(is8 ? '8 — СТОП!' : 'СТОЛ ОЧИЩЕН');
    }
    if (data.revolution !== prev.revolution) {
      if (typeof sndRevolution === 'function') sndRevolution();
      if (typeof toast === 'function') toast(data.revolution ? '⚡ РЕВОЛЮЦИЯ!' : '⚡ КОНТР-РЕВ!');
    }
    if ((data.finished || []).length > prev.finishedLen) {
      const newFinishers = (data.finished || []).slice(prev.finishedLen);
      newFinishers.forEach((p, i) => {
        const rk = (data.rankings || []).find(r => r.player === p);
        if (!rk) return;
        const nm = (typeof NAMES !== 'undefined' && NAMES[p]) ? NAMES[p] : ('Игрок ' + (p+1));
        if (typeof RANK_NAMES !== 'undefined') {
          toast(nm + ': ' + RANK_NAMES[rk.rank] + '!');
        }
      });
    }
  }

  render();
  if (G.gameOver) setTimeout(showResults, 1400);
}

function mpGuestPlay(cardIds) {
  if (!G || G.gameOver) { toast('Игра окончена'); return; }
  if (G.turn !== MP.seat) { toast('Сейчас не ваш ход'); return; }
  if (G.finished && G.finished.includes(MP.seat)) { toast('Вы уже вышли'); return; }
  if (!mpSend({ type: 'relay', target: 0, data: { k: 'play', cardIds } })) {
    toast('НЕТ СОЕДИНЕНИЯ'); return;
  }
  G.busy = true;
  if (G.hands && G.hands[MP.seat]) G.hands[MP.seat].forEach(c => { if (c) c.sel = false; });
  render();
}
function mpGuestPass() {
  if (!G || G.gameOver) { toast('Игра окончена'); return; }
  if (G.turn !== MP.seat) { toast('Сейчас не ваш ход'); return; }
  if (G.finished && G.finished.includes(MP.seat)) { toast('Вы уже вышли'); return; }
  if (!mpSend({ type: 'relay', target: 0, data: { k: 'pass' } })) {
    toast('НЕТ СОЕДИНЕНИЯ'); return;
  }
  G.busy = true;
  render();
}

function mpHostHandle(fromSeat, data) {
  mlog('host handle', data && data.k, 'from=', fromSeat,
       'turn=', G && G.turn, 'busy=', G && G.busy);

  if (data.k === 'sync_req') { mpSendState(); return; }

  if (data.k === 'rematch') {
    if (!_rematchVotes) _rematchVotes = new Set();
    _rematchVotes.add(fromSeat);
    mpBroadcastRematchStatus();
    mpCheckRematchStart();
    return;
  }

  if (!G || G.gameOver) { mlog('host: game not active'); return; }

  if (G.turn !== fromSeat || (G.finished && G.finished.includes(fromSeat))) {
    mpSendState(); return;
  }

  if (data.k === 'pass') {
    sndPass();
    doPass(fromSeat);
    return;
  }

  if (data.k === 'play') {
    if (!G.hands || !G.hands[fromSeat]) {
      mpSendState(); return;
    }
    const ids = data.cardIds || [];
    if (new Set(ids).size !== ids.length) {
      mpSend({ type:'relay', target: fromSeat,
               data:{ k:'err', msg:'ДУБЛИКАТЫ КАРТ' }});
      mpSendState();
      return;
    }
    const cards = ids
      .map(id => G.hands[fromSeat].find(c => c && c.id === id))
      .filter(Boolean);
    if (!cards.length || cards.length !== ids.length) {
      mpSendState(); return;
    }
    const res = validate(cards);
    if (!res.ok) {
      mpSend({ type:'relay', target: fromSeat, data:{ k:'err', msg:res.msg }});
      mpSendState();
      return;
    }
    sndCard();

    commitPlay(fromSeat, cards, res);
  }
}

let _rematchVotes = null;

function handleAgainClick() {
  const inMP = (typeof MP !== 'undefined' && MP.active);
  if (!inMP) { newGame(); return; }
  if (MP.seat === 0) {
    if (!_rematchVotes) _rematchVotes = new Set();
    _rematchVotes.add(0);
    mpBroadcastRematchStatus();
    mpCheckRematchStart();
  } else {
    mpSend({ type: 'relay', target: 0, data: { k: 'rematch' } });
    const btn = document.getElementById('again-btn');
    if (btn) btn.disabled = true;
  }
}

function mpBroadcastRematchStatus() {
  if (!_rematchVotes) return;
  const v = _rematchVotes.size, t = MP.numPlayers;
  mpSend({ type: 'relay', data: { k: 'rematch_status', votes: v, total: t } });
  mpUpdateRematchUi(v, t);
}

function mpCheckRematchStart() {
  if (!_rematchVotes || _rematchVotes.size < MP.numPlayers) return;
  _rematchVotes = null;
  const btn = document.getElementById('again-btn');
  if (btn) { btn.disabled = false; btn.textContent = '▶ ЕЩЁ РАЗ'; }
  document.getElementById('overlay').classList.add('h');
  newGame();
}

function mpUpdateRematchUi(votes, total) {
  const btn = document.getElementById('again-btn');
  if (!btn) return;
  btn.textContent = '▶ ЕЩЁ РАЗ (' + votes + '/' + total + ')';
}

function mpLeave() {
  MP.active = false;
  if (MP.leaveTimer) { clearTimeout(MP.leaveTimer); MP.leaveTimer = null; }
  if (MP.ws) { try { MP.ws.close(); } catch(_){} MP.ws = null; }
  MP.seat = null; MP.room = null; MP.peers = []; MP.numPlayers = 0;
  MP.stateSeq = 0; MP.lastSeq = -1;
  _rematchVotes = null;
  const btn = document.getElementById('again-btn');
  if (btn) { btn.disabled = false; btn.textContent = '▶ ЕЩЁ РАЗ'; }
}
