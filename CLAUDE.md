# PetHealth — わんこ健康ノート

高齢犬（ビションフリーゼ・オス・15歳）の便・飲水・食事・体調を家族で記録する PWA。
栄養サポート（EiyoSupportNew）とは**無関係の独立プロジェクト**。あちらの規約・メモリは読まない。

## 読む順
1. この文書
2. `README.md`（できること・開発・Firebase 設定・構成）
3. `docs/requirements.md`（要件と実装計画・フェーズ）
4. `docs/memory/daily/` の最新 2 本（あれば）

## 技術
Vite 7 + TypeScript 5.9 + Preact 10 + Chart.js 4 + Firebase 12（Auth / Firestore / Storage）+ idb。
配信は Firebase Hosting。対象端末は Android Chrome（ホーム画面に追加）。

## 規約
- コード内コメントは英語。画面の文言は日本語。
- `src/model/calc.ts` は純粋関数のみ（DOM・Firebase を持ち込まない）。集計を足したら `tests/calc.test.ts` に必ずテストを足す。
- Store インターフェース（`src/store/types.ts`）を通して保存する。画面から Firestore を直接呼ばない。
- 変更後は `npm run build`（型チェック込み）と `npm test` を通してから commit。
- コミットメッセージは日本語で「何を・なぜ」。作業の区切りごとに push。
- 作業ログは `docs/memory/daily/YYYY-MM-DD.md` に無圧縮で追記（1 日 1 ファイル）。

## 調査役のモデル
サブエージェント・Workflow などトークンを消費する調査は sonnet か opus で回す（Fable は使わない）。
