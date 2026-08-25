/* Google Drive backup for MediaLog.
 *
 * Keeps a plain "MediaLog" folder in your Drive holding the same four files
 * that live in data/ — 日本.json, 中国.json, 韩国.json, 欧美.json. Nothing is
 * transformed: what is uploaded is byte-for-byte what the local files hold, so
 * a restore is just a download.
 *
 * Scope is drive.file — this app can only ever see files it created itself. It
 * cannot read the rest of your Drive, which also means it cannot adopt a
 * "MediaLog" folder you made by hand; it always creates its own.
 *
 * Requires an http(s) origin: Google rejects file:// as an OAuth JavaScript
 * origin, so serve the folder (python -m http.server) before syncing.
 *
 * Loaded after app.js, so it shares REGIONS / store / readOnly / toast / etc.
 */

const GD = {
  SCOPE: 'https://www.googleapis.com/auth/drive.file',
  FOLDER: 'MediaLog',
  GIS: 'https://accounts.google.com/gsi/client',
  API: 'https://www.googleapis.com/drive/v3',
  UPLOAD: 'https://www.googleapis.com/upload/drive/v3',
  LS_CLIENT: 'medialog:gdrive:clientId',
  LS_FOLDER: 'medialog:gdrive:folderId',
  LS_LAST: 'medialog:gdrive:lastSync',
};

/* Access token lives in memory only — never in localStorage, where any script
 * on the origin could read it. One sign-in click per browser session is the
 * price, and Google usually makes it silent after the first consent. */
let gdToken = null;
let gdTokenClient = null;
let gdBusy = false;

const gd = {
  btn: document.querySelector('#btnDrive'),
  dlg: document.querySelector('#gdlg'),
  client: document.querySelector('#gdClient'),
  hint: document.querySelector('#gdHint'),
  status: document.querySelector('#gdStatus'),
  log: document.querySelector('#gdLog'),
  push: document.querySelector('#gdPush'),
  pull: document.querySelector('#gdPull'),
  close: document.querySelector('#gdClose'),
};

/* ------------------------------------------------------------- storage */

function lsGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, val); return true; } catch { return false; }
}
function lsDel(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

const gdClientId = () => (lsGet(GD.LS_CLIENT) || '').trim();

/* ------------------------------------------------------------- logging */

function gdLog(line, cls = '') {
  const at = new Date().toLocaleTimeString();
  gd.log.textContent += `[${at}] ${line}\n`;
  gd.log.scrollTop = gd.log.scrollHeight;
  if (cls) gd.log.className = 'gd-log ' + cls;
}

function gdClearLog() {
  gd.log.textContent = '';
  gd.log.className = 'gd-log';
}

/* ----------------------------------------------------------------- auth */

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GD.GIS}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Google 登录脚本加载失败')));
      return;
    }
    const s = document.createElement('script');
    s.src = GD.GIS;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('无法加载 Google 登录脚本（检查网络）'));
    document.head.appendChild(s);
  });
}

async function gdAuth() {
  if (gdToken && gdToken.expiresAt > Date.now()) return gdToken.value;

  if (location.protocol === 'file:') {
    throw new Error('file:// 下无法使用 Google 登录，请用 http://localhost 打开（见 README）');
  }
  const cid = gdClientId();
  if (!cid) throw new Error('请先填写 OAuth 客户端 ID');

  await loadGis();

  if (!gdTokenClient || gdTokenClient.__cid !== cid) {
    gdTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: cid,
      scope: GD.SCOPE,
      callback: () => {},
    });
    gdTokenClient.__cid = cid;
  }

  return new Promise((resolve, reject) => {
    gdTokenClient.callback = resp => {
      if (resp.error) {
        reject(new Error(resp.error_description || resp.error));
        return;
      }
      const ttl = Number(resp.expires_in || 3600);
      gdToken = { value: resp.access_token, expiresAt: Date.now() + (ttl - 60) * 1000 };
      resolve(gdToken.value);
    };
    gdTokenClient.error_callback = err =>
      reject(new Error(err?.message || err?.type || 'Google 登录被取消'));
    // '' lets Google skip the consent screen once you have already granted it.
    gdTokenClient.requestAccessToken({ prompt: '' });
  });
}

