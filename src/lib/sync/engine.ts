/* Syncs the library with a remote folder (Google Drive in the app, an
 * in-memory fake in tests). For each region it keeps, per account:
 *
 *   base  the copy both sides agreed on at the last sync (for mergeRegion)
 *   md5   the remote file's checksum at that point
 *
 * so an unchanged remote file is never downloaded again, and a changed one is
 * merged rather than overwritten. After a successful sync it also writes one
 * dated snapshot per day, because Drive only keeps old versions of a file for
 * about 30 days. */

import {
  REGIONS,
  normalise,
  type Library,
  type Region,
  type RegionFile,
} from "../schema";
import { snapshot } from "../transfer";
import { mergeRegion } from "./merge";

export interface RemoteFile {
  id: string;
  name: string;
  md5: string | null;
}

export interface Remote {
  /** The region files in the app's folder, by file name. */
  list(): Promise<Map<string, RemoteFile>>;
  read(file: RemoteFile): Promise<string>;
  /** Creates the file, or replaces the content of `existing` in place. */
  write(
    name: string,
    content: string,
    existing?: RemoteFile,
  ): Promise<RemoteFile>;
  /** Writes a snapshot unless one with this name already exists. True if written. */
  snapshot(name: string, content: string): Promise<boolean>;
}

export interface RegionSync {
  md5: string | null;
  base: RegionFile;
}

export interface SyncStore {
  get(region: Region): Promise<RegionSync | undefined>;
  set(region: Region, state: RegionSync): Promise<void>;
  lastSnapshot(): Promise<string | undefined>;
  setLastSnapshot(day: string): Promise<void>;
}

export interface SyncReport {
  /** Changes that arrived from the remote side. */
  pulled: { added: number; updated: number; removed: number };
  /** Regions whose file was uploaded. */
  pushed: Region[];
  /** Name of the snapshot written in this run, if any. */
  snapshot: string | null;
}

export interface SyncOptions {
  remote: Remote;
  store: SyncStore;
  /** The library as it is right now. */
  getLocal: () => Library;
  /** Replaces one region locally (persist it, but do not sync it again). */
  setLocal: (region: Region, file: RegionFile) => void;
  /** Local calendar day, YYYY-MM-DD. */
  today: () => string;
}

/** The exact bytes v1 wrote to data/{region}.json. */
export const serialize = (file: RegionFile) =>
  JSON.stringify(file, null, 2) + "\n";

export const regionFileName = (region: Region) => `${region}.json`;

export class SyncEngine {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private o: SyncOptions) {}

  /** Syncs the given regions. Runs one at a time: a call made while another
   *  is running starts after it. Rejects if anything fails; nothing is
   *  recorded as synced unless its upload succeeded. */
  sync(regions: readonly Region[] = REGIONS): Promise<SyncReport> {
    const run = this.chain.then(() => this.run(regions));
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async run(regions: readonly Region[]): Promise<SyncReport> {
    const { remote, store, getLocal, setLocal, today } = this.o;
    const report: SyncReport = {
      pulled: { added: 0, updated: 0, removed: 0 },
      pushed: [],
      snapshot: null,
    };
    const again: Region[] = [];
    const files = await remote.list();

    for (const region of regions) {
      const name = regionFileName(region);
      const file = files.get(name);
      const state = await store.get(region);
      const localUsed = getLocal()[region];

      let remoteCopy: RegionFile | null = null;
      if (file) {
        remoteCopy =
          state && file.md5 && state.md5 === file.md5
            ? state.base // unchanged since we last agreed: no download
            : parseRegion(await remote.read(file), region, name);
      }

      const m = mergeRegion(state?.base ?? null, localUsed, remoteCopy);
      let md5 = file?.md5 ?? null;
      if (m.remoteChanged) {
        md5 = (await remote.write(name, serialize(m.merged), file)).md5;
        report.pushed.push(region);
      }
      await store.set(region, { md5, base: m.merged });

      if (m.localChanged) {
        const now = getLocal()[region];
        if (now === localUsed) {
          setLocal(region, m.merged);
        } else {
          // Edited while we were syncing: keep that edit on top of the merge,
          // and sync this region again so the edit reaches the remote too.
          setLocal(region, mergeRegion(localUsed, now, m.merged).merged);
          again.push(region);
        }
      }
      report.pulled.added += m.pulled.added;
      report.pulled.updated += m.pulled.updated;
      report.pulled.removed += m.pulled.removed;
    }

    const day = today();
    if ((await store.lastSnapshot()) !== day) {
      const name = `medialog-${day}.json`;
      const content = JSON.stringify(snapshot(getLocal()), null, 2) + "\n";
      if (await remote.snapshot(name, content)) report.snapshot = name;
      await store.setLastSnapshot(day);
    }

    if (again.length) {
      const next = await this.run(again);
      report.pushed.push(...next.pushed);
    }
    return report;
  }
}

function parseRegion(text: string, region: Region, name: string): RegionFile {
  try {
    return normalise(JSON.parse(text), region);
  } catch {
    throw new Error(`Drive 上的 ${name} 不是合法的 JSON，请检查或删除它`);
  }
}
