# 保険証券分析・診断ダッシュボード — 技術仕様書

## 1. 概要

保険コンサルタント向けの保険証券分析・診断ツール。顧客ケースごとに家族情報、代理店情報、保険証券、分析メモ、取込用プロンプトを管理し、保障内容と現在の保険料負担を可視化する。印刷時はA4横向きの診断レポートとして、表紙、サマリー、グラフ、個別証券分析をページ番号付きで出力する。

### 技術スタック

| レイヤー | 技術 |
|---|---|
| フレームワーク | Next.js 16 App Router |
| フロントエンド | React 19, TypeScript 6 |
| チャート | Recharts 3 |
| アイコン | lucide-react |
| データベース | SQLite, better-sqlite3 |
| 実行環境 | Docker, node:22-alpine |

### ディレクトリ構成

```text
insurance-app/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── api/
│       ├── agency-masters/
│       ├── app-state/
│       ├── backup/
│       ├── cases/
│       ├── health/
│       ├── insurance-type-descriptions/
│       ├── policies/import-csv/
│       ├── portfolio-insights/
│       └── settings/policy-prompt/
├── components/
├── lib/
│   ├── api.ts
│   ├── db.ts
│   └── policyPrompt.ts
├── services/
├── validators/
├── utils/
├── scripts/
├── data/
└── types.ts
```

---

## 2. データモデル

### 2.1 主要型

#### PolicyType

| 値 |
|---|
| 個人年金保険 |
| 収入保障保険 |
| 変額終身保険 |
| 医療保険 |
| 終身保険 |
| 養老保険 |

#### FamilyMember

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | UUID |
| `name` | string | 氏名 |
| `nameKana` | string | フリガナ |
| `relationship` | string | 続柄 |
| `birthDate` | string | 生年月日 `YYYY-MM-DD` |
| `gender` | `male` / `female` | 性別 |

#### Policy

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | UUID |
| `companyName` | string | 保険会社名 |
| `policyType` | PolicyType | 保険種類 |
| `policyNumber` | string | 証券番号 |
| `contractDate` | string | 契約日 |
| `contractAge` | number | 契約年齢 |
| `insuredId` | string | 被保険者 `FamilyMember.id` |
| `beneficiaryId` | string | 受取人 `FamilyMember.id` |
| `deathBenefitDisease` | number | 死亡保障・疾病 |
| `deathBenefitAccident` | number | 死亡保障・災害 |
| `hospDayDisease` | number | 入院日額・疾病 |
| `hospDayAccident` | number | 入院日額・災害 |
| `diagnosisBenefit` | number | 診断一時金 |
| `policyEndAge` | number | 保険期間終了年齢、`999` は終身 |
| `paymentFrequency` | `monthly` / `annual` / `single` | 払込頻度 |
| `premiumAmount` | number | 1回あたり保険料 |
| `paymentEndAge` | number | 払込終了年齢、`999` は終身払い |
| `annualPremium` | number | 年間保険料 |
| `maturityBenefit` | number | 満期保険金 |
| `consultantNote` | string | コンサルタントメモ |

---

## 3. SQLiteスキーマ

DB接続は `lib/db.ts` に集約する。`DATABASE_PATH` が指定されていない場合、通常環境は `data/insurance.sqlite`、サーバーレス環境は `/tmp/insurance.sqlite` を使う。起動時にWALモードと外部キー制約を有効化する。

### テーブル一覧

| テーブル | 目的 |
|---|---|
| `cases` | 顧客ケース |
| `agencies` | ケース単位の代理店情報 |
| `family_members` | 家族情報 |
| `policies` | 保険証券 |
| `app_state_meta` | ケース単位のスキーマ・出力メタ情報 |
| `agency_masters` | 代理店マスター |
| `insurance_type_descriptions` | 保険種類別の説明文・目的の上書き |
| `portfolio_insights` | ケース単位のポートフォリオ分析コメント |
| `app_settings` | アプリ共通設定。現在は証券取込プロンプトを保存 |

### 主要制約

| 対象 | 制約 |
|---|---|
| `agencies.case_id` | `UNIQUE`, `cases(id)` へ `ON DELETE CASCADE` |
| `family_members.case_id` | `cases(id)` へ `ON DELETE CASCADE` |
| `family_members.gender` | `male` / `female` のみ |
| `policies.case_id` | `cases(id)` へ `ON DELETE CASCADE` |
| `policies.insured_member_id` | `family_members(id)` へ `ON DELETE RESTRICT` |
| `policies.beneficiary_member_id` | `family_members(id)` へ `ON DELETE SET NULL` |
| `policies.payment_frequency` | `monthly` / `annual` / `single` のみ |
| `portfolio_insights.type` | `gap` / `redundancy` / `recommendation` のみ |
| `app_settings.setting_key` | 主キー。`policy_import_prompt` を保存 |

