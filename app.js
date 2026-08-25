/* MediaLog — local-first media tracker.
 *
 * Data lives in real files: <data folder>/{region}.json, one file per region.
 * The page reaches them through the File System Access API, so there is no
 * server and no build step — open index.html, pick the folder once, and every
 * edit is written straight to disk.
 *
 * Browsers without the API (Firefox, Safari) fall back to read-only mode:
 * the JSON is fetched over http and the editing controls stay disabled, so
 * there is never any doubt about where the authoritative copy is.
 */

const REGIONS    = ['日本', '中国', '韩国', '欧美'];
const CATEGORIES = ['动画', '漫画', '电影'];
const STATUSES   = ['未完结', '完结'];
const WATCHES    = ['未看', '看着', '看完了'];

const WATCH_CLASS  = { '未看': 'w-unseen', '看着': 'w-going', '看完了': 'w-done' };
const STATUS_CLASS = { '未完结': 's-ongoing', '完结': 's-ended' };
const CAT_CLASS    = { '动画': 'c-anime', '漫画': 'c-manga', '电影': 'c-movie' };

const RANK = {
  status:   { '未完结': 0, '完结': 1 },
  category: { '动画': 0, '漫画': 1, '电影': 2 },
  watch:    { '未看': 0, '看着': 1, '看完了': 2 },
};

const COLLATOR = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' });
const HAS_FS = typeof window.showDirectoryPicker === 'function';

/** region -> { region, version, updatedAt, items: [] } */
const store = Object.fromEntries(
  REGIONS.map(r => [r, { region: r, version: 1, updatedAt: null, items: [] }])
);

let dirHandle = null;
let readOnly = true;
/* A folder we already remember, still waiting for the one permission click
 * Chrome requires at the start of a new session. Re-picking it in the file
 * browser is never necessary — only re-authorising it. */
let pendingHandle = null;

const state = {
  region: REGIONS[0],
  sortKey: 'name',
  sortDir: 'asc',
  q: '',
  filters: { category: new Set(), status: new Set(), watch: new Set() },
};

const $ = sel => document.querySelector(sel);
const el = {
  tabs: $('#tabs'), rows: $('#rows'), grid: $('#grid'), empty: $('#empty'),
  filters: $('#filters'), search: $('#search'), stats: $('#stats'),
  clear: $('#btnClear'), conn: $('#conn'), connText: $('#connText'),
  connect: $('#btnConnect'), neu: $('#btnNew'), exp: $('#btnExport'),
  dlg: $('#dlg'), form: $('#form'), dlgTitle: $('#dlgTitle'),
  del: $('#btnDelete'), cancel: $('#btnCancel'), fRegion: $('#fRegion'),
  toast: $('#toast'),
};

/* ------------------------------------------------------------------ utils */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** First number inside a free-form progress string ("第41卷" -> 41). */
function progNum(p) {
  const m = String(p ?? '').match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

let toastTimer;
function toast(msg, isError = false) {
  el.toast.textContent = msg;
  el.toast.classList.toggle('err', isError);
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, isError ? 5000 : 2200);
}

/* --------------------------------------------------- folder handle storage */

/* The directory handle cannot go in localStorage — it only survives in IndexedDB.
 * Remembering the folder is only a convenience, so every call here is wrapped in
 * a timeout: where site data is blocked (private windows, hardened settings,
 * headless Chrome) `open()` simply never settles, and an unguarded await would
 * leave the whole table blank forever. */
const IDB_TIMEOUT = 3000;

function withTimeout(promise, ms, fallback) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise(res => { timer = setTimeout(() => res(fallback), ms); }),
  ]);
}

function idb() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('medialog', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
    req.onblocked = () => rej(new Error('IndexedDB blocked'));
  });
}

function idbGet(key) {
  const run = idb().then(db => new Promise((res, rej) => {
    const req = db.transaction('kv', 'readonly').objectStore('kv').get(key);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));
  return withTimeout(run.catch(() => null), IDB_TIMEOUT, null);
}

function idbSet(key, val) {
  const run = idb().then(db => new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(val, key);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  }));
  return withTimeout(run.catch(() => false), IDB_TIMEOUT, false);
}

