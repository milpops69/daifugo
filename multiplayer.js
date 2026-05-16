
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

let _customAvatarData = null;

function mpReadProfile() {
  const inp  = document.getElementById('mp-name-input');
  const name = (inp && inp.value.trim()) || '';
  const sel  = document.querySelector('#mp-av-grid .mp-av.sel');
  if (!name) { mpProfileStatus('Введите ник', '#ff5555'); return null; }
  if (!sel)  { mpProfileStatus('Выберите аватар', '#ff5555'); return null; }
  let avatar;
  if (sel.id === 'mp-av-custom') {
    if (!_customAvatarData) { mpProfileStatus('Загрузите картинку', '#ff5555'); return null; }
    avatar = _customAvatarData;
  } else {
    avatar = parseInt(sel.dataset.av, 10);
  }
  MP.profile = { name: name.slice(0, 12), avatar };
  return MP.profile;
}

function mpHandleAvatarFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const SIDE = 128;
      const cv = document.createElement('canvas');
      cv.width = SIDE; cv.height = SIDE;
      const ctx = cv.getContext('2d');
      const s = Math.min(img.width, img.height);
      const sx = (img.width - s) / 2, sy = (img.height - s) / 2;
      ctx.drawImage(img, sx, sy, s, s, 0, 0, SIDE, SIDE);
      _customAvatarData = cv.toDataURL('image/jpeg', 0.78);
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
      if (c.id === 'mp-av-custom' && !_customAvatarData) {
        const fi = document.getElementById('mp-av-file');
        if (fi) fi.click();
        return;
      }
      cells.forEach(x => x.classList.remove('sel'));
      c.classList.add('sel');
    }));
  }
  const fi = document.getElementById('mp-av-file');
  if (fi) fi.addEventListener('change', e => {
    if (e.target.files && e.target.files[0]) mpHandleAvatarFile(e.target.files[0]);
  });

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
  MP.ws.onopen    = () => { opened = true; if (onOpen) onOpen(); };
  MP.ws.onmessage = e => {
    let m; try { m = JSON.parse(e.data); } catch (_) { return; }
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
    if (typeof p.avatar === 'string' && p.avatar.startsWith('data:')) {
      img.src = p.avatar;
    } else {
      const idx = Math.max(0, Math.min(4, (p.avatar|0)));
      img.src = `av${idx+1}.jpg`;
    }
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
  if (data.k === 'exchange_init') {
    mpClientExchInit(data);
    return;
  }
  if (data.k === 'exchange_done') {
    mpClientExchDone(data);
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
  if (data.k === 'sync_req') { mpSendState(); return; }

  if (data.k === 'rematch') {
    if (!_rematchVotes) _rematchVotes = new Set();
    _rematchVotes.add(fromSeat);
    mpBroadcastRematchStatus();
    mpCheckRematchStart();
    return;
  }

  if (data.k === 'exchange_pick') {
    _mpHostReceivePick(fromSeat, data.cardIds || []);
    return;
  }
  if (data.k === 'exchange_ready') {
    _mpHostReceiveReady(fromSeat);
    return;
  }

  if (!G || G.gameOver) return;

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

  if (prevRankings && prevRankings.length === MP.numPlayers) {
    mpStartExchange();
  } else {
    newGame();
  }
}

let _mpExchHost = null;
let _mpExchClient = null;

function mpStartExchange() {
  const N = MP.numPlayers;
  const deck = shuffle(mkDeck());
  const hands = Array.from({length: N}, () => []);
  deck.forEach((c, i) => hands[i % N].push(c));
  hands.forEach(h => h.sort((a, b) => STR[a.r] - STR[b.r]));

  const byRank = new Array(N);
  prevRankings.forEach(r => byRank[r.rank] = r.player);

  const exchanges = [];
  if (N >= 4) {
    exchanges.push({ winner: byRank[0], loser: byRank[N-1], count: 2 });
    exchanges.push({ winner: byRank[1], loser: byRank[N-2], count: 1 });
  } else if (N === 3) {
    exchanges.push({ winner: byRank[0], loser: byRank[2], count: 2 });
    exchanges.push({ winner: byRank[1], loser: byRank[2], count: 1 });
  } else if (N === 2) {
    exchanges.push({ winner: byRank[0], loser: byRank[1], count: 1 });
  }

  exchanges.forEach(e => {
    e.loserGives = hands[e.loser].slice(-e.count).map(c => ({r:c.r, s:c.s, id:c.id}));
    e.loserGives.forEach(card => {
      const i = hands[e.loser].findIndex(c => c.id === card.id);
      if (i >= 0) hands[e.loser].splice(i, 1);
    });
  });

  _mpExchHost = {
    hands, exchanges,
    pendingPickers: new Set(exchanges.map(e => e.winner)),
    picks: {},
    ready: new Set(),
    rankings: prevRankings.slice(),
  };

  for (let seat = 0; seat < N; seat++) {
    const init = _mpBuildExchInit(seat, hands[seat], exchanges, prevRankings);
    if (seat === 0) {
      mpClientExchInit(init);
    } else {
      mpSend({ type:'relay', target: seat, data: { k:'exchange_init', ...init }});
    }
  }
}

function _mpBuildExchInit(seat, hand, exchanges, rankings) {
  let role = { type: 'middle' };
  for (const e of exchanges) {
    if (e.winner === seat) {
      role = { type:'pick', count:e.count, partnerSeat:e.loser, recv:e.loserGives };
      break;
    }
  }
  if (role.type === 'middle') {
    let totalCount = 0, allGave = [], firstPartner = null;
    for (const e of exchanges) {
      if (e.loser === seat) {
        totalCount += e.count;
        allGave = allGave.concat(e.loserGives);
        if (firstPartner === null) firstPartner = e.winner;
      }
    }
    if (totalCount > 0) {
      role = { type:'auto', count: totalCount, partnerSeat: firstPartner, gave: allGave };
    }
  }
  const myRank = (rankings.find(r => r.player === seat) || {}).rank;
  return {
    role: role.type,
    count: role.count || 0,
    partnerSeat: (role.partnerSeat == null) ? -1 : role.partnerSeat,
    partnerName: (role.partnerSeat != null && NAMES[role.partnerSeat])
                  ? NAMES[role.partnerSeat] : '',
    hand: hand.map(c => ({r:c.r, s:c.s, id:c.id})),
    recv: role.recv || [],
    gave: role.gave || [],
    myRank: (myRank == null) ? -1 : myRank,
  };
}

function mpClientExchInit(data) {
  _mpExchClient = { init: data, picked: new Set() };
  if (typeof showMpExchUI === 'function') showMpExchUI(data);
}

function mpSendExchPick(cardIds) {
  if (!_mpExchClient) return;
  if (MP.seat === 0) {
    _mpHostReceivePick(0, cardIds);
  } else {
    mpSend({ type:'relay', target: 0, data:{ k:'exchange_pick', cardIds }});
  }
  if (typeof showMpExchWaiting === 'function') showMpExchWaiting();
}

function _mpHostReceivePick(seat, cardIds) {
  if (!_mpExchHost) return;
  const exch = _mpExchHost.exchanges.find(e => e.winner === seat);
  if (!exch) return;
  const myHand = _mpExchHost.hands[seat];
  const picked = (cardIds || [])
    .map(id => myHand.find(c => c.id === id))
    .filter(Boolean);
  if (picked.length !== exch.count) {
    return;
  }
  _mpExchHost.picks[seat] = picked.map(c => ({r:c.r, s:c.s, id:c.id}));
  _mpExchHost.pendingPickers.delete(seat);

  picked.forEach(card => {
    const i = myHand.findIndex(c => c.id === card.id);
    if (i >= 0) myHand.splice(i, 1);
  });
  exch.loserGives.forEach(c => myHand.push({...c, sel:false}));

  const lh = _mpExchHost.hands[exch.loser];
  picked.forEach(c => lh.push({...c, sel:false}));

  if (_mpExchHost.pendingPickers.size === 0) {
    _mpExchHost.hands.forEach(h => h.sort((a,b) => STR[a.r]-STR[b.r]));
    for (let seat = 0; seat < MP.numPlayers; seat++) {
      const done = _mpBuildExchDone(seat);
      if (seat === 0) {
        mpClientExchDone(done);
      } else {
        mpSend({ type:'relay', target: seat, data:{ k:'exchange_done', ...done }});
      }
    }
  }
}

function _mpBuildExchDone(seat) {
  const exchanges = _mpExchHost.exchanges;
  let gave = [], received = [];
  for (const e of exchanges) {
    if (e.winner === seat) {
      gave = gave.concat(_mpExchHost.picks[seat] || []);
      received = received.concat(e.loserGives);
    }
    if (e.loser === seat) {
      gave = gave.concat(e.loserGives);
      received = received.concat(_mpExchHost.picks[e.winner] || []);
    }
  }
  return {
    hand: _mpExchHost.hands[seat].map(c => ({r:c.r, s:c.s, id:c.id})),
    gave, received,
  };
}

function mpClientExchDone(data) {
  if (!_mpExchClient) _mpExchClient = {};
  _mpExchClient.done = data;
  if (typeof showMpExchResult === 'function') showMpExchResult(data);
}

function mpExchReady() {
  if (MP.seat === 0) {
    _mpHostReceiveReady(0);
  } else {
    mpSend({ type:'relay', target: 0, data:{ k:'exchange_ready' }});
  }
  if (typeof showMpExchWaitingFinal === 'function') showMpExchWaitingFinal();
}

function _mpHostReceiveReady(seat) {
  if (!_mpExchHost) return;
  _mpExchHost.ready.add(seat);
  if (_mpExchHost.ready.size >= MP.numPlayers) {
    const finalHands = _mpExchHost.hands;
    _mpExchHost = null;
    _mpExchClient = null;
    document.getElementById('exchange-overlay').classList.add('h');
    startGameWithHands(finalHands);
  }
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