### インデックス

| インデックス | 対象 |
|---|---|
| `idx_family_members_case_id_sort_order` | `family_members(case_id, sort_order)` |
| `idx_policies_case_id_sort_order` | `policies(case_id, sort_order)` |
| `idx_policies_case_id_policy_number` | `policies(case_id, policy_number)` |
| `idx_policies_insured_member_id` | `policies(insured_member_id)` |
| `idx_policies_beneficiary_member_id` | `policies(beneficiary_member_id)` |
| `idx_portfolio_insights_case_id` | `portfolio_insights(case_id, sort_order)` |

---

## 4. API仕様

### 4.1 顧客ケース

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/api/cases` | ケース一覧取得 |
| `POST` | `/api/cases` | 空のケース作成。本人1名と空の代理店情報を初期化 |
| `DELETE` | `/api/cases/[id]` | ケース削除。関連データはカスケード削除 |

### 4.2 診断データ

全エンドポイントで `caseId` クエリが必須。

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/api/app-state?caseId=...` | AppState取得 |
| `PUT` | `/api/app-state?caseId=...` | AppState保存 |
| `POST` | `/api/app-state/reset?caseId=...` | サンプルデータにリセット |
| `POST` | `/api/app-state/clear?caseId=...` | 証券削除、本人1名へ初期化 |
| `GET` | `/api/app-state/export?caseId=...` | JSONエクスポート |

`PUT /api/app-state` は既存の家族・証券・代理店情報をトランザクション内で差し替える。サンプルリセットでは固定IDをケースごとのUUIDへ再マッピングし、複数ケース間のID衝突を防ぐ。

### 4.3 代理店マスター

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/api/agency-masters` | 一覧取得 |
| `POST` | `/api/agency-masters` | 新規作成 |
| `PUT` | `/api/agency-masters/[id]` | 更新 |
| `DELETE` | `/api/agency-masters/[id]` | 削除 |

ケースごとの代理店情報は `agencies` に保存する。顧客情報モーダルの「設定を保存」は `PUT /api/app-state` を呼び、世帯情報と代理店情報をSQLiteへ即時保存する。よく使う代理店は同じモーダル内で `agency_masters` に新規保存・更新し、別ケースから呼び出せる。

### 4.4 CSV取込

#### `POST /api/policies/import-csv`

`multipart/form-data` でCSVを送信する。

| フィールド | 型 | 説明 |
|---|---|---|
| `file` | File | `.csv`、最大5MB |
| `caseId` | string | 対象ケースID |
| `overwriteDuplicates` | string | `true` の場合、重複証券番号を上書き |

UTF-8 BOM有無とCP932を自動判定する。1行でもバリデーションエラーがある場合は全行を取り込まない。重複証券番号がある場合は `409 Conflict` として重複一覧を返す。

### 4.5 証券取込プロンプト

#### `GET /api/settings/policy-prompt`

SQLiteの `app_settings` から `policy_import_prompt` を取得する。未保存の場合は `lib/policyPrompt.ts` のデフォルトを返す。

```json
{
  "prompt": "string",
  "source": "saved | default",
  "updatedAt": "string | null"
}
```

#### `PUT /api/settings/policy-prompt`

```json
{
  "prompt": "string"
}
```

空文字は `400`、20,000文字超は `400`。保存後は `source: "saved"` を返す。旧実装のlocalStorage値がある場合はクライアント側で1回だけSQLiteへ移行する。

デフォルトプロンプトは、保険証券画像から1証券分だけJSON出力させる用途。出力キーには `保険会社`、`証券番号`、`保険種類`、`被保険者`、`被保険者生年月日`、`契約年齢`、`契約日`、`受取人`、保障金額、保険料、払込終了年齢、満期保険金、コンサルタントメモを含める。

### 4.6 分析コメント・説明文

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/api/insurance-type-descriptions` | 保険種類別の説明文一覧 |
| `PUT` | `/api/insurance-type-descriptions` | 保険種類別の説明文・目的を保存 |
| `GET` | `/api/portfolio-insights?caseId=...` | ケース単位の分析コメント取得 |
| `PUT` | `/api/portfolio-insights?caseId=...` | 分析コメント保存 |
| `DELETE` | `/api/portfolio-insights?caseId=...` | 分析コメント削除 |

