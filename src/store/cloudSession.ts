// Sign-in and household membership on Firebase. Loaded on demand by
// session.ts only when Firebase is configured.

import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getFirebase, googleProvider } from '../firebase';
import { newId, type Household } from '../model/entry';
import { CloudStore } from './cloud';
import { getMeta, setMeta } from './localdb';

export interface UserInfo {
  uid: string;
  name: string;
}

export function watchAuth(cb: (user: UserInfo | null) => void): () => void {
  const { auth } = getFirebase();
  return onAuthStateChanged(auth, (u) =>
    cb(u ? { uid: u.uid, name: u.displayName ?? u.email ?? 'ユーザー' } : null),
  );
}

export async function signIn(): Promise<void> {
  const { auth } = getFirebase();
  await signInWithPopup(auth, googleProvider);
}

export async function signOut(): Promise<void> {
  const { auth } = getFirebase();
  await fbSignOut(auth);
}

export function makeStore(householdId: string): CloudStore {
  return new CloudStore(householdId);
}

/** The household the user last used, or any household they belong to. */
export async function findHousehold(uid: string): Promise<Household | null> {
  const { db } = getFirebase();
  const lastId = await getMeta<string>('lastHouseholdId');
  if (lastId) {
    const snap = await getDoc(doc(db, 'households', lastId));
    if (snap.exists()) {
      const h = snap.data() as Household;
      if (h.memberUids.includes(uid)) return h;
    }
  }
  const q = query(collection(db, 'households'), where('memberUids', 'array-contains', uid));
  const snap = await getDocs(q);
  const h = snap.docs[0]?.data() as Household | undefined;
  if (h) await setMeta('lastHouseholdId', h.id);
  return h ?? null;
}

export async function createHousehold(uid: string, name: string): Promise<Household> {
  const { db } = getFirebase();
  const household: Household = {
    id: newId(),
    name,
    memberUids: [uid],
    inviteCode: makeInviteCode(),
  };
  await setDoc(doc(db, 'households', household.id), household);
  await setMeta('lastHouseholdId', household.id);
  return household;
}

export async function joinHousehold(uid: string, inviteCode: string): Promise<Household> {
  const { db } = getFirebase();
  const code = inviteCode.trim().toUpperCase();
  const q = query(collection(db, 'households'), where('inviteCode', '==', code));
  const snap = await getDocs(q);
  const found = snap.docs[0];
  if (!found) throw new Error('招待コードが見つかりません');
  await updateDoc(found.ref, { memberUids: arrayUnion(uid) });
  const household = { ...(found.data() as Household) };
  if (!household.memberUids.includes(uid)) household.memberUids.push(uid);
  await setMeta('lastHouseholdId', household.id);
  return household;
}

function makeInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}
