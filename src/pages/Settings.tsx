import { useState } from 'preact/hooks';
import { navigate, useSession } from '../hooks';
import { newId, type Pet } from '../model/entry';
import { session } from '../session';

export function Settings() {
  const s = useSession();

  if (s.cloud && !s.user) return <SignIn />;
  if (s.cloud && !s.household) return <HouseholdSetup />;
  if (!s.pet) return <PetForm />;

  return (
    <>
      <PetForm pet={s.pet} />
      {s.cloud && s.household && (
        <div class="card">
          <h3>家族と共有</h3>
          <p class="hint">家族にこのコードを伝えると、同じ記録を一緒に見られます。</p>
          <div class="code" data-testid="invite-code">
            {s.household.inviteCode}
          </div>
          <p class="hint">
            ログイン中：{s.user?.name}
            <button type="button" class="btn secondary" onClick={() => void session.signOut()}>
              ログアウト
            </button>
          </p>
        </div>
      )}
      {!s.cloud && (
        <div class="card">
          <h3>この端末のみで記録中</h3>
          <p class="hint">
            家族と共有するには Firebase の設定（README.md）を入れて公開してください。
            端末を替えるときは下のバックアップを保存しておきます。
          </p>
        </div>
      )}
      <Backup />
    </>
  );
}

function SignIn() {
  const [err, setErr] = useState<string>();
  return (
    <div class="card">
      <h3>ログイン</h3>
      <p class="hint">Google アカウントでログインすると、家族と同じ記録を共有できます。</p>
      <button
        type="button"
        class="btn"
        onClick={() => session.signIn().catch((e) => setErr(String(e)))}
      >
        Google でログイン
      </button>
      {err && <div class="error">{err}</div>}
    </div>
  );
}

function HouseholdSetup() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const run = (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(undefined);
    fn()
      .catch((e) => setErr(String(e)))
      .finally(() => setBusy(false));
  };
  return (
    <>
      <div class="card">
        <h3>はじめて使う</h3>
        <div class="field">
          <label>家の名前（例：伊藤家）</label>
          <input type="text" value={name} onInput={(ev) => setName(ev.currentTarget.value)} />
        </div>
        <button
          type="button"
          class="btn"
          disabled={busy || !name.trim()}
          onClick={() => run(() => session.createHousehold(name.trim()))}
        >
          作成する
        </button>
      </div>
      <div class="card">
        <h3>家族に招待された</h3>
        <div class="field">
          <label>招待コード（6文字）</label>
          <input
            type="text"
            value={code}
            maxLength={6}
            autocapitalize="characters"
            onInput={(ev) => setCode(ev.currentTarget.value)}
          />
        </div>
        <button
          type="button"
          class="btn"
          disabled={busy || code.trim().length !== 6}
          onClick={() => run(() => session.joinHousehold(code))}
        >
          参加する
        </button>
      </div>
      {err && <div class="error">{err}</div>}
    </>
  );
}

function PetForm({ pet }: { pet?: Pet }) {
  const [draft, setDraft] = useState<Pet>(
    pet ?? { id: newId(), name: '', breed: 'ビションフリーゼ', sex: 'male' },
  );
  const [saved, setSaved] = useState(false);
  const patch = (p: Partial<Pet>) => {
    setDraft({ ...draft, ...p });
    setSaved(false);
  };
  return (
    <form
      class="card form"
      onSubmit={(ev) => {
        ev.preventDefault();
        void session.savePet(draft).then(() => {
          setSaved(true);
          if (!pet) navigate('home');
        });
      }}
    >
      <h3>{pet ? 'わんこの情報' : 'わんこを登録'}</h3>
      <div class="field">
        <label>名前</label>
        <input
          type="text"
          required
          value={draft.name}
          data-testid="pet-name"
          onInput={(ev) => patch({ name: ev.currentTarget.value })}
        />
      </div>
      <div class="row">
        <div class="field">
          <label>犬種</label>
          <input
            type="text"
            value={draft.breed ?? ''}
            onInput={(ev) => patch({ breed: ev.currentTarget.value })}
          />
        </div>
        <div class="field">
          <label>性別</label>
          <select
            value={draft.sex ?? ''}
            onChange={(ev) => patch({ sex: (ev.currentTarget.value || undefined) as Pet['sex'] })}
          >
            <option value="">—</option>
            <option value="male">オス</option>
            <option value="female">メス</option>
          </select>
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label>誕生日</label>
          <input
            type="date"
            value={draft.birthDate ?? ''}
            onInput={(ev) => patch({ birthDate: ev.currentTarget.value })}
          />
        </div>
        <div class="field">
          <label>体重 kg（目安）</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={draft.currentWeightKg ?? ''}
            onInput={(ev) => {
              const n = Number(ev.currentTarget.value);
              patch({ currentWeightKg: ev.currentTarget.value === '' || !n ? undefined : n });
            }}
          />
        </div>
      </div>
      <button type="submit" class="btn" data-testid="pet-save">
        {saved ? '保存しました' : '保存'}
      </button>
    </form>
  );
}

function Backup() {
  const { store, pet } = useSession();
  const [busy, setBusy] = useState(false);
  // The single-file trial page cannot hand the viewer a file to save.
  if (import.meta.env.VITE_SINGLE_FILE) {
    return (
      <div class="card">
        <h3>試用版について</h3>
        <p class="hint">
          この画面は試用版です。記録はこのブラウザの中にだけ残ります。
          バックアップと家族共有は、公開版（README の手順）で使えます。
        </p>
      </div>
    );
  }
  const download = async () => {
    if (!store || !pet) return;
    setBusy(true);
    try {
      const data = await store.exportAll(pet.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `pet-health-${pet.name}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div class="card">
      <h3>バックアップ</h3>
      <p class="hint">記録を JSON ファイルとして保存します（写真は含みません）。</p>
      <button type="button" class="btn secondary" disabled={busy} onClick={() => void download()}>
        JSON を書き出す
      </button>
    </div>
  );
}