/* ------------------------------------------------------------------- i/o */

function normalise(raw, region) {
  const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
  return {
    region,
    version: raw?.version ?? 1,
    updatedAt: raw?.updatedAt ?? null,
    items: items.map(it => ({
      id: it.id || crypto.randomUUID(),
      name: it.name ?? '',
      progress: it.progress ?? '',
      watch: WATCHES.includes(it.watch) ? it.watch : '看着',
      status: STATUSES.includes(it.status) ? it.status : '未完结',
      category: CATEGORIES.includes(it.category) ? it.category : '动画',
      url: it.url ?? '',
      note: it.note ?? '',
      createdAt: it.createdAt ?? nowIso(),
      updatedAt: it.updatedAt ?? it.createdAt ?? nowIso(),
    })),
  };
}

async function loadFromFolder() {
  for (const region of REGIONS) {
    try {
      const fh = await dirHandle.getFileHandle(`${region}.json`, { create: true });
      const text = (await (await fh.getFile()).text()).trim();
      store[region] = text
        ? normalise(JSON.parse(text), region)
        : normalise({ items: [] }, region);
    } catch (err) {
      console.error(`读取 ${region}.json 失败`, err);
      toast(`读取 ${region}.json 失败：${err.message}`, true);
      store[region] = normalise({ items: [] }, region);
    }
  }
}

/** Read-only path for browsers with no File System Access API. */
async function loadFromFetch() {
  let ok = 0;
  for (const region of REGIONS) {
    try {
      const res = await fetch(`data/${encodeURIComponent(region)}.json`, { cache: 'no-store' });
      if (!res.ok) continue;
      store[region] = normalise(await res.json(), region);
      ok++;
    } catch { /* file:// or missing file — leave the region empty */ }
  }
  return ok > 0;
}

const pendingWrites = new Map();

/** Debounced write of one region file. Rejects loudly — a silent failure here
 *  would mean the user thinks their edit is on disk when it is not. */
function saveRegion(region) {
  if (readOnly || !dirHandle) return;
  clearTimeout(pendingWrites.get(region));
  pendingWrites.set(region, setTimeout(async () => {
    try {
      const payload = store[region];
      payload.updatedAt = nowIso();
      const fh = await dirHandle.getFileHandle(`${region}.json`, { create: true });
      const w = await fh.createWritable();
      await w.write(JSON.stringify(payload, null, 2) + '\n');
      await w.close();
    } catch (err) {
      console.error(err);
      toast(`保存 ${region}.json 失败：${err.message}`, true);
    }
  }, 250));
}

async function verifyPermission(handle, interactive) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if (!interactive) return false;
  return (await handle.requestPermission(opts)) === 'granted';
}

function setConnected(on, label) {
  readOnly = !on;
  el.conn.classList.toggle('ok', on);
  el.conn.classList.toggle('warn', !on);
  el.connText.textContent = label;
  el.connect.textContent = on ? '更换文件夹' : (HAS_FS ? '连接文件夹' : '不支持');
  el.connect.disabled = !HAS_FS;
  el.neu.disabled = !on;
  el.neu.title = on ? '' : '先连接数据文件夹才能编辑';
}

/** One-click re-authorisation of the remembered folder — no file browser. */
async function reconnectSaved() {
  if (!pendingHandle) return connectFolder();
  try {
    if (!(await verifyPermission(pendingHandle, true))) {
      pendingHandle = null;                 // fall back to a full pick next click
      setConnected(false, '未连接数据文件夹');
      toast('未获得授权，请点「连接文件夹」重新选择', true);
      return;
    }
    dirHandle = pendingHandle;
    pendingHandle = null;
    await loadFromFolder();
    setConnected(true, `${dirHandle.name}/`);
    render();
    toast('已重新连接');
  } catch (err) {
    toast(`重新连接失败：${err.message}`, true);
  }
}

