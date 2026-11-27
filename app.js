// VERSI DEMO: tanpa server, tanpa kredensial. Data berasal dari data.js (fiktif).
const DEMO_USERS = {
  'editor@demo.id':  { pass: 'demo-editor',  editor: true  },
  'pelihat@demo.id': { pass: 'demo-pelihat', editor: false }
};
const STORE_KEY = 'arsip-demo-v1';
const SESSION_KEY = 'arsip-demo-user';
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };

// Struktur minimal hanya sebagai kerangka awal jika database kosong (tidak menyimpan data sensitif/arsip)
const EMPTY_SCHEMA = {
  title: 'Arsip Kontainer Purchasing',
  types: [
    { id: 'po', name: 'Purchase Order', color: '#22c55e' },
    { id: 'rs', name: 'Request Sheet', color: '#349e8a' },
    { id: 'mx', name: 'Campur (MIX)', color: '#9e8c74' },
    { id: 'qt', name: 'Quotation', color: '#d99b38' }
  ],
  racks: [
    { id: 'zx', name: 'Zona X', row: 'A', lv: 5, sl: 16, grp: 4 },
    { id: 'zy', name: 'Zona Y', row: 'B', lv: 5, sl: 16, grp: 4 },
    { id: 'zz', name: 'Zona Z', row: 'C', lv: 5, sl: 16, grp: 4 }
  ],
  boxes: {}
};

const $ = id => document.getElementById(id);
const key = (r, l, s) => `${r}|${l}|${s}`;
const blank = () => ({ t: '', label: '', period: '', moved: '', retain: '', note: '', isi: '' });
const cloneEmpty = () => JSON.parse(JSON.stringify(EMPTY_SCHEMA));

let S = cloneEmpty();
let rack = null;
let sel = null;
let filter = 'all';
let q = '';
let editing = false;
let dragId = null;
let dragBox = null;
let saveTimer = null;
let canEdit = false; // ditentukan server (fungsi is_editor), bukan dari kode

function setSync(msg, isErr = false) {
  const el = $('syncBadge');
  el.textContent = msg;
  el.style.color = isErr ? '#f87171' : 'var(--mute)';
}

// Simpan perubahan di browser pengunjung (localStorage); tidak dikirim ke mana pun
function save() {
  if (!canEdit) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const ok = lsSet(STORE_KEY, JSON.stringify(S));
    setSync(ok ? 'Tersimpan di browser ini' : 'Gagal menyimpan (penyimpanan browser diblokir)', !ok);
  }, 300);
}

function loadCloud() {
  let d = null;
  try { d = JSON.parse(lsGet(STORE_KEY) || 'null'); } catch (e) {}
  const ok = d && Array.isArray(d.racks) && Array.isArray(d.types) && d.types.length && d.boxes;
  S = ok ? d : JSON.parse(JSON.stringify(DEMO_DATA));
  setSync('Data demo dimuat');
  if (!R(rack)) rack = S.racks[0] ? S.racks[0].id : null;
  fillRackForm();
  renderAll();
}

function resetDemo() {
  try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  filter = 'all';
  sel = null;
  loadCloud();
}

const R = id => S.racks.find(r => r.id === id);
const T = id => S.types.find(t => t.id === id) || S.types[0];
const code = (r, l, s) => `${r.name}-L${l + 1}-S${s + 1}`;
const ink = h => {
  const n = parseInt(h.slice(1), 16);
  const y = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return y > 0.45 ? '#0b1912' : '#f8fafc';
};
const active = () => filter !== 'all' || q !== '';

function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function match(r, l, s) {
  const b = S.boxes[key(r.id, l, s)];
  if (filter === 'empty') return !b;
  if (filter !== 'all' && filter !== 'exp' && !(b && b.t === filter)) return false;
  if (filter === 'exp' && !(b && b.retain && b.retain < todayStr())) return false;
  if (q) {
    const txt = (b ? [b.label, b.period, b.note, b.isi].join(' ') : '') + ' ' + code(r, l, s);
    if (!txt.toLowerCase().includes(q)) return false;
  }
  return true;
}

