/* The Remote that SyncEngine talks to in the app: a "MediaLog" folder in the
 * user's Google Drive, called straight from the browser with a short-lived
 * access token (the long-lived refresh token never leaves the server).
 *
 * Scope is drive.file, so this app sees only files it created itself. Region
 * files are updated in place (same file id), so Drive's own version history
 * accumulates; snapshots go into MediaLog/snapshots. */

import type { Remote, RemoteFile } from "./engine";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER = "application/vnd.google-apps.folder";
const APP_FOLDER = "MediaLog";
const SNAPSHOT_FOLDER = "snapshots";
const FILE_FIELDS = "id,name,md5Checksum";

/** Sign-in is needed again (refresh token expired or revoked). */
export class AuthError extends Error {}

export class DriveError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type DriveFile = { id: string; name: string; md5Checksum?: string };
const toRemote = (f: DriveFile): RemoteFile => ({
  id: f.id,
  name: f.name,
  md5: f.md5Checksum ?? null,
});
const q = (s: string) => encodeURIComponent(s);

export interface GoogleDrive extends Remote {
  /** The app folder, once it has been found or created. */
  folderUrl(): string | null;
}

/** `getToken(true)` must return a freshly refreshed token. */
export function googleDrive(
  getToken: (force?: boolean) => Promise<string>,
): GoogleDrive {
  let folderId: string | null = null;
  let folderPromise: Promise<string> | null = null;
  let snapshotsPromise: Promise<string> | null = null;

  async function call(
    url: string,
    init: RequestInit = {},
    retried = false,
  ): Promise<Response> {
    const token = await getToken(retried);
    const res = await fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 && !retried) return call(url, init, true);
    if (res.status === 401)
      throw new AuthError("Google 登录已失效，请重新登录");
    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.json())?.error?.message ?? "";
      } catch {
        /* non-JSON error body */
      }
      throw new DriveError(
        res.status,
        `Google Drive ${res.status}${detail ? `：${detail}` : ""}`,
      );
    }
    return res;
  }

  const json = async <T>(url: string, init?: RequestInit) =>
    (await call(url, init)).json() as Promise<T>;

  /** Finds the app's folder (by name, under `parent`) or creates it. */
  async function ensureFolder(name: string, parent: string): Promise<string> {
    const query = `name = '${name}' and mimeType = '${FOLDER}' and '${parent}' in parents and trashed = false`;
    const found = await json<{ files: DriveFile[] }>(
      `${API}/files?q=${q(query)}&fields=files(id)&pageSize=1`,
    );
    if (found.files[0]) return found.files[0].id;
    const created = await json<DriveFile>(`${API}/files?fields=id`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent] }),
    });
    return created.id;
  }

  const folder = () => {
    folderPromise ??= ensureFolder(APP_FOLDER, "root").then(
      (id) => (folderId = id),
      (err) => {
        folderPromise = null; // try again next time
        throw err;
      },
    );
    return folderPromise;
  };

  const snapshots = () => {
    snapshotsPromise ??= folder()
      .then((parent) => ensureFolder(SNAPSHOT_FOLDER, parent))
      .catch((err) => {
        snapshotsPromise = null;
        throw err;
      });
    return snapshotsPromise;
  };

  async function create(
    name: string,
    content: string,
    parent: string,
  ): Promise<RemoteFile> {
    const boundary = `medialog${Math.random().toString(36).slice(2)}`;
    // A Blob assembles the parts as UTF-8, which string concatenation would
    // get wrong for the Chinese file names and titles.
    const body = new Blob(
      [
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
        JSON.stringify({
          name,
          parents: [parent],
          mimeType: "application/json",
        }),
        `\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
        content,
        `\r\n--${boundary}--\r\n`,
      ],
      { type: `multipart/related; boundary=${boundary}` },
    );
    return toRemote(
      await json<DriveFile>(
        `${UPLOAD}/files?uploadType=multipart&fields=${FILE_FIELDS}`,
        { method: "POST", body },
      ),
    );
  }

  return {
    folderUrl: () =>
      folderId ? `https://drive.google.com/drive/folders/${folderId}` : null,

    async list() {
      const parent = await folder();
      const query = `'${parent}' in parents and trashed = false and mimeType != '${FOLDER}'`;
      const res = await json<{ files: DriveFile[] }>(
        `${API}/files?q=${q(query)}&fields=files(${FILE_FIELDS})&pageSize=100`,
      );
      return new Map(res.files.map((f) => [f.name, toRemote(f)]));
    },

    async read(file) {
      return (await call(`${API}/files/${file.id}?alt=media`)).text();
    },

    async write(name, content, existing) {
      if (!existing) return create(name, content, await folder());
      // Content-only update keeps the file id, so Drive's version history builds up.
      return toRemote(
        await json<DriveFile>(
          `${UPLOAD}/files/${existing.id}?uploadType=media&fields=${FILE_FIELDS}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json; charset=UTF-8" },
            body: new Blob([content], { type: "application/json" }),
          },
        ),
      );
    },

    async snapshot(name, content) {
      const parent = await snapshots();
      const query = `name = '${name}' and '${parent}' in parents and trashed = false`;
      const found = await json<{ files: DriveFile[] }>(
        `${API}/files?q=${q(query)}&fields=files(id)&pageSize=1`,
      );
      if (found.files.length) return false;
      await create(name, content, parent);
      return true;
    },
  };
}