async function connectFolder() {
  try {
    const handle = await window.showDirectoryPicker({ id: 'medialog', mode: 'readwrite' });
    if (!(await verifyPermission(handle, true))) {
      toast('未获得文件夹写入权限', true);
      return;
    }
    dirHandle = handle;
    const remembered = await idbSet('dir', handle);
    await loadFromFolder();
    setConnected(true, `${handle.name}/`);
    render();
    toast(remembered
      ? '已连接，改动会直接写入 JSON 文件'
      : '已连接，但浏览器无法记住文件夹，下次需重新选择');
  } catch (err) {
    if (err.name !== 'AbortError') toast(`连接失败：${err.message}`, true);
  }
}

/* ------------------------------------------------------------- rendering */

function visibleItems() {
  const items = store[state.region].items;
  const q = state.q.trim().toLowerCase();
  const f = state.filters;

  const filtered = items.filter(it => {
    if (f.category.size && !f.category.has(it.category)) return false;
    if (f.status.size && !f.status.has(it.status)) return false;
    if (f.watch.size && !f.watch.has(it.watch)) return false;
    if (q && !(it.name.toLowerCase().includes(q) || it.note.toLowerCase().includes(q))) return false;
    return true;
  });

  return sortItems(filtered, state.sortKey, state.sortDir);
}

function compare(a, b, key) {
  switch (key) {
    case 'name':
      return COLLATOR.compare(a.name, b.name);
    case 'progress': {
      const x = progNum(a.progress), y = progNum(b.progress);
      if (x !== null && y !== null && x !== y) return x - y;
      return RANK.watch[a.watch] - RANK.watch[b.watch];
    }
    case 'status':
      return RANK.status[a.status] - RANK.status[b.status];
    case 'category':
      return RANK.category[a.category] - RANK.category[b.category];
    case 'createdAt':
    case 'updatedAt':
      return String(a[key]).localeCompare(String(b[key]));
    default:
      return 0;
  }
}

function sortItems(items, key, dir) {
  const sign = dir === 'asc' ? 1 : -1;
  return items.slice().sort((a, b) => {
    // Rows with no numeric progress stay at the bottom in both directions.
    if (key === 'progress') {
      const x = progNum(a.progress), y = progNum(b.progress);
      if (x === null && y !== null) return 1;
      if (y === null && x !== null) return -1;
    }
    return sign * compare(a, b, key) || COLLATOR.compare(a.name, b.name);
  });
}

function renderTabs() {
  el.tabs.innerHTML = REGIONS.map(r => `
    <button class="tab" role="tab" data-region="${esc(r)}"
            aria-selected="${r === state.region}">
      ${esc(r)}<span class="n">${store[r].items.length}</span>
    </button>`).join('');
}

function renderFilters() {
  const group = (kind, values) => values.map(v => `
    <button class="chip" data-kind="${kind}" data-value="${esc(v)}"
            aria-pressed="${state.filters[kind].has(v)}">${esc(v)}</button>`).join('');

  el.filters.innerHTML =
    group('category', CATEGORIES) + '<i class="chip-sep"></i>' +
    group('status', STATUSES) + '<i class="chip-sep"></i>' +
    group('watch', WATCHES);

  const active = Boolean(state.q) || Object.values(state.filters).some(s => s.size);
  el.clear.hidden = !active;
}

function renderHeaders() {
  el.grid.querySelectorAll('th[data-sort]').forEach(th => {
    if (th.dataset.sort === state.sortKey) {
      th.setAttribute('aria-sort', state.sortDir === 'asc' ? 'ascending' : 'descending');
    } else {
      th.removeAttribute('aria-sort');
    }
  });
}

function rowHtml(it) {
  const name = it.url
    ? `<a href="${esc(it.url)}" target="_blank" rel="noreferrer noopener">${esc(it.name)}</a>`
    : esc(it.name);
  const num = it.progress
    ? `<span class="num">${esc(it.progress)}</span>`
    : '<span class="num none">—</span>';

  return `<tr data-id="${esc(it.id)}">
    <td><div class="name">${name}</div>${
      it.note ? `<div class="note">${esc(it.note)}</div>` : ''}</td>
    <td><div class="prog">${num}<span class="pill ${WATCH_CLASS[it.watch]}">${esc(it.watch)}</span></div></td>
    <td><span class="pill ${STATUS_CLASS[it.status]}">${esc(it.status)}</span></td>
    <td><span class="pill ${CAT_CLASS[it.category]}">${esc(it.category)}</span></td>
    <td class="date">${fmtDate(it.createdAt)}</td>
    <td class="date">${fmtDate(it.updatedAt)}</td>
    <td><button class="edit" data-edit="${esc(it.id)}" title="编辑">✎</button></td>
  </tr>`;
}