function renderStats() {
  let cap = 0, f = 0, ex = 0;
  const td = todayStr();
  S.racks.forEach(r => {
    cap += r.lv * r.sl;
    for (let l = 0; l < r.lv; l++) {
      for (let s = 0; s < r.sl; s++) {
        const b = S.boxes[key(r.id, l, s)];
        if (b) {
          f++;
          if (b.retain && b.retain < td) ex++;
        }
      }
    }
  });
  $('sExp').textContent = ex;
  $('sFill').textContent = f;
  $('sFree').textContent = cap - f;
  $('sCap').textContent = cap;
}

function renderTypes() {
  const c = $('chips');
  c.textContent = '';
  [['all', 'Semua'], ...S.types.map(t => [t.id, t.name]), ['exp', 'Lewat retensi'], ['empty', 'Kosong']].forEach(([k, t]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = t;
    b.setAttribute('aria-pressed', k === filter);
    b.onclick = () => {
      filter = k;
      renderTypes();
      renderPlan();
      renderRack();
    };
    c.appendChild(b);
  });

  const lg = $('legend');
  lg.textContent = '';
  S.types.forEach(t => {
    const s = document.createElement('span');
    const i = document.createElement('i');
    i.style.background = t.color;
    s.append(i, t.name);
    lg.appendChild(s);
  });
  const e = document.createElement('span');
  const ei = document.createElement('i');
  ei.style.border = '1.5px dashed var(--empty)';
  e.append(ei, 'Kosong');
  lg.appendChild(e);

  const sel0 = $('fType');
  const v = sel0.value;
  sel0.textContent = '';
  S.types.forEach(t => {
    const o = document.createElement('option');
    o.value = t.id;
    o.textContent = t.name;
    sel0.appendChild(o);
  });
  sel0.value = v;
}

function renderTypeList() {
  const l = $('tlist');
  l.textContent = '';
  S.types.forEach(t => {
    const row = document.createElement('div');
    row.className = 'trow';
    const n = document.createElement('input');
    n.type = 'text';
    n.value = t.name;
    n.maxLength = 30;
    n.setAttribute('aria-label', 'Nama jenis');
    const c = document.createElement('input');
    c.type = 'color';
    c.value = t.color;
    c.setAttribute('aria-label', 'Warna ' + t.name);
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'btn warn';
    d.textContent = 'Hapus';
    d.disabled = S.types.length < 2;

    n.oninput = () => {
      t.name = n.value || 'Tanpa nama';
      save();
      renderTypes();
      renderPlan();
      renderRack();
    };
    c.oninput = () => {
      t.color = c.value;
      save();
      renderTypes();
      renderPlan();
      renderRack();
    };
    d.onclick = () => {
      S.types = S.types.filter(x => x !== t);
      Object.values(S.boxes).forEach(b => {
        if (b.t === t.id) b.t = S.types[0].id;
      });
      if (filter === t.id) filter = 'all';
      save();
      renderTypeList();
      renderTypes();
      renderPlan();
      renderRack();
      renderDetail();
    };
    row.append(n, c, d);
    l.appendChild(row);
  });
}

const LAJUR = 'ABCDEFGH';

function retHint() {
  const v = $('fRetain').value;
  $('retHint').textContent = v ? (v < todayStr() ? 'Sudah melewati masa retensi.' : 'Masih dalam masa retensi.') : '';
}

function selectSlot(rid, l, s, focus) {
  sel = { rid, l, s };
  renderRack();
  renderDetail();
  if (focus) {
    const e = document.querySelector('#elev .slot[aria-pressed=true]');
    if (e) e.focus({ preventScroll: true });
  }
  $('detail').scrollIntoView({
    block: 'nearest',
    behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth'
  });
}

function stepBox(d) {
  const r = sel && R(sel.rid);
  if (!r) return;
  const cur = sel.l * r.sl + sel.s;
  const all = [];
  for (let l = 0; l < r.lv; l++) {
    for (let s = 0; s < r.sl; s++) {
      if (S.boxes[key(r.id, l, s)]) all.push([l * r.sl + s, l, s]);
    }
  }
  const c = d > 0 ? all.find(x => x[0] > cur) : [...all].reverse().find(x => x[0] < cur);
  if (c) selectSlot(r.id, c[1], c[2], false);
}

