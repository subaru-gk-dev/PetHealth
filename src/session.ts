// Session state: who is signed in, which household and pet are active, and
// which Store implementation to use. Exposed as a tiny observable so Preact
// components can re-render on change.

import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
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
import { getFirebase, googleProvider, isCloudEnabled } from './firebase';
import { newId, type Household, type Pet } from './model/entry';
import { CloudStore } from './store/cloud';
import { LocalStore } from './store/local';
import { getMeta, setMeta } from './store/localdb';
import type { Store } from './store/types';

export interface SessionState {
  ready: boolean;
  cloud: boolean;
  user: { uid: string; name: string } | null;
  household: Household | null;
  pet: Pet | null;
  store: Store | null;
}

type Listener = (s: SessionState) => void;

const LOCAL_UID = 'local';

class Session {
  state: SessionState = {
    ready: false,
    cloud: isCloudEnabled,
    user: null,
    household: null,
    pet: null,
    store: null,
  };
  private listeners = new Set<Listener>();

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    l(this.state);
    return () => this.listeners.delete(l);
  }

  private set(patch: Partial<SessionState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  async start(): Promise<void> {
    if (!isCloudEnabled) {
      const store = new LocalStore();
      const pets = await store.listPets();
      this.set({
        ready: true,
        user: { uid: LOCAL_UID, name: 'この端末' },
        household: { id: 'local', name: 'この端末', memberUids: [LOCAL_UID], inviteCode: '' },
        pet: pets[0] ?? null,
        store,
      });
      return;
    }
    const { auth } = getFirebase();
    onAuthStateChanged(auth, (user) => void this.onUser(user));
  }

  private async onUser(user: User | null): Promise<void> {
    if (!user) {
      this.set({ ready: true, user: null, household: null, pet: null, store: null });
      return;
    }
    const info = { uid: user.uid, name: user.displayName ?? user.email ?? 'ユーザー' };
    const household = await this.findHousehold(user.uid);
    if (!household) {
      this.set({ ready: true, user: info, household: null, pet: null, store: null });
      return;
    }
    await this.activateHousehold(info, household);
  }

  private async activateHousehold(user: SessionState['user'], household: Household) {
    const store = new CloudStore(household.id);
    const pets = await store.listPets();
    const lastPetId = await getMeta<string>('lastPetId');
    const pet = pets.find((p) => p.id === lastPetId) ?? pets[0] ?? null;
    this.set({ ready: true, user, household, pet, store });
  }

  private async findHousehold(uid: string): Promise<Household | null> {
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

  async signIn(): Promise<void> {
    const { auth } = getFirebase();
    await signInWithPopup(auth, googleProvider);
  }

  async signOut(): Promise<void> {
    const { auth } = getFirebase();
    await signOut(auth);
  }

  /** Create a household owned by the current user. */
  async createHousehold(name: string): Promise<void> {
    const user = this.state.user;
    if (!user) throw new Error('not signed in');
    const { db } = getFirebase();
    const household: Household = {
      id: newId(),
      name,
      memberUids: [user.uid],
      inviteCode: makeInviteCode(),
    };
    await setDoc(doc(db, 'households', household.id), household);
    await setMeta('lastHouseholdId', household.id);
    await this.activateHousehold(user, household);
  }

  /** Join an existing household by its invite code. */
  async joinHousehold(inviteCode: string): Promise<void> {
    const user = this.state.user;
    if (!user) throw new Error('not signed in');
    const { db } = getFirebase();
    const code = inviteCode.trim().toUpperCase();
    const q = query(collection(db, 'households'), where('inviteCode', '==', code));
    const snap = await getDocs(q);
    const found = snap.docs[0];
    if (!found) throw new Error('招待コードが見つかりません');
    await updateDoc(found.ref, { memberUids: arrayUnion(user.uid) });
    const household = { ...(found.data() as Household) };
    if (!household.memberUids.includes(user.uid)) household.memberUids.push(user.uid);
    await setMeta('lastHouseholdId', household.id);
    await this.activateHousehold(user, household);
  }

  async savePet(pet: Pet): Promise<void> {
    const store = this.state.store;
    if (!store) throw new Error('no store');
    await store.savePet(pet);
    await setMeta('lastPetId', pet.id);
    this.set({ pet });
  }
}

function makeInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export const session = new Session();
