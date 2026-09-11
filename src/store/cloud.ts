// Cloud store: Firestore (records) + Storage (photos), scoped to one household.
// Firestore's persistent cache makes writes work offline. Photo uploads are
// queued in IndexedDB and flushed whenever the device comes back online.

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebase } from '../firebase';
import type { Entry, Pet } from '../model/entry';
import { blobToDataUrl } from '../util/blob';
import { localDb } from './localdb';
import type { Store, Unsubscribe } from './types';

export class CloudStore implements Store {
  readonly mode = 'cloud' as const;
  private urlCache = new Map<string, string>();
  private flushing = false;

  constructor(private householdId: string) {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => void this.flushUploads());
      void this.flushUploads();
    }
  }

  private petsCol() {
    const { db } = getFirebase();
    return collection(db, 'households', this.householdId, 'pets');
  }

  private entriesCol(petId: string) {
    const { db } = getFirebase();
    return collection(db, 'households', this.householdId, 'pets', petId, 'entries');
  }

  async listPets(): Promise<Pet[]> {
    const snap = await getDocs(this.petsCol());
    return snap.docs.map((d) => d.data() as Pet);
  }

  async savePet(pet: Pet): Promise<void> {
    await setDoc(doc(this.petsCol(), pet.id), pet);
  }

  async listEntries(petId: string, fromMs: number, toMs: number): Promise<Entry[]> {
    const q = query(
      this.entriesCol(petId),
      where('at', '>=', fromMs),
      where('at', '<', toMs),
      orderBy('at'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Entry);
  }

  async getEntry(petId: string, entryId: string): Promise<Entry | undefined> {
    const snap = await getDoc(doc(this.entriesCol(petId), entryId));
    return snap.exists() ? (snap.data() as Entry) : undefined;
  }

  watchEntries(
    petId: string,
    fromMs: number,
    toMs: number,
    cb: (entries: Entry[]) => void,
  ): Unsubscribe {
    const q = query(
      this.entriesCol(petId),
      where('at', '>=', fromMs),
      where('at', '<', toMs),
      orderBy('at'),
    );
    return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data() as Entry)));
  }

  async saveEntry(entry: Entry): Promise<void> {
    // Firestore rejects `undefined`; strip it.
    const clean = JSON.parse(JSON.stringify(entry)) as Entry;
    await setDoc(doc(this.entriesCol(entry.petId), entry.id), clean);
  }

  async deleteEntry(petId: string, entryId: string): Promise<void> {
    await deleteDoc(doc(this.entriesCol(petId), entryId));
  }

  async savePhoto(petId: string, entryId: string, blob: Blob): Promise<string> {
    const path = `households/${this.householdId}/${petId}/${entryId}/${Date.now()}.jpg`;
    const db = await localDb();
    // Keep a local copy so the photo shows immediately (and offline).
    await db.put('photos', { path, blob });
    await db.put('pendingUploads', { path, blob, createdAt: Date.now() });
    void this.flushUploads();
    return path;
  }

  /** Upload queued photos. Safe to call often; runs one flush at a time. */
  async flushUploads(): Promise<void> {
    if (this.flushing || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    this.flushing = true;
    try {
      const db = await localDb();
      const pending = await db.getAll('pendingUploads');
      const { storage } = getFirebase();
      for (const p of pending) {
        try {
          await uploadBytes(ref(storage, p.path), p.blob, { contentType: 'image/jpeg' });
          await db.delete('pendingUploads', p.path);
        } catch (err) {
          console.warn('photo upload deferred', p.path, err);
          break;
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  async photoUrl(path: string): Promise<string | undefined> {
    const cached = this.urlCache.get(path);
    if (cached) return cached;
    const db = await localDb();
    const local = await db.get('photos', path);
    if (local) {
      const url = await blobToDataUrl(local.blob);
      this.urlCache.set(path, url);
      return url;
    }
    try {
      const { storage } = getFirebase();
      const url = await getDownloadURL(ref(storage, path));
      this.urlCache.set(path, url);
      return url;
    } catch {
      return undefined;
    }
  }

  async exportAll(petId: string): Promise<{ pet: Pet | undefined; entries: Entry[] }> {
    const pets = await this.listPets();
    const pet = pets.find((p) => p.id === petId);
    const entries = await this.listEntries(petId, 0, Number.MAX_SAFE_INTEGER);
    return { pet, entries };
  }
}