function fillMoveLS(l, s) {
  const r = R($('mvRack').value);
  if (!r) return;
  const L = $('mvLv'), Sl = $('mvSl');
  L.textContent = '';
  Sl.textContent = '';
  for (let i = 0; i < r.lv; i++) {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = 'Level ' + (i + 1);
    L.appendChild(o);
  }
  for (let i = 0; i < r.sl; i++) {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = 'Slot ' + (i + 1);
    Sl.appendChild(o);
  }
  L.value = Math.min(l, r.lv - 1);
  Sl.value = Math.min(s, r.sl - 1);
}

function fillMove() {
  if (!sel || !R(sel.rid)) return;
  const mr = $('mvRack');
  mr.textContent = '';
  S.racks.forEach(r => {
    const o = document.createElement('option');
    o.value = r.id;
    o.textContent = r.name;
    mr.appendChild(o);
  });
  mr.value = sel.rid;
  fillMoveLS(sel.l, sel.s);
}

function moveBox(a, b) {
  if (!canEdit) return;
  const ra = R(a.rid), rb = R(b.rid);
  if (!ra || !rb || b.l < 0 || b.s < 0 || b.l >= rb.lv || b.s >= rb.sl) return;
  const ka = key(a.rid, a.l, a.s), kb = key(b.rid, b.l, b.s);
  if (ka === kb) return;
  const x = S.boxes[ka];
  if (!x) return;
  const y = S.boxes[kb];
  S.boxes[kb] = x;
  if (y) S.boxes[ka] = y;
  else delete S.boxes[ka];

  save();
  sel = { rid: b.rid, l: b.l, s: b.s };
  rack = b.rid;
  fillRackForm();
  renderStats();
  renderPlan();
  renderRack();
  renderDetail();
  $('mvMsg').textContent = y
    ? `Ditukar dengan ${y.label || 'box lain'}.`
    : `Box dipindahkan ke ${rb.name} L${b.l + 1} S${b.s + 1}.`;
}

function moveToRack(rid) {
  if (!canEdit) return;
  const r = R(rid);
  if (!r || !dragBox) return;
  for (let l = 0; l < r.lv; l++) {
    for (let s = 0; s < r.sl; s++) {
      if (!S.boxes[key(rid, l, s)]) {
        moveBox(dragBox, { rid, l, s });
        return;
      }
    }
  }
  if (sel && $('mvMsg')) $('mvMsg').textContent = `Rak ${r.name} sudah penuh.`;
}

$('mvRack').onchange = () => fillMoveLS(0, 0);
$('dPrev').onclick = () => stepBox(-1);
$('dNext').onclick = () => stepBox(1);
$('dClose').onclick = () => {
  sel = null;
  renderRack();
  renderDetail();
};
$('fRetain').addEventListener('input', retHint);
$('mvGo').onclick = () => {
  if (sel) moveBox(sel, { rid: $('mvRack').value, l: +$('mvLv').value, s: +$('mvSl').value });
};

[...LAJUR].forEach((c, i) => {
  const o = document.createElement('option');
  o.value = c;
  o.textContent = 'Lajur ' + (i + 1);
  $('rRow').appendChild(o);
});