/* ------------------------------------------------------------ transport */

async function gdFetch(url, opts = {}, retryOn401 = true) {
  const token = await gdAuth();
  const res = await fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 && retryOn401) {
    gdToken = null;                       // expired or revoked — get a fresh one
    return gdFetch(url, opts, false);
  }
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error?.message || '';
    } catch { /* non-JSON error body */ }
    throw new Error(`Drive ${res.status}${detail ? '：' + detail : ''}`);
  }
  return res;
}

/* --------------------------------------------------------------- files */

/** The MediaLog folder id, reusing the cached one when it still exists. */
async function gdFolder() {
  const cached = lsGet(GD.LS_FOLDER);
  if (cached) {
    try {
      const res = await gdFetch(`${GD.API}/files/${cached}?fields=id,trashed`);
      const info = await res.json();
      if (!info.trashed) return info.id;
    } catch { /* deleted, or belongs to another account — fall through */ }
    lsDel(GD.LS_FOLDER);
  }

  const q = `name='${GD.FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const found = await (await gdFetch(
    `${GD.API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=10`)).json();

  let id = found.files?.[0]?.id;
  if (id) {
    gdLog(`找到已有的 ${GD.FOLDER} 文件夹`);
  } else {
    const created = await (await gdFetch(`${GD.API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ name: GD.FOLDER, mimeType: 'application/vnd.google-apps.folder' }),
    })).json();
    id = created.id;
    gdLog(`已新建 ${GD.FOLDER} 文件夹`);
  }
  lsSet(GD.LS_FOLDER, id);
  return id;
}

/** name -> { id, modifiedTime } for everything already in the folder. */
async function gdList(folderId) {
  const q = `'${folderId}' in parents and trashed=false`;
  const res = await gdFetch(
    `${GD.API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime,size)&pageSize=100`);
  const out = {};
  for (const f of (await res.json()).files || []) out[f.name] = f;
  return out;
}

function multipart(metadata, content) {
  const boundary = 'medialog' + Math.random().toString(36).slice(2);
  // Blob assembles the parts as UTF-8, which plain string concatenation would
  // get wrong for the Chinese filenames and titles.
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    content,
    `\r\n--${boundary}--\r\n`,
  ], { type: `multipart/related; boundary=${boundary}` });
  return body;
}

async function gdPutFile(folderId, name, content, existingId) {
  if (existingId) {
    // Content-only update keeps the file id, so Drive's own version history
    // accumulates instead of a new file appearing on every sync.
    await gdFetch(`${GD.UPLOAD}/files/${existingId}?uploadType=media&fields=id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: new Blob([content], { type: 'application/json' }),
    });
    return existingId;
  }
  const res = await gdFetch(`${GD.UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    body: multipart({ name, parents: [folderId] }, content),
  });
  return (await res.json()).id;
}

async function gdGetFile(id) {
  const res = await gdFetch(`${GD.API}/files/${id}?alt=media`);
  return res.text();
}

/* -------------------------------------------------------------- actions */

function regionPayload(region) {
  return JSON.stringify(store[region], null, 2) + '\n';
}

async function gdPush() {
  gdLog('开始上传…');
  const folderId = await gdFolder();
  const existing = await gdList(folderId);

  let created = 0, updated = 0;
  for (const region of REGIONS) {
    const name = `${region}.json`;
    const hit = existing[name];
    await gdPutFile(folderId, name, regionPayload(region), hit?.id);
    hit ? updated++ : created++;
    gdLog(`  ${hit ? '更新' : '新建'} ${name}（${store[region].items.length} 条）`);
  }

  const stamp = new Date().toISOString();
  lsSet(GD.LS_LAST, stamp);
  gdLog(`完成：新建 ${created}，更新 ${updated}`, 'ok');
  gdRenderStatus();
  toast('已同步到 Google Drive');
}

async function gdPull() {
  if (readOnly) {
    throw new Error('只读模式：请先连接本地 data/ 文件夹，否则恢复的数据无处可存');
  }
  gdLog('检查 Drive 上的备份…');
  const folderId = await gdFolder();
  const existing = await gdList(folderId);

  const present = REGIONS.filter(r => existing[`${r}.json`]);
  if (!present.length) throw new Error('Drive 上还没有备份，请先上传一次');

  const totals = present.map(r => `${r}`).join('、');
  if (!confirm(
    `将用 Drive 上的备份覆盖本地文件：${totals}。\n\n` +
    `本地当前的改动会丢失，确定继续？`)) {
    gdLog('已取消');
    return;
  }

  let restored = 0;
  for (const region of present) {
    const text = await gdGetFile(existing[`${region}.json`].id);
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      gdLog(`  ✗ ${region}.json 不是合法 JSON，已跳过`);
      continue;
    }
    store[region] = normalise(parsed, region);
    saveRegion(region);                    // writes it back down to data/
    restored++;
    gdLog(`  恢复 ${region}.json（${store[region].items.length} 条）`);
  }

  render();
  gdLog(`完成：恢复了 ${restored} 个文件`, 'ok');
  toast(`已从 Google Drive 恢复 ${restored} 个文件`);
}