### 4.7 バックアップ・ヘルスチェック

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/api/backup` | SQLiteファイルをダウンロード |
| `POST` | `/api/backup` | SQLiteファイルを復元 |
| `GET` | `/api/health` | `{ "status": "ok", "database": "ok" }` を返す |

---

## 5. バリデーション

### AppState保存

`validators/appState.ts` でサーバー側検証を行う。

- `familyMembers` は1件以上
- 家族は `id`、`name`、`relationship`、`birthDate`、`gender` を検証
- `gender` は `male` / `female`
- `agency` は `name`、`representative`、`phone` を文字列として検証
- `policies` は配列必須
- 証券は `companyName`、`policyType`、`contractDate`、`contractAge`、`insuredId`、`policyEndAge`、`paymentFrequency`、`premiumAmount`、`paymentEndAge` を検証

### CSV取込

- 保険会社、保険種類、契約日、被保険者、保険期間、払方、保険料は必須
- 保険種類は定義済み6種類
- 被保険者と受取人は家族情報の氏名に一致する必要がある
- 払方は日本語表記を `monthly` / `annual` / `single` へ正規化
- 払込終了年月日または払込終了年齢のどちらかが必要

---

## 6. 分析ロジック

### 保険料計算

| 関数 | 説明 |
|---|---|
| `getMonthlyPremium(policy)` | 月払はそのまま、年払は12分割、一時払は0 |
| `getActiveMonthlyPremium(policy, currentAge)` | 現在の月額保険料負担。月払・年払のみ対象 |
| `calculateTotalPremiumsPaid(policy, currentAge)` | 現在までの累計払込額 |
| `calculateProjectedTotalPremiums(policy)` | 払込完了までの総払込見込額 |
| `calculateRemainingPremiums(policy, currentAge)` | 残り払込額 |

`getActiveMonthlyPremium` は「現在の月額保険料負担」カードと証券一覧の集計行で使用する。

- 一時払いは常に除外
- 年払いは `premiumAmount / 12` で月換算
- 本人の生年月日から現在年齢を算出できる場合、`currentAge >= paymentEndAge` の証券は除外
- `paymentEndAge = 999` は終身払いとして払込終了済みにしない
- 生年月日未入力で現在年齢が不明な場合、払込終了判定は行わず、一時払いのみ除外する

### 保障分析

| 関数 | 説明 |
|---|---|
| `getCurrentDeathBenefit(policy, currentAge)` | 現在の死亡保障額。収入保障保険は逓減計算 |
| `getRemainingCoverageYears(policy, currentAge)` | 残り保障年数。終身は `lifetime` |
| `getRemainingPaymentYears(policy, currentAge)` | 残り払込年数 |
| `isPaidUp(policy, currentAge)` | 払込終了済み判定 |
| `isExpired(policy, currentAge)` | 保障終了済み判定 |

### ポートフォリオ分析

`analyzePortfolio(policies, currentAge)` は有効証券をもとに不足・重複・推奨コメントを生成する。ユーザー編集済みのコメントは `portfolio_insights` に保存できる。

| 種別 | 主な条件 |
|---|---|
| `gap` | 有効な医療保険がない、有効な死亡保障がない |
| `recommendation` | 医療保険や収入保障の保障終了が近い、終身型死亡保障がない |
| `redundancy` | 死亡保障付き証券が3件以上 |

---

## 7. 画面・コンポーネント仕様

### 7.1 画面構成

```text
CaseListPage
  ↓ ケース選択
MainDashboard
  ├── PrintCoverPage
  ├── SummaryDashboard
  ├── PolicyTable
  ├── CoverageChart / CostChart
  └── PolicyAnalysisSection
        ├── InsuranceTypeOverview
        └── PolicyAnalysisCard × N