function renderPlan() {
  const last = Math.max(-1, ...S.racks.map(r => LAJUR.indexOf(r.row)));
  const nRows = Math.min(LAJUR.length, Math.max(1, last + 1 + (editing && last < LAJUR.length - 1 ? 1 : 0)));
  const cnt = i => S.racks.filter(r => r.row === LAJUR[i]).length;
  let mx = 1;
  for (let i = 0; i < nRows; i++) mx = Math.max(mx, cnt(i));
  const n = mx + (editing ? 1 : 0);
  $('cont').style.minWidth = (n * 240 + 100) + 'px';
  const wrap = $('rows');
  wrap.textContent = '';
  let shown = 0;

  for (let ri = 0; ri < nRows; ri++) {
    const side = LAJUR[ri];
    if (!editing && !cnt(ri)) continue;
    if (shown++) {
      const a = document.createElement('div');
      a.className = 'aisle';
      a.textContent = 'Lorong';
      wrap.appendChild(a);
    }
    const row = document.createElement('div');
    row.className = 'row';
    row.style.gridTemplateColumns = `repeat(${n}, minmax(220px, 1fr))`;
    row.ondragover = e => { if (editing && dragId) e.preventDefault(); };
    row.ondrop = e => { if (editing && dragId) { e.preventDefault(); moveTo(dragId, null, side); } };

    S.racks.filter(r => r.row === side).forEach(r => {
      let filled = 0, hits = 0;
      for (let l = 0; l < r.lv; l++) {
        for (let s = 0; s < r.sl; s++) {
          if (S.boxes[key(r.id, l, s)]) filled++;
          if (match(r, l, s)) hits++;
        }
      }
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'rack' + (active() ? ' dim' : '');
      el.setAttribute('aria-pressed', r.id === rack);
      el.setAttribute('aria-label', `Rak ${r.name}, ${filled} dari ${r.lv * r.sl} terisi`);

      const t = document.createElement('div');
      t.className = 't';
      const b = document.createElement('b');
      const sp = document.createElement('span');
      b.textContent = r.name;
      sp.textContent = active() ? `${hits} cocok` : `${filled}/${r.lv * r.sl}`;
      t.append(b, sp);

      const mini = document.createElement('div');
      mini.className = 'mini';
      mini.style.gridTemplateColumns = `repeat(${r.sl}, 1fr)`;
      for (let l = 0; l < r.lv; l++) {
        for (let s = 0; s < r.sl; s++) {
          const bx = S.boxes[key(r.id, l, s)];
          const i = document.createElement('i');
          if (bx) i.style.background = T(bx.t).color;
          if (active() && match(r, l, s)) i.className = 'hit';
          mini.appendChild(i);
        }
      }

      el.append(t, mini);
      el.onclick = () => selectRack(r.id);
      el.addEventListener('dragover', e => { if (dragBox) { e.preventDefault(); el.classList.add('over'); } });
      el.addEventListener('dragleave', () => el.classList.remove('over'));
      el.addEventListener('drop', e => {
        if (dragBox) {
          e.preventDefault();
          e.stopPropagation();
          el.classList.remove('over');
          moveToRack(r.id);
        }
      });

      if (editing) {
        el.draggable = true;
        el.ondragstart = e => {
          dragId = r.id;
          e.dataTransfer.effectAllowed = 'move';
          try { e.dataTransfer.setData('text/plain', r.id); } catch (_) {}
        };
        el.ondragend = () => {
          dragId = null;
          document.querySelectorAll('.over').forEach(x => x.classList.remove('over'));
        };
        el.ondragover = e => { if (dragId && dragId !== r.id) { e.preventDefault(); el.classList.add('over'); } };
        el.ondragleave = () => el.classList.remove('over');
        el.ondrop = e => {
          e.preventDefault();
          e.stopPropagation();
          if (dragId && dragId !== r.id) moveTo(dragId, r.id, r.row);
        };
      }
      row.appendChild(el);
    });

    if (editing) {
      const a = document.createElement('button');
      a.type = 'button';
      a.className = 'addr';
      a.textContent = '+ Rak';
      a.onclick = () => addRack(side);
      row.appendChild(a);
    }
    wrap.appendChild(row);
  }
}