function render() {
  renderTabs();
  renderFilters();
  renderHeaders();

  const items = visibleItems();
  el.rows.innerHTML = items.map(rowHtml).join('');
  const total = store[state.region].items.length;

  el.grid.hidden = total === 0;
  el.empty.hidden = items.length !== 0;
  el.empty.textContent = total === 0
    ? (readOnly ? '没有数据。连接数据文件夹后即可新增。' : `${state.region} 还没有条目，点右上角「＋ 新增」开始。`)
    : '没有符合筛选条件的条目。';

  const counts = k => store[state.region].items.reduce(
    (m, it) => (m[it[k]] = (m[it[k]] || 0) + 1, m), {});
  const w = counts('watch');
  el.stats.innerHTML = `<b>${items.length}</b>/${total} · ` +
    `看着 <b>${w['看着'] || 0}</b> · 看完了 <b>${w['看完了'] || 0}</b> · 未看 <b>${w['未看'] || 0}</b>`;
}

/* ------------------------------------------------------------ modal / CRUD */

let editing = null;   // { id, region } while editing, null while creating

function openDialog(item) {
  editing = item ? { id: item.id, region: state.region } : null;
  el.dlgTitle.textContent = item ? '编辑条目' : '新增条目';
  el.del.hidden = !item;

  el.fRegion.innerHTML = REGIONS.map(r =>
    `<option${r === state.region ? ' selected' : ''}>${esc(r)}</option>`).join('');

  const f = el.form;
  f.name.value     = item?.name ?? '';
  f.progress.value = item?.progress ?? '';
  f.watch.value    = item?.watch ?? '看着';
  f.status.value   = item?.status ?? '未完结';
  f.category.value = item?.category ?? (state.region === '欧美' ? '电影' : '动画');
  f.url.value      = item?.url ?? '';
  f.note.value     = item?.note ?? '';

  el.dlg.showModal();
  f.name.focus();
}

function submitDialog(ev) {
  ev.preventDefault();
  const f = el.form;
  const name = f.name.value.trim();
  if (!name) return;

  const fields = {
    name,
    progress: f.progress.value.trim(),
    watch: f.watch.value,
    status: f.status.value,
    category: f.category.value,
    url: f.url.value.trim(),
    note: f.note.value.trim(),
  };
  const target = f.region.value;
  const touched = new Set([target]);

  if (editing) {
    const from = editing.region;
    const list = store[from].items;
    const i = list.findIndex(x => x.id === editing.id);
    if (i === -1) return;
    const updated = { ...list[i], ...fields, updatedAt: nowIso() };
    if (target === from) {
      list[i] = updated;
    } else {
      list.splice(i, 1);              // moving between regions moves the file too
      store[target].items.push(updated);
      touched.add(from);
    }
  } else {
    const ts = nowIso();
    store[target].items.push({ id: crypto.randomUUID(), ...fields, createdAt: ts, updatedAt: ts });
  }

  touched.forEach(saveRegion);
  el.dlg.close();
  state.region = target;
  render();
  toast(editing ? '已保存' : `已添加到 ${target}`);
  editing = null;
}

function deleteCurrent() {
  if (!editing) return;
  const list = store[editing.region].items;
  const i = list.findIndex(x => x.id === editing.id);
  if (i === -1) return;
  if (!confirm(`删除「${list[i].name}」？此操作会立即写入 ${editing.region}.json。`)) return;
  list.splice(i, 1);
  saveRegion(editing.region);
  el.dlg.close();
  render();
  toast('已删除');
  editing = null;
}

