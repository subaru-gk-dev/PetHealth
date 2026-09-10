// IndexedDB schema shared by LocalStore (entries + photos) and CloudStore
// (pending photo uploads + photo cache).

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Entry, Pet } from '../model/entry';

interface PetHealthDB extends DBSchema {
  pets: { key: string; value: Pet };
  entries: {
    key: string;
    value: Entry;
    indexes: { byPetAt: [string, number] };
  };
  photos: { key: string; value: { path: string; blob: Blob } };
  pendingUploads: { key: string; value: { path: string; blob: Blob; createdAt: number } };
  meta: { key: string; value: { key: string; value: unknown } };
}

let dbPromise: Promise<IDBPDatabase<PetHealthDB>> | undefined;

export function localDb(): Promise<IDBPDatabase<PetHealthDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PetHealthDB>('pet-health', 1, {
      upgrade(db) {
        db.createObjectStore('pets', { keyPath: 'id' });
        const entries = db.createObjectStore('entries', { keyPath: 'id' });
        entries.createIndex('byPetAt', ['petId', 'at']);
        db.createObjectStore('photos', { keyPath: 'path' });
        db.createObjectStore('pendingUploads', { keyPath: 'path' });
        db.createObjectStore('meta', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await localDb();
  const row = await db.get('meta', key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await localDb();
  await db.put('meta', { key, value });
}