function renderRack() {
  const r = R(rack);
  const el = $('elev');
  el.textContent = '';
  if (!r) {
    $('rackTitle').textContent = 'Belum ada rak';
    $('rackSub').textContent = 'Aktifkan Ubah denah lalu tekan + Rak untuk menambah rak.';
    $('rset').style.visibility = 'hidden';
    return;
  }
  $('rset').style.visibility = '';
  let f = 0;
  for (let l = 0; l < r.lv; l++) {
    for (let s = 0; s < r.sl; s++) {
      if (S.boxes[key(r.id, l, s)]) f++;
    }
  }
  $('rackTitle').textContent = 'Rak ' + r.name;
  $('rackSub').textContent = `${f} dari ${r.lv * r.sl} slot terisi · L1 paling atas, L${r.lv} paling bawah`;
  el.style.minWidth = (r.sl * 70 + 40 + (r.grp ? (r.sl / r.grp) * 14 : 0)) + 'px';

  const G = r.grp > 0 ? r.grp : 0;
  const tpl = () => '34px ' + Array.from({ length: r.sl }, (_, s) => (G && s > 0 && s % G === 0 ? '14px ' : '') + '1fr').join(' ');

  if (G) {
    const hd = document.createElement('div');
    hd.className = 'lv';
    hd.style.gridTemplateColumns = tpl();
    hd.appendChild(document.createElement('span'));
    for (let s = 0; s < r.sl; s++) {
      if (s > 0 && s % G === 0) hd.appendChild(document.createElement('span'));
      if (s % G === 0) {
        const x = document.createElement('span');
        x.className = 'hint';
        x.style.justifyContent = 'center';
        x.style.gridColumn = 'span ' + G;
        x.textContent = 'Baris ' + (Math.ceil(r.sl / G) - s / G);
        hd.appendChild(x);
      }
    }
    el.appendChild(hd);
  }

  for (let l = 0; l < r.lv; l++) {
    const row = document.createElement('div');
    row.className = 'lv';
    row.style.gridTemplateColumns = tpl();
    const n = document.createElement('span');
    n.textContent = 'L' + (l + 1);
    row.appendChild(n);

    for (let s = 0; s < r.sl; s++) {
      if (G && s > 0 && s % G === 0) row.appendChild(document.createElement('span'));
      const b = S.boxes[key(r.id, l, s)];
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'slot' + (b ? '' : ' empty') + (active() ? (match(r, l, s) ? ' hit' : ' dim') : '');
      if (b) {
        const t = T(b.t);
        c.style.background = t.color;
        c.style.color = ink(t.color);
      }
      c.setAttribute('aria-pressed', !!sel && sel.rid === r.id && sel.l === l && sel.s === s);

      const a = document.createElement('span');
      a.textContent = b ? (b.label || 'Tanpa label') : 'Kosong';
      const m = document.createElement('small');
      m.textContent = 'S' + (s + 1);
      c.append(a, m);
      c.onclick = () => selectSlot(r.id, l, s, true);

      if (b) {
        c.draggable = true;
        c.ondragstart = e => {
          dragBox = { rid: r.id, l, s };
          e.dataTransfer.effectAllowed = 'move';
          try { e.dataTransfer.setData('text/plain', 'box'); } catch (_) {}
        };
        c.ondragend = () => {
          dragBox = null;
          document.querySelectorAll('.over').forEach(x => x.classList.remove('over'));
        };
      }
      c.ondragover = e => { if (dragBox) { e.preventDefault(); c.classList.add('over'); } };
      c.ondragleave = () => c.classList.remove('over');
      c.ondrop = e => {
        if (dragBox) {
          e.preventDefault();
          e.stopPropagation();
          c.classList.remove('over');
          moveBox(dragBox, { rid: r.id, l, s });
        }
      };
      row.appendChild(c);
    }
    el.appendChild(row);
  }
}

function fillRackForm() {
  const r = R(rack);
  if (!r) return;
  $('rName').value = r.name;
  $('rRow').value = r.row;
  $('rLv').value = r.lv;
  $('rSl').value = r.sl;
}

function renderDetail() {
  const r = sel && R(sel.rid);
  const ok = !!r && sel.l < r.lv && sel.s < r.sl;
  $('dEmpty').hidden = ok;
  $('dForm').hidden = !ok;
  $('detail').classList.toggle('open', ok);
  if (!ok) return;

  const b = S.boxes[key(sel.rid, sel.l, sel.s)];
  $('dCode').textContent = 'Lokasi ' + code(r, sel.l, sel.s);
  $('mvBox').hidden = !b;
  if (b) fillMove();
  $('fStatus').value = b ? '1' : '0';

  const x = b || blank();
  $('fType').value = b ? b.t : S.types[0].id;
  $('fLabel').value = x.label;
  $('fPeriod').value = x.period;
  $('fMoved').value = x.moved;
  $('fRetain').value = x.retain;
  $('fNote').value = x.note;
  $('fIsi').value = x.isi || '';
  retHint();

  ['fType', 'fLabel', 'fPeriod', 'fMoved', 'fRetain', 'fNote', 'fIsi'].forEach(i => {
    $(i).disabled = !b || !canEdit;
  });
  $('fStatus').disabled = !canEdit;
  ['mvGo', 'mvRack', 'mvLv', 'mvSl'].forEach(i => { $(i).disabled = !canEdit; });
}

function renderAll() {
  $('h1').textContent = S.title;
  document.title = S.title;
  renderStats();
  renderTypes();
  renderPlan();
  renderRack();
  renderDetail();
}

function selectRack(id) {
  rack = id;
  sel = null;
  fillRackForm();
  renderPlan();
  renderRack();
  renderDetail();
}