/* --------------------------------------------------------------- backup
 *
 * Destination 1 is the data folder itself (every edit is already written
 * there, so `git commit data/` gives you full history).
 * Destination 2 is this snapshot — one bundled file of every region.
 *
 * A future "同步到 Google Drive" button plugs in right here: build the same
 * `snapshot()` payload, then POST it to the Drive files API with an OAuth
 * token. Nothing else in the app needs to change.
 */
function snapshot() {
  return {
    app: 'MediaLog',
    exportedAt: nowIso(),
    regions: Object.fromEntries(REGIONS.map(r => [r, store[r].items])),
  };
}

function exportSnapshot() {
  const stamp = fmtDate(nowIso()).replace(/-/g, '');
  const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `medialog-${stamp}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  const n = REGIONS.reduce((s, r) => s + store[r].items.length, 0);
  toast(`已导出 ${n} 条到 medialog-${stamp}.json`);
}

/* ---------------------------------------------------------------- events */

el.tabs.addEventListener('click', ev => {
  const tab = ev.target.closest('[data-region]');
  if (!tab) return;
  state.region = tab.dataset.region;
  render();
});

el.grid.addEventListener('click', ev => {
  const th = ev.target.closest('th[data-sort]');
  if (th) {
    const key = th.dataset.sort;
    if (state.sortKey === key) {
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortKey = key;
      // Dates are most useful newest-first; everything else reads better A→Z.
      state.sortDir = (key === 'createdAt' || key === 'updatedAt') ? 'desc' : 'asc';
    }
    render();
    return;
  }

  const btn = ev.target.closest('[data-edit]');
  if (btn) {
    if (readOnly) { toast('只读模式：先连接数据文件夹', true); return; }
    const item = store[state.region].items.find(x => x.id === btn.dataset.edit);
    if (item) openDialog(item);
  }
});

el.filters.addEventListener('click', ev => {
  const chip = ev.target.closest('.chip');
  if (!chip) return;
  const set = state.filters[chip.dataset.kind];
  const v = chip.dataset.value;
  set.has(v) ? set.delete(v) : set.add(v);
  render();
});

let searchTimer;
el.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.q = el.search.value; render(); }, 120);
});

el.clear.addEventListener('click', () => {
  state.q = '';
  el.search.value = '';
  Object.values(state.filters).forEach(s => s.clear());
  render();
});

el.connect.addEventListener('click', () => pendingHandle ? reconnectSaved() : connectFolder());
el.neu.addEventListener('click', () => openDialog(null));
el.exp.addEventListener('click', exportSnapshot);
el.form.addEventListener('submit', submitDialog);
el.cancel.addEventListener('click', () => { el.dlg.close(); editing = null; });
el.del.addEventListener('click', deleteCurrent);
el.dlg.addEventListener('close', () => { editing = null; });

document.addEventListener('keydown', ev => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key === 'k') {
    ev.preventDefault();
    el.search.focus();
    el.search.select();
  }
});

/* ------------------------------------------------------------------ boot */

(async function init() {
  el.fRegion.innerHTML = REGIONS.map(r => `<option>${esc(r)}</option>`).join('');

  if (!HAS_FS) {
    const found = await loadFromFetch();
    setConnected(false, found ? '只读模式（浏览器不支持写入）' : '只读模式');
    render();
    toast('此浏览器不支持写入本地文件夹，请用 Chrome / Edge 编辑', true);
    return;
  }

  try {
    const saved = await idbGet('dir');
    if (saved && await verifyPermission(saved, false)) {
      dirHandle = saved;
      await loadFromFolder();
      setConnected(true, `${saved.name}/`);
      render();
      return;
    }
    if (saved) {
      // Chrome drops the grant at the start of a new session. One click on the
      // remembered handle restores it — the folder picker stays closed.
      pendingHandle = saved;
      await loadFromFetch();
      setConnected(false, `点一下即可恢复 ${saved.name}/`);
      el.connect.textContent = '重新连接';
      render();
      return;
    }
  } catch (err) {
    console.error(err);
  }

  await loadFromFetch();
  setConnected(false, '未连接数据文件夹');
  render();
})();
