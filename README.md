# わんこ健康ノート（PetHealth）

高齢犬の便・飲水・食事・体調をスマホで記録する PWA です。
Android の Chrome で開いて「ホーム画面に追加」すると、アプリのように使えます。

## できること（現時点）

- ワンタップ記録：便（写真＋硬さ 1〜7・色・量・血／粘液）、飲水（水／薄めミルク／ささみ煮汁、与えた量−残った量で自動計算、希釈比）、食事、尿、薬、メモ。ほかに体重・バイタル・嘔吐・通院も記録可。
- 日時はあとから直せる。前回の値が初期値に入る。
- 1 日のタイムライン（写真サムネイル・誰が記録したか）。日送りで過去も見られる。
- グラフ：飲水量（種類別積み上げ・ml/kg・目安ライン 50〜60、多飲 100）、便の回数と硬さ、体重。7／14／30 日切替。
- 家族共有：Google ログイン＋招待コードで同じ記録を読み書き（Firebase 設定時）。
- オフラインでも記録でき、電波が戻ると同期。写真は端末で縮小してから保存。
- バックアップ：JSON 書き出し。

Firebase を設定しなければ「この端末のみ」モードで動きます（データは端末内の IndexedDB）。

## 開発

```bash
npm install
npm run dev        # http://localhost:5173（--host 付きなので同じ Wi-Fi のスマホからも開ける）
npm test           # 集計ロジックの単体テスト（Vitest）
npm run build      # 型チェック → dist/ に出力
npm run preview    # dist/ を配信して確認
```

## 家族共有を有効にする（Firebase）

1. <https://console.firebase.google.com> で新しいプロジェクトを作る（Analytics は不要）。
2. **Authentication** → ログイン方法 → **Google** を有効化。
3. **Firestore Database** を作成（本番モード・リージョンは asia-northeast1 など）。
4. **Storage** を作成。
5. プロジェクトの設定 → マイアプリ → **ウェブアプリ** を追加 → 表示される `firebaseConfig` の値を `.env.local` に貼る：
   ```bash
   cp .env.example .env.local
   # VITE_FIREBASE_API_KEY=... などを埋める
   ```
6. セキュリティルールを配置し、Hosting に公開する（初回は `npm i -g firebase-tools` と `firebase login`）：
   ```bash
   firebase use --add            # 上で作ったプロジェクトを選ぶ
   firebase deploy --only firestore:rules,storage
   npm run build
   firebase deploy --only hosting
   ```
7. 表示された URL を Android Chrome で開き、Google でログイン → 「はじめて使う」で家の名前を入れる → わんこを登録。
8. 家族には **設定 → 家族と共有** の 6 文字コードを伝える。家族は同じ URL を開いてログインし「家族に招待された」にコードを入れる。

Firestore の複合インデックスを求めるエラーがコンソールに出たら、エラー文中のリンクを開いて作成する（`entries` の `at` 昇順）。

## 構成

```
src/
  main.tsx              エントリ（Service Worker 登録）
  app.tsx               画面切替（#/home, #/charts, #/settings, #/entry/...）
  session.ts            ログイン・世帯・ペット・Store の選択
  firebase.ts           Firebase 初期化（未設定ならローカルモード）
  model/entry.ts        記録の型
  model/calc.ts         日別集計・ml/kg 換算（tests/calc.test.ts）
  store/types.ts        Store インターフェース
  store/local.ts        IndexedDB のみ
  store/cloud.ts        Firestore + Storage（写真は送信待ち行列つき）
  pages/Home.tsx        ワンタップボタン＋タイムライン
  pages/EntryForm.tsx   記録の入力・編集
  pages/Charts.tsx      グラフ
  pages/Settings.tsx    ログイン・世帯・ペット・バックアップ
  components/PhotoCapture.tsx  カメラ起動と縮小
firestore.rules / storage.rules  世帯メンバーだけ読み書き可
```

## データ

```
households/{hid}                       name, memberUids[], inviteCode
households/{hid}/pets/{petId}          name, breed, sex, birthDate, currentWeightKg
households/{hid}/pets/{petId}/entries/{entryId}
    type   'stool'|'urine'|'water'|'meal'|'med'|'weight'|'vital'|'vomit'|'vet'|'note'
    at     発生時刻（epoch ms）   createdAt / createdBy / createdByName
    note   メモ                   photoPaths[]  Storage のパス
    data   type 別の項目（water: kind, ml, offeredMl, leftMl, milkMl, waterMl など）
```

## 今後

- 診察用サマリー（直近 7／14／30 日を 1 枚に・印刷／PDF）、CSV 書き出し
- 投薬・記録忘れのリマインダー通知（Firebase Cloud Messaging）
- 患部写真の定点比較、血液検査値のグラフ