function addRack(row) {
  let n = S.racks.filter(r => r.row === row).length + 1;
  let name = row + n;
  while (S.racks.some(r => r.name === name)) name = row + (++n);
  const r = { id: 'r' + Math.random().toString(36).slice(2, 7), name, row, lv: 5, sl: 16, grp: 4 };
  S.racks.push(r);
  save();
  renderStats();
  selectRack(r.id);
}

function moveTo(id, beforeId, row) {
  const r = R(id);
  S.racks = S.racks.filter(x => x !== r);
  r.row = row;
  const i = beforeId ? S.racks.findIndex(x => x.id === beforeId) : -1;
  if (i < 0) S.racks.push(r);
  else S.racks.splice(i, 0, r);
  save();
  if (rack === id) fillRackForm();
  renderPlan();
}

function shift(d) {
  const r = R(rack);
  if (!r) return;
  const same = S.racks.filter(x => x.row === r.row);
  const i = same.indexOf(r);
  const o = same[i + d];
  if (!o) return;
  const a = S.racks.indexOf(r);
  const b = S.racks.indexOf(o);
  S.racks[a] = o;
  S.racks[b] = r;
  save();
  renderPlan();
}

function twoStep(btn, label, fn) {
  let t;
  btn.onclick = () => {
    if (btn.dataset.arm) {
      clearTimeout(t);
      btn.dataset.arm = '';
      btn.textContent = label;
      fn();
    } else {
      btn.dataset.arm = '1';
      btn.textContent = 'Klik lagi untuk memastikan';
      t = setTimeout(() => {
        btn.dataset.arm = '';
        btn.textContent = label;
      }, 3000);
    }
  };
}

twoStep($('rDel'), 'Hapus rak', () => {
  const r = R(rack);
  if (!r) return;
  Object.keys(S.boxes).forEach(k => {
    if (k.startsWith(r.id + '|')) delete S.boxes[k];
  });
  S.racks = S.racks.filter(x => x !== r);
  save();
  renderStats();
  selectRack(S.racks[0] ? S.racks[0].id : null);
});

twoStep($('reset'), 'Kembalikan data demo', resetDemo);

$('rLeft').onclick = () => shift(-1);
$('rRight').onclick = () => shift(1);
$('rName').oninput = e => {
  const r = R(rack);
  if (!r) return;
  r.name = e.target.value || '?';
  save();
  renderPlan();
  renderRack();
  renderDetail();
};
$('rRow').onchange = e => {
  const r = R(rack);
  if (!r) return;
  r.row = e.target.value;
  S.racks = S.racks.filter(x => x !== r);
  S.racks.push(r);
  save();
  renderPlan();
};

const dim = (id, k, max) => $(id).oninput = e => {
  const r = R(rack);
  const v = parseInt(e.target.value, 10);
  if (!r || !(v >= 1)) return;
  r[k] = Math.min(v, max);
  save();
  renderStats();
  renderPlan();
  renderRack();
  renderDetail();
};
dim('rLv', 'lv', 8);
dim('rSl', 'sl', 16);

function edit() {
  if (!sel) return;
  const k = key(sel.rid, sel.l, sel.s);
  let b = S.boxes[k];
  if ($('fStatus').value === '1') {
    if (!b) b = S.boxes[k] = { ...blank(), t: S.types[0].id };
    b.t = $('fType').value;
    b.label = $('fLabel').value;
    b.period = $('fPeriod').value;
    b.moved = $('fMoved').value;
    b.retain = $('fRetain').value;
    b.note = $('fNote').value;
    b.isi = $('fIsi').value;
  } else {
    delete S.boxes[k];
  }
  save();
  renderStats();
  renderPlan();
  renderRack();
  if (!!b !== !$('fType').disabled) renderDetail();
}

['fStatus', 'fType', 'fLabel', 'fPeriod', 'fMoved', 'fRetain', 'fNote', 'fIsi'].forEach(i => {
  $(i).addEventListener('input', edit);
});

$('q').oninput = e => {
  q = e.target.value.trim().toLowerCase();
  renderPlan();
  renderRack();
};

$('titleIn').oninput = e => {
  S.title = e.target.value || 'Denah Arsip';
  $('h1').textContent = S.title;
  document.title = S.title;
  save();
};

