import { useEffect, useState } from 'preact/hooks';
import { Photo } from '../components/Photo';
import { NumberInput } from '../components/NumberInput';
import { PhotoCapture } from '../components/PhotoCapture';
import { navigate, useSession } from '../hooks';
import { drunkMl, roundKg } from '../model/calc';
import {
  ENTRY_ICON,
  ENTRY_LABEL,
  ENTRY_TYPES,
  WATER_KIND_LABEL,
  newId,
  type Entry,
  type EntryData,
  type EntryType,
  type MealData,
  type MedData,
  type StoolData,
  type UrineData,
  type VetData,
  type VitalData,
  type VomitData,
  type WaterData,
  type WaterKind,
  type WeightData,
} from '../model/entry';
import { blobToDataUrl } from '../util/blob';
import { fromDateTimeLocal, toDateTimeLocal } from '../util/format';

interface Props {
  /** `entry/new/<type>` or `entry/<id>` */
  route: string;
}

const LAST_KEY = (t: EntryType) => `pethealth:last:${t}`;

function loadLast<T extends EntryData>(t: EntryType): T | undefined {
  try {
    const raw = localStorage.getItem(LAST_KEY(t));
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function saveLast(t: EntryType, data: EntryData): void {
  try {
    localStorage.setItem(LAST_KEY(t), JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function defaultData(t: EntryType): EntryData {
  const last = loadLast(t);
  switch (t) {
    case 'water':
      return { kind: 'milk', ml: 0, ...(last as WaterData | undefined) };
    case 'meal':
      return { ...(last as MealData | undefined) };
    case 'med':
      return { name: '', given: true, ...(last as MedData | undefined) };
    case 'weight':
      return { kg: (last as WeightData | undefined)?.kg ?? 0 };
    default:
      return {};
  }
}

export function EntryForm({ route }: Props) {
  const { store, pet, user } = useSession();
  const isNew = route.startsWith('entry/new/');
  const [entry, setEntry] = useState<Entry | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!store || !pet || !user) return;
    if (isNew) {
      const type = route.slice('entry/new/'.length) as EntryType;
      if (!ENTRY_TYPES.includes(type)) {
        navigate('home');
        return;
      }
      const now = Date.now();
      setEntry({
        id: newId(),
        petId: pet.id,
        type,
        at: now,
        createdAt: now,
        createdBy: user.uid,
        createdByName: user.name,
        photoPaths: [],
        data: defaultData(type),
      });
    } else {
      const id = route.slice('entry/'.length);
      void store.getEntry(pet.id, id).then((e) => (e ? setEntry(e) : navigate('home')));
    }
  }, [route, store, pet?.id, user?.uid]);

  if (!entry || !store) return <div class="empty">読み込み中…</div>;

  const patch = (p: Partial<Entry>) => setEntry({ ...entry, ...p });
  const patchData = (p: Partial<EntryData>) =>
    setEntry({ ...entry, data: { ...entry.data, ...p } as EntryData });

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const photoPaths = [...entry.photoPaths];
      for (const p of pendingPhotos) {
        photoPaths.push(await store.savePhoto(entry.petId, entry.id, p.blob));
      }
      const final = { ...entry, photoPaths };
      await store.saveEntry(final);
      saveLast(final.type, final.data);
      navigate('home');
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm('この記録を削除しますか？')) return;
    await store.deleteEntry(entry.petId, entry.id);
    navigate('home');
  };

  return (
    <form
      class="form"
      onSubmit={(ev) => {
        ev.preventDefault();
        void save();
      }}
    >
      <h2>
        {ENTRY_ICON[entry.type]} {ENTRY_LABEL[entry.type]}
        {isNew ? 'を記録' : 'の記録を編集'}
      </h2>

      {(entry.type === 'stool' || entry.type === 'meal' || entry.type === 'vomit' || entry.type === 'note') && (
        <div class="field">
          <PhotoCapture
            onPhoto={(blob) =>
              void blobToDataUrl(blob).then((url) =>
                setPendingPhotos((ps) => [...ps, { blob, url }]),
              )
            }
          />
          {(entry.photoPaths.length > 0 || pendingPhotos.length > 0) && (
            <div class="thumbs" data-testid="pending-photos">
              {entry.photoPaths.map((p) => (
                <Photo key={p} path={p} />
              ))}
              {pendingPhotos.map((p, i) => (
                <img
                  key={p.url}
                  class="photo"
                  src={p.url}
                  alt=""
                  onClick={() => setPendingPhotos((ps) => ps.filter((_, j) => j !== i))}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div class="field">
        <label>日時（あとから直せます）</label>
        <input
          type="datetime-local"
          value={toDateTimeLocal(entry.at)}
          onChange={(ev) => patch({ at: fromDateTimeLocal(ev.currentTarget.value) })}
        />
      </div>

      <TypeFields entry={entry} patchData={patchData} />

      <div class="field">
        <label>メモ</label>
        <textarea
          value={entry.note ?? ''}
          onInput={(ev) => patch({ note: ev.currentTarget.value })}
          placeholder="気づいたことを自由に"
        />
      </div>

      {error && <div class="error">{error}</div>}

      <div class="actions">
        <button type="button" class="btn secondary" onClick={() => navigate('home')}>
          戻る
        </button>
        <button type="submit" class="btn" disabled={saving} data-testid="save">
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
      {!isNew && (
        <button type="button" class="btn danger" onClick={() => void remove()}>
          この記録を削除
        </button>
      )}
    </form>
  );
}

function Chips<T extends string | number | boolean>({
  value,
  options,
  onChange,
}: {
  value: T | undefined;
  options: { v: T; label: string }[];
  onChange: (v: T | undefined) => void;
}) {
  return (
    <div class="chips">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          class={value === o.v ? 'on' : ''}
          onClick={() => onChange(value === o.v ? undefined : o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TypeFields({
  entry,
  patchData,
}: {
  entry: Entry;
  patchData: (p: Partial<EntryData>) => void;
}) {
  switch (entry.type) {
    case 'stool': {
      const d = entry.data as StoolData;
      return (
        <>
          <div class="field">
            <label>硬さ（1 コロコロ … 4 ちょうどよい … 7 水様）</label>
            <Chips
              value={d.score}
              options={[1, 2, 3, 4, 5, 6, 7].map((v) => ({ v: v as 1, label: String(v) }))}
              onChange={(score) => patchData({ score })}
            />
          </div>
          <div class="field">
            <label>色</label>
            <Chips
              value={d.color}
              options={[
                { v: 'brown' as const, label: '茶' },
                { v: 'dark' as const, label: '濃い茶' },
                { v: 'light' as const, label: '薄い' },
                { v: 'yellow' as const, label: '黄' },
                { v: 'green' as const, label: '緑' },
                { v: 'black' as const, label: '黒' },
                { v: 'red' as const, label: '赤' },
              ]}
              onChange={(color) => patchData({ color })}
            />
          </div>
          <div class="field">
            <label>量</label>
            <Chips
              value={d.amount}
              options={[
                { v: 'small' as const, label: '少' },
                { v: 'normal' as const, label: '普通' },
                { v: 'large' as const, label: '多' },
              ]}
              onChange={(amount) => patchData({ amount })}
            />
          </div>
          <div class="field">
            <label>気になる点</label>
            <div class="chips">
              <button
                type="button"
                class={d.blood ? 'on' : ''}
                onClick={() => patchData({ blood: !d.blood })}
              >
                血が混じる
              </button>
              <button
                type="button"
                class={d.mucus ? 'on' : ''}
                onClick={() => patchData({ mucus: !d.mucus })}
              >
                粘液
              </button>
            </div>
          </div>
        </>
      );
    }
    case 'urine': {
      const d = entry.data as UrineData;
      return (
        <>
          <div class="field">
            <label>色</label>
            <Chips
              value={d.color}
              options={[
                { v: 'pale' as const, label: '薄い' },
                { v: 'normal' as const, label: '普通' },
                { v: 'dark' as const, label: '濃い' },
                { v: 'bloody' as const, label: '血尿' },
              ]}
              onChange={(color) => patchData({ color })}
            />
          </div>
          <div class="field">
            <label>量</label>
            <Chips
              value={d.amount}
              options={[
                { v: 'small' as const, label: '少' },
                { v: 'normal' as const, label: '普通' },
                { v: 'large' as const, label: '多' },
              ]}
              onChange={(amount) => patchData({ amount })}
            />
          </div>
        </>
      );
    }
    case 'water': {
      const d = entry.data as WaterData;
      return (
        <>
          <div class="field">
            <label>種類</label>
            <Chips
              value={d.kind}
              options={(Object.keys(WATER_KIND_LABEL) as WaterKind[]).map((k) => ({
                v: k,
                label: WATER_KIND_LABEL[k],
              }))}
              onChange={(kind) => patchData({ kind: kind ?? 'other' })}
            />
          </div>
          <div class="row">
            <div class="field">
              <label>与えた量 ml</label>
              <NumberInput
                value={d.offeredMl}
                onChange={(offeredMl) => {
                  const p: Partial<WaterData> = { offeredMl };
                  if (offeredMl !== undefined && d.leftMl !== undefined) {
                    p.ml = drunkMl(offeredMl, d.leftMl);
                  }
                  patchData(p);
                }}
              />
            </div>
            <div class="field">
              <label>残った量 ml</label>
              <NumberInput
                value={d.leftMl}
                onChange={(leftMl) => {
                  const p: Partial<WaterData> = { leftMl };
                  if (leftMl !== undefined && d.offeredMl !== undefined) {
                    p.ml = drunkMl(d.offeredMl, leftMl);
                  }
                  patchData(p);
                }}
              />
            </div>
          </div>
          <div class="field">
            <label>飲んだ量 ml（上の2つを入れると自動計算）</label>
            <NumberInput
              required
              value={d.ml || undefined}
              testId="water-ml"
              onChange={(n) => patchData({ ml: n ?? 0 })}
            />
          </div>
          {d.kind === 'milk' && (
            <div class="row">
              <div class="field">
                <label>ミルク原液 ml</label>
                <NumberInput value={d.milkMl} onChange={(milkMl) => patchData({ milkMl })} />
              </div>
              <div class="field">
                <label>薄める水 ml</label>
                <NumberInput value={d.waterMl} onChange={(waterMl) => patchData({ waterMl })} />
              </div>
            </div>
          )}
        </>
      );
    }
    case 'meal': {
      const d = entry.data as MealData;
      return (
        <>
          <div class="row">
            <div class="field">
              <label>フード・内容</label>
              <input
                type="text"
                value={d.food ?? ''}
                onInput={(ev) => patchData({ food: ev.currentTarget.value })}
              />
            </div>
            <div class="field">
              <label>量 g</label>
              <NumberInput value={d.grams} onChange={(grams) => patchData({ grams })} />
            </div>
          </div>
          <div class="field">
            <label>食べ残し</label>
            <Chips
              value={d.leftover}
              options={[
                { v: 'none' as const, label: '完食' },
                { v: 'half' as const, label: '半分残し' },
                { v: 'most' as const, label: 'ほぼ残し' },
              ]}
              onChange={(leftover) => patchData({ leftover })}
            />
          </div>
          <div class="field">
            <label>食欲（1 ない … 5 がっつく）</label>
            <Chips
              value={d.appetite}
              options={[1, 2, 3, 4, 5].map((v) => ({ v: v as 1, label: String(v) }))}
              onChange={(appetite) => patchData({ appetite })}
            />
          </div>
          <div class="field">
            <div class="chips">
              <button
                type="button"
                class={d.treat ? 'on' : ''}
                onClick={() => patchData({ treat: !d.treat })}
              >
                おやつ
              </button>
              <button
                type="button"
                class={d.therapeutic ? 'on' : ''}
                onClick={() => patchData({ therapeutic: !d.therapeutic })}
              >
                療法食
              </button>
            </div>
          </div>
        </>
      );
    }
    case 'med': {
      const d = entry.data as MedData;
      return (
        <>
          <div class="row">
            <div class="field">
              <label>薬・サプリの名前</label>
              <input
                type="text"
                required
                value={d.name}
                onInput={(ev) => patchData({ name: ev.currentTarget.value })}
              />
            </div>
            <div class="field">
              <label>用量</label>
              <input
                type="text"
                value={d.dose ?? ''}
                placeholder="1錠・0.5ml など"
                onInput={(ev) => patchData({ dose: ev.currentTarget.value })}
              />
            </div>
          </div>
          <div class="field">
            <Chips
              value={d.given}
              options={[
                { v: true, label: '✓ 飲ませた' },
                { v: false, label: 'まだ' },
              ]}
              onChange={(given) => patchData({ given: given ?? false })}
            />
          </div>
        </>
      );
    }
    case 'weight': {
      const d = entry.data as WeightData;
      return (
        <div class="field">
          <label>体重 kg</label>
          <NumberInput
            required
            value={d.kg || undefined}
            testId="weight-kg"
            onChange={(n) => patchData({ kg: roundKg(n ?? 0) })}
          />
        </div>
      );
    }
    case 'vital': {
      const d = entry.data as VitalData;
      return (
        <div class="row">
          <div class="field">
            <label>体温 ℃</label>
            <NumberInput value={d.tempC} onChange={(tempC) => patchData({ tempC })} />
          </div>
          <div class="field">
            <label>安静時呼吸 /分</label>
            <NumberInput
              inputMode="numeric"
              value={d.rrPerMin}
              onChange={(rrPerMin) => patchData({ rrPerMin })}
            />
          </div>
          <div class="field">
            <label>心拍 /分</label>
            <NumberInput
              inputMode="numeric"
              value={d.hrPerMin}
              onChange={(hrPerMin) => patchData({ hrPerMin })}
            />
          </div>
        </div>
      );
    }
    case 'vomit': {
      const d = entry.data as VomitData;
      return (
        <>
          <div class="field">
            <label>内容</label>
            <Chips
              value={d.content}
              options={[
                { v: 'food' as const, label: '食べ物' },
                { v: 'foam' as const, label: '泡' },
                { v: 'bile' as const, label: '黄色い液' },
                { v: 'other' as const, label: 'その他' },
              ]}
              onChange={(content) => patchData({ content })}
            />
          </div>
          <div class="field">
            <label>回数</label>
            <NumberInput inputMode="numeric" value={d.count} onChange={(count) => patchData({ count })} />
          </div>
        </>
      );
    }
    case 'vet': {
      const d = entry.data as VetData;
      return (
        <>
          <div class="field">
            <label>病院</label>
            <input
              type="text"
              value={d.clinic ?? ''}
              onInput={(ev) => patchData({ clinic: ev.currentTarget.value })}
            />
          </div>
          <div class="field">
            <label>診断・所見</label>
            <input
              type="text"
              value={d.diagnosis ?? ''}
              onInput={(ev) => patchData({ diagnosis: ev.currentTarget.value })}
            />
          </div>
          <div class="field">
            <label>処方</label>
            <input
              type="text"
              value={d.prescription ?? ''}
              onInput={(ev) => patchData({ prescription: ev.currentTarget.value })}
            />
          </div>
          <div class="row">
            <div class="field">
              <label>費用 円</label>
              <NumberInput
                inputMode="numeric"
                value={d.costYen}
                onChange={(costYen) => patchData({ costYen })}
              />
            </div>
            <div class="field">
              <label>次回予約</label>
              <input
                type="date"
                value={d.nextVisit ?? ''}
                onInput={(ev) => patchData({ nextVisit: ev.currentTarget.value })}
              />
            </div>
          </div>
        </>
      );
    }
    default:
      return null;
  }
}
