// Local-only store: everything lives in this device's IndexedDB.
// Used when Firebase is not configured, and handy for trying the app.

import type { Entry, Pet } from '../model/entry';
import { blobToDataUrl } from '../util/blob';
import { localDb } from './localdb';
import type { Store, Unsubscribe } from './types';

type Listener = { petId: string; fromMs: number; toMs: number; cb: (e: Entry[]) => void };

export class LocalStore implements Store {
  readonly mode = 'local' as const;
  private listeners = new Set<Listener>();
  private objectUrls = new Map<string, string>();

  async listPets(): Promise<Pet[]> {
    const db = await localDb();
    return db.getAll('pets');
  }

  async savePet(pet: Pet): Promise<void> {
    const db = await localDb();
    await db.put('pets', pet);
  }

  async listEntries(petId: string, fromMs: number, toMs: number): Promise<Entry[]> {
    const db = await localDb();
    const range = IDBKeyRange.bound([petId, fromMs], [petId, toMs], false, true);
    return db.getAllFromIndex('entries', 'byPetAt', range);
  }

  async getEntry(_petId: string, entryId: string): Promise<Entry | undefined> {
    const db = await localDb();
    return db.get('entries', entryId);
  }

  watchEntries(
    petId: string,
    fromMs: number,
    toMs: number,
    cb: (entries: Entry[]) => void,
  ): Unsubscribe {
    const l: Listener = { petId, fromMs, toMs, cb };
    this.listeners.add(l);
    void this.listEntries(petId, fromMs, toMs).then(cb);
    return () => this.listeners.delete(l);
  }

  private async notify(petId: string): Promise<void> {
    for (const l of this.listeners) {
      if (l.petId !== petId) continue;
      l.cb(await this.listEntries(l.petId, l.fromMs, l.toMs));
    }
  }

  async saveEntry(entry: Entry): Promise<void> {
    const db = await localDb();
    await db.put('entries', entry);
    await this.notify(entry.petId);
  }

  async deleteEntry(petId: string, entryId: string): Promise<void> {
    const db = await localDb();
    const entry = await db.get('entries', entryId);
    await db.delete('entries', entryId);
    if (entry) {
      for (const p of entry.photoPaths) await db.delete('photos', p);
    }
    await this.notify(petId);
  }

  async savePhoto(petId: string, entryId: string, blob: Blob): Promise<string> {
    const db = await localDb();
    const path = `local/${petId}/${entryId}/${Date.now()}.jpg`;
    await db.put('photos', { path, blob });
    return path;
  }

  async photoUrl(path: string): Promise<string | undefined> {
    const cached = this.objectUrls.get(path);
    if (cached) return cached;
    const db = await localDb();
    const row = await db.get('photos', path);
    if (!row) return undefined;
    const url = await blobToDataUrl(row.blob);
    this.objectUrls.set(path, url);
    return url;
  }

  async exportAll(petId: string): Promise<{ pet: Pet | undefined; entries: Entry[] }> {
    const db = await localDb();
    const pet = await db.get('pets', petId);
    const entries = await this.listEntries(petId, 0, Number.MAX_SAFE_INTEGER);
    return { pet, entries };
  }
}