$('tAdd').onclick = () => {
  const c = ['#8a6fb0', '#5a9a6a', '#b95c5c', '#c2b13c', '#3c9fa8'];
  S.types.push({
    id: 't' + Math.random().toString(36).slice(2, 6),
    name: 'Jenis baru',
    color: c[S.types.length % c.length]
  });
  save();
  renderTypeList();
  renderTypes();
};

$('editBtn').onclick = () => {
  editing = !editing;
  $('editBtn').setAttribute('aria-pressed', editing);
  $('editBtn').textContent = editing ? 'Selesai mengubah' : 'Ubah denah';
  document.body.classList.toggle('edit', editing);
  if (editing) {
    $('titleIn').value = S.title;
    renderTypeList();
    fillRackForm();
  }
  renderPlan();
};

// Peran demo ditentukan dari akun yang dipilih (di versi asli: server + RLS)
function applyRole(email) {
  canEdit = !!(DEMO_USERS[email] && DEMO_USERS[email].editor);
  document.body.classList.toggle('viewer', !canEdit);
  $('editBtn').hidden = !canEdit;
  if (!canEdit && editing) { editing = false; document.body.classList.remove('edit'); }
  $('roleBadge').textContent = canEdit ? 'Editor' : 'Hanya lihat';
}

function showSession(email) {
  const on = !!email;
  $('authOverlay').hidden = on;
  $('appWrap').hidden = !on;
  if (on) { applyRole(email); loadCloud(); }
  else { canEdit = false; S = cloneEmpty(); }
}

$('authBox').onsubmit = e => {
  e.preventDefault();
  const em = $('loginEmail').value.trim().toLowerCase();
  const u = DEMO_USERS[em];
  if (u && u.pass === $('loginPass').value) {
    try { sessionStorage.setItem(SESSION_KEY, em); } catch (x) {}
    $('authErr').textContent = '';
    showSession(em);
  } else {
    $('authErr').textContent = 'Email atau password salah. Gunakan akun demo di atas.';
  }
};

document.querySelectorAll('[data-fill]').forEach(b => {
  b.onclick = () => {
    const em = b.dataset.fill === 'editor' ? 'editor@demo.id' : 'pelihat@demo.id';
    $('loginEmail').value = em;
    $('loginPass').value = DEMO_USERS[em].pass;
  };
});

$('logoutBtn').onclick = () => {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (x) {}
  editing = false;
  document.body.classList.remove('edit');
  showSession(null);
};

$('refreshBtn').onclick = () => loadCloud();
$('demoReset').onclick = () => resetDemo();

let savedUser = null;
try { savedUser = sessionStorage.getItem(SESSION_KEY); } catch (x) {}
showSession(DEMO_USERS[savedUser] ? savedUser : null);

// Lightbox Panduan
$('openGuideBtn').onclick = () => { $('guideModal').hidden = false; };
$('closeGuideBtn').onclick = () => { $('guideModal').hidden = true; };
$('guideModal').onclick = () => { $('guideModal').hidden = true; };
$('guideModalInner').onclick = e => e.stopPropagation();


// Ekspor data ke CSV (hanya untuk pengguna yang sudah login)
$('exportBtn').onclick = () => {
  const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const head = ['Rak', 'Level', 'Slot', 'Label', 'Jenis', 'Periode', 'Dipindah', 'Retensi', 'Catatan', 'Isi'];
  const rows = [];
  S.racks.forEach(r => {
    for (let l = 0; l < r.lv; l++) for (let s = 0; s < r.sl; s++) {
      const b = S.boxes[key(r.id, l, s)];
      if (b) rows.push([r.name, l + 1, s + 1, b.label, T(b.t).name, b.period, b.moved, b.retain, b.note, b.isi]);
    }
  });
  const csv = '\ufeff' + [head, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const el = document.createElement('a');
  el.href = url; el.download = 'arsip-kontainer-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(el); el.click(); el.remove(); URL.revokeObjectURL(url);
};

// Mode penuh untuk panel rak
$('fullBtn').onclick = () => {
  const card = $('rackTitle').closest('.card');
  if (document.fullscreenElement) document.exitFullscreen();
  else if (card.requestFullscreen) card.requestFullscreen();
};

if (!document.documentElement.requestFullscreen) $('fullBtn').hidden = true; // iPhone tidak mendukung