/* ------------------------------------------------------------------ ui */

function gdRenderStatus() {
  const last = lsGet(GD.LS_LAST);
  const total = REGIONS.reduce((n, r) => n + store[r].items.length, 0);
  gd.status.innerHTML = last
    ? `上次同步：<b>${new Date(last).toLocaleString()}</b> · 本地共 <b>${total}</b> 条`
    : `还没有同步过 · 本地共 <b>${total}</b> 条`;
}

function gdRenderHint() {
  const fileProto = location.protocol === 'file:';
  const cid = gdClientId();
  gd.push.disabled = fileProto || !cid || gdBusy;
  gd.pull.disabled = fileProto || !cid || gdBusy;

  if (fileProto) {
    gd.hint.className = 'gd-hint warn';
    gd.hint.innerHTML =
      'Google 不接受 <code>file://</code> 作为 OAuth 来源，所以这里无法登录。' +
      '在本目录运行 <code>python -m http.server 8000</code>，改用 ' +
      '<code>http://localhost:8000</code> 打开本页即可。';
  } else if (!cid) {
    gd.hint.className = 'gd-hint';
    gd.hint.innerHTML =
      `当前来源 <code>${esc(location.origin)}</code> —— 请把它填进 Google Cloud Console ` +
      '的「已授权的 JavaScript 来源」，并将客户端 ID 粘贴到下面。步骤见 README。';
  } else {
    gd.hint.className = 'gd-hint';
    gd.hint.innerHTML =
      `将把 4 个 JSON 上传到 Drive 里的 <b>${GD.FOLDER}</b> 文件夹。` +
      '本应用只能访问自己创建的文件，看不到你 Drive 里的其他内容。';
  }
}

async function gdRun(fn, label) {
  if (gdBusy) return;
  gdBusy = true;
  gdRenderHint();
  try {
    await fn();
  } catch (err) {
    console.error(err);
    gdLog(`✗ ${label}失败：${err.message}`, 'err');
    toast(`${label}失败：${err.message}`, true);
  } finally {
    gdBusy = false;
    gdRenderHint();
  }
}

if (gd.btn) {
  gd.btn.addEventListener('click', () => {
    gd.client.value = gdClientId();
    gdClearLog();
    gdRenderHint();
    gdRenderStatus();
    gd.dlg.showModal();
  });

  gd.client.addEventListener('change', () => {
    const v = gd.client.value.trim();
    if (v) lsSet(GD.LS_CLIENT, v); else lsDel(GD.LS_CLIENT);
    gdToken = null;                        // different client id ⇒ different token
    gdRenderHint();
  });

  gd.push.addEventListener('click', () => gdRun(gdPush, '上传'));
  gd.pull.addEventListener('click', () => gdRun(gdPull, '恢复'));
  gd.close.addEventListener('click', () => gd.dlg.close());
}