```

### 7.2 SummaryDashboard

| カード | 内容 |
|---|---|
| 現在の月額保険料負担 | `getActiveMonthlyPremium` の合計。対象件数と除外条件を表示 |
| 現在の死亡保障額 | 有効証券の死亡保障合計。収入保障は現在年齢で逓減 |
| 現在の入院日額 | 有効証券の疾病入院日額合計 |

### 7.3 PolicyTable

- No.、保険種類、保険会社、証券番号、死亡保障、入院日額、受取人、保険料を表示
- 画面上ではドラッグハンドルで並び替え可能
- 保険料欄に払方、月換算、一時払、払込済、保障終了の状態を表示
- 集計行は死亡保障合計、入院日額合計、現在月額負担計を表示
- 現在月額負担計は一時払と払込終了済みを除外する

### 7.4 CoverageChart / CostChart

- CoverageChartは死亡保障がある証券だけを対象にし、証券一覧の並び順で凡例・色・積み上げ系列を表示する。並び順変更時はチャートを再生成してRechartsの内部スタック順も更新し、一覧の上から順番がグラフの上から順番に見えるように積み上げ描画は逆順で登録する
- CostChartは現在年齢から将来の月額保険料負担推移を表示する

### 7.5 PolicyForm

- 証券の追加・編集モーダル
- 金額入力はカンマ区切り表示
- JSON貼り付け、JSONファイル、プロンプト表示を提供
- JSON取込では `被保険者生年月日` を読み取り、家族情報の作成・補完に利用する
- 受取人が「同上」「本人」「被保険者と同じ」の場合は被保険者と同一人物として扱う
- プロンプトはSQLiteの `app_settings` に保存する

### 7.6 CustomerModal

- 世帯・家族情報とケース別代理店情報を編集する
- 「設定を保存」で `PUT /api/app-state` を実行し、SQLiteへ即時保存する
- 代理店マスターを選択すると、代理店名・取扱者名・電話番号を呼び出す
- 入力中の代理店情報を代理店マスターへ新規保存できる
- 選択中の代理店マスターを現在の入力内容で更新できる

### 7.7 InsuranceTypeOverview

- 証券を保険種類ごとにグループ化
- 保険種類別の説明文、目的、件数、保障・保険料集計を表示
- 説明文と目的は `insurance_type_descriptions` で上書き可能
- ポートフォリオ分析コメントは追加・編集・削除・リセット可能

### 7.8 PolicyAnalysisCard

- 個別証券の保障内容、費用分析、評価バッジ、メモを表示
- 個人年金保険は受取開始年齢、受取期間、年間受取額、返戻率を表示
- ミニチャートで保障額推移または積立・受取推移を表示

---

## 8. 印刷仕様

`@media print` で制御する。A4横向き、余白10mm。

| ページ | 内容 |
|---|---|
| 1ページ目 | 表紙 |
| 2ページ目 | ヘッダー、サマリーカード、証券一覧 |
| 3ページ目 | 保障推移グラフ、保険料負担推移グラフ |
| 4ページ目以降 | 種類別概要、個別証券分析 |

### 印刷レイアウト方針

- 操作ボタン、入力フォーム、検索欄、ドラッグハンドルは非表示
- サマリーカードと証券一覧は同一ページに収める
- グラフは1ページ内に上下配置する
- 種類別概要のあと、個別証券分析を1証券1ページで出力する
- 個別分析の直前に空白ページが入らないよう、最初の分析カードには強制改ページを付けない
- `PrintPageNumber` で `現在ページ / 総ページ` を右下へ表示する
- 配色は `print-color-adjust: exact` で保持する
- A4横の印刷可能領域ぴったりの高さを使うとブラウザの丸め誤差で最終空白ページが出るため、印刷ページコンテナは188mmに収め、最後の要素では追加改ページしない

---

## 9. Docker構成

### Dockerfile

| ステージ | 用途 |
|---|---|
| `base` | node:22-alpine、better-sqlite3ビルド用パッケージ導入 |
| `deps` | `npm ci` |
| `dev` | `npm run dev`、ホットリロード |
| `builder` | `npm run build` |
| `runner` | Next.js standaloneサーバー |

### 開発

```powershell
docker compose up -d --build
```

| 項目 | 値 |
|---|---|
| ポート | `3030:3030` |
| DB | `/app/data/insurance.sqlite` |
| ボリューム | ソース主要ディレクトリは読み取り専用、`data` は書き込み可 |
| メモリ制限 | 開発 512MB / 本番 192m |

### 本番ビルド確認

```powershell
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache insurance-app
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

本番オーバーライドは `runner` ターゲットを使い、開発用のソースコードマウントを外して `./data:/app/data` のみをマウントする。Windowsのbind mount上のSQLiteを書き込めるよう、このローカル本番構成ではサービスを `root` ユーザーで起動する。実行時メモリは `mem_limit: 192m`、Node.jsヒープは `NODE_OPTIONS=--max-old-space-size=128` で抑制する。標準ポートは `3030` とし、`3020` は他用途との競合を避けるため使わない。

---

## 10. 検証

| 目的 | コマンド |
|---|---|
| TypeScriptチェック | `docker compose exec -T insurance-app ./node_modules/.bin/tsc --noEmit --pretty false` |
| サンプルリセットAPI確認 | `docker compose exec -T insurance-app npm run test:sample-reset` |
| 本番Dockerビルド | `docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache insurance-app` |
| ヘルスチェック | `curl http://localhost:3030/api/health` |

---

## 11. サンプルデータ

サンプルリセットでは本人、配偶者、代理店情報、4件の証券を投入する。

| 保険会社 | 保険種類 | 主な内容 |
|---|---|---|
| 住友生命 | 個人年金保険 | 満期金 500万円 |
| プルデンシャル生命 | 収入保障保険 | 死亡保障 1,560万円 |
| プルデンシャル生命 | 変額終身保険 | 死亡保障 500万円 |
| プルデンシャル生命 | 医療保険 | 入院日額 10,000円、診断一時金 50万円 |
