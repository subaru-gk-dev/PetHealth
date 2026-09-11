// Cloud store: Firestore for records AND photos, scoped to one household.
// Photos live as small documents (`photos` subcollection, JPEG bytes) so the
// project stays on the free Spark plan; Cloud Storage would require Blaze.
// Firestore's persistent cache queues writes made offline, photos included.

import {
  Bytes,
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
import { getFirebase } from '../firebase';
import { newId, type Entry, type Pet } from '../model/entry';
import { blobToDataUrl } from '../util/blob';
import { localDb } from './localdb';
import type { Store, Unsubscribe } from './types';

/** Photo paths in cloud mode: fs:households/{hid}/pets/{petId}/photos/{photoId} */
const PHOTO_PREFIX = 'fs:';

interface PhotoDoc {
  entryId: string;
  contentType: string;
  bytes: Bytes;
  createdAt: number;
}

export class CloudStore implements Store {
  readonly mode = 'cloud' as const;
  private urlCache = new Map<string, string>();

  constructor(private householdId: string) {}

  private petsCol() {
    const { db } = getFirebase();
    return collection(db, 'households', this.householdId, 'pets');
  }

  private entriesCol(petId: string) {
    const { db } = getFirebase();
    return collection(db, 'households', this.householdId, 'pets', petId, 'entries');
  }

  private photosCol(petId: string) {
    const { db } = getFirebase();
    return collection(db, 'households', this.householdId, 'pets', petId, 'photos');
  }

  async listPets(): Promise<Pet[]> {
    const snap = await getDocs(this.petsCol());
    return snap.docs.map((d) => d.data() as Pet);
  }

  async savePet(pet: Pet): Promise<void> {
    await setDoc(doc(this.petsCol(), pet.id), stripUndefined(pet));
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
    await setDoc(doc(this.entriesCol(entry.petId), entry.id), stripUndefined(entry));
  }

  async deleteEntry(petId: string, entryId: string): Promise<void> {
    const entry = await this.getEntry(petId, entryId);
    await deleteDoc(doc(this.entriesCol(petId), entryId));
    const db = await localDb();
    for (const p of entry?.photoPaths ?? []) {
      const ref = this.photoRef(p);
      if (ref) await deleteDoc(ref);
      await db.delete('photos', p);
      this.urlCache.delete(p);
    }
  }

  async savePhoto(petId: string, entryId: string, blob: Blob): Promise<string> {
    const photoId = newId();
    const path = `${PHOTO_PREFIX}households/${this.householdId}/pets/${petId}/photos/${photoId}`;
    // Keep a local copy so the photo shows immediately and never needs a re-read.
    const db = await localDb();
    await db.put('photos', { path, blob });
    const bytes = Bytes.fromUint8Array(new Uint8Array(await blob.arrayBuffer()));
    const photo: PhotoDoc = {
      entryId,
      contentType: blob.type || 'image/jpeg',
      bytes,
      createdAt: Date.now(),
    };
    await setDoc(doc(this.photosCol(petId), photoId), photo);
    return path;
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
    const ref = this.photoRef(path);
    if (!ref) return undefined;
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) return undefined;
      const data = snap.data() as PhotoDoc;
      // Copy into a plain ArrayBuffer-backed array (Blob rejects SharedArrayBuffer views).
      const blob = new Blob([new Uint8Array(data.bytes.toUint8Array())], { type: data.contentType });
      await db.put('photos', { path, blob });
      const url = await blobToDataUrl(blob);
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

  /** Document reference for a cloud photo path, or undefined for other paths. */
  private photoRef(path: string) {
    if (!path.startsWith(PHOTO_PREFIX)) return undefined;
    const segments = path.slice(PHOTO_PREFIX.length).split('/');
    if (segments.length !== 6) return undefined;
    const { db } = getFirebase();
    return doc(db, ...(segments as [string, ...string[]]));
  }
}

/** Firestore rejects `undefined` field values; drop them. */
function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}
