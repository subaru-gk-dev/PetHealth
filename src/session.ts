// Session state: who is signed in, which household and pet are active, and
// which Store implementation to use. Exposed as a tiny observable so Preact
// components can re-render on change. Firebase code is loaded on demand.

import { isCloudEnabled } from './config';
import type { Household, Pet } from './model/entry';
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
type CloudSession = typeof import('./store/cloudSession');

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
  private cloudModule: Promise<CloudSession> | undefined;

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    l(this.state);
    return () => this.listeners.delete(l);
  }

  private set(patch: Partial<SessionState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  private cloud(): Promise<CloudSession> {
    if (!this.cloudModule) this.cloudModule = import('./store/cloudSession');
    return this.cloudModule;
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
    const cloud = await this.cloud();
    cloud.watchAuth((user) => void this.onUser(user));
  }

  private async onUser(user: SessionState['user']): Promise<void> {
    if (!user) {
      this.set({ ready: true, user: null, household: null, pet: null, store: null });
      return;
    }
    const cloud = await this.cloud();
    const household = await cloud.findHousehold(user.uid);
    if (!household) {
      this.set({ ready: true, user, household: null, pet: null, store: null });
      return;
    }
    await this.activateHousehold(user, household);
  }

  private async activateHousehold(user: SessionState['user'], household: Household) {
    const cloud = await this.cloud();
    const store = cloud.makeStore(household.id);
    const pets = await store.listPets();
    const lastPetId = await getMeta<string>('lastPetId');
    const pet = pets.find((p) => p.id === lastPetId) ?? pets[0] ?? null;
    this.set({ ready: true, user, household, pet, store });
  }

  async signIn(): Promise<void> {
    await (await this.cloud()).signIn();
  }

  async signOut(): Promise<void> {
    await (await this.cloud()).signOut();
  }

  /** Create a household owned by the current user. */
  async createHousehold(name: string): Promise<void> {
    const user = this.state.user;
    if (!user) throw new Error('not signed in');
    const household = await (await this.cloud()).createHousehold(user.uid, name);
    await this.activateHousehold(user, household);
  }

  /** Join an existing household by its invite code. */
  async joinHousehold(inviteCode: string): Promise<void> {
    const user = this.state.user;
    if (!user) throw new Error('not signed in');
    const household = await (await this.cloud()).joinHousehold(user.uid, inviteCode);
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

export const session = new Session();
