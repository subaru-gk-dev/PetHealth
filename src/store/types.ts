// Storage abstraction. Two implementations exist: LocalStore (IndexedDB only)
// and CloudStore (Firestore + Storage with offline persistence). The UI only
// talks to this interface.

import type { Entry, Pet } from '../model/entry';

export type Unsubscribe = () => void;

export interface Store {
  readonly mode: 'local' | 'cloud';

  /** Current pet list for the active household. */
  listPets(): Promise<Pet[]>;
  savePet(pet: Pet): Promise<void>;

  /** Live subscription to entries of a pet within [fromMs, toMs). */
  watchEntries(
    petId: string,
    fromMs: number,
    toMs: number,
    cb: (entries: Entry[]) => void,
  ): Unsubscribe;

  /** One-shot read of entries within [fromMs, toMs). */
  listEntries(petId: string, fromMs: number, toMs: number): Promise<Entry[]>;

  getEntry(petId: string, entryId: string): Promise<Entry | undefined>;

  saveEntry(entry: Entry): Promise<void>;
  deleteEntry(petId: string, entryId: string): Promise<void>;

  /**
   * Persist a photo and return its path. In cloud mode the upload may be
   * deferred while offline; the path is valid immediately and resolves once
   * the upload completes.
   */
  savePhoto(petId: string, entryId: string, blob: Blob): Promise<string>;

  /** Resolve a photo path to a displayable URL (object URL or download URL). */
  photoUrl(path: string): Promise<string | undefined>;

  /** Export every entry of a pet as JSON-serialisable data (backup). */
  exportAll(petId: string): Promise<{ pet: Pet | undefined; entries: Entry[] }>;
}
