# 保険証券分析・診断ダッシュボード — 技術仕様書

## 1. 概要

保険コンサルタント向けの保険証券分析・診断ツール。顧客の保険証券情報を一元管理し、保障内容の可視化・分析・診断レポート印刷を行う。

### 技術スタック

| レイヤー | 技術 |
|---|---|
| フレームワーク | Next.js 16 (App Router, Turbopack) |
| フロントエンド | React 19, TypeScript 6 |
| チャート | Recharts 3 |
| アイコン | lucide-react |
| データベース | SQLite (better-sqlite3) |
| 実行環境 | Docker (node:22-alpine) |

### ディレクトリ構成

```
insurance-app/
├── app/                    # Next.js App Router
│   ├── layout.tsx          #   ルートレイアウト (lang="ja")
│   ├── page.tsx            #   メインページ (状態管理)
│   ├── globals.css         #   統合スタイルシート
│   └── api/                #   Route Handlers
│       ├── cases/          #     顧客ケース CRUD
│       ├── app-state/      #     診断データ取得・保存・リセット・消去・出力
│       ├── policies/       #     CSV 取込
│       └── health/         #     ヘルスチェック
├── components/             # React コンポーネント (13ファイル)
├── lib/                    # API クライアント, DB 接続
├── services/               # ビジネスロジック
├── validators/             # 入力バリデーション
├── utils/                  # 分析ユーティリティ
├── data/                   # サンプル・モックデータ
└── types.ts                # 共通型定義
```

---

## 2. データモデル

### 2.1 型定義 (types.ts)

#### PolicyType (保険種類)

| 値 | 説明 |
|---|---|
| `個人年金保険` | 個人年金 |
| `収入保障保険` | 収入保障 |
| `変額終身保険` | 変額終身 |
| `医療保険` | 医療 |
| `終身保険` | 終身 |
| `養老保険` | 養老 |

#### FamilyMember (家族情報)

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | UUID |
| `name` | string | 氏名 |
| `nameKana` | string | フリガナ (カタカナ、任意) |
| `relationship` | string | 続柄 (本人, 配偶者, 長男 等) |
| `birthDate` | string | 生年月日 (YYYY-MM-DD) |
| `gender` | `'male' \| 'female'` | 性別 |

#### Policy (保険証券)

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | UUID |
| `companyName` | string | 保険会社名 |
| `policyType` | PolicyType | 保険種類 |
| `policyNumber` | string | 証券番号 |
| `contractDate` | string | 契約日 (YYYY-MM-DD) |
| `contractAge` | number | 契約年齢 |
| `insuredId` | string | 被保険者 ID (FamilyMember.id) |
| `beneficiaryId` | string | 受取人 ID (FamilyMember.id) |
| `deathBenefitDisease` | number | 死亡保障 (疾病, 円) |
| `deathBenefitAccident` | number | 死亡保障 (災害, 円) |
| `hospDayDisease` | number | 入院日額 (疾病, 円) |
| `hospDayAccident` | number | 入院日額 (災害, 円) |
| `diagnosisBenefit` | number | 診断一時金 (円) |
| `policyEndAge` | number | 保険期間終了年齢 (999=終身) |
| `paymentFrequency` | `'monthly' \| 'annual' \| 'single'` | 払込頻度 |
| `premiumAmount` | number | 保険料 (円) |
| `paymentEndAge` | number | 払込終了年齢 |
| `annualPremium` | number | 年間保険料 (円, 自動計算) |
| `maturityBenefit` | number | 満期保険金 (円) |
| `consultantNote` | string? | コンサルタントメモ |

#### Agency (代理店情報)

| フィールド | 型 | 説明 |
|---|---|---|
| `name` | string | 代理店名 |
| `representative` | string | 取扱者名 |
| `phone` | string | 電話番号 |

#### AgencyMaster (代理店マスター)

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | UUID |
| `name` | string | 代理店名 |
| `representative` | string | 取扱者名 |
| `phone` | string | 電話番号 |

#### AppState (アプリケーション状態)

| フィールド | 型 |
|---|---|
| `familyMembers` | FamilyMember[] |
| `agency` | Agency |
| `policies` | Policy[] |
| `updatedAt` | string? (ISO 8601) |

### 2.2 データベーススキーマ (SQLite)

WAL モード、外部キー制約有効。パス: `./data/insurance.sqlite`

#### cases テーブル

| カラム | 型 | 制約 |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `title` | TEXT | NOT NULL |
| `created_at` | TEXT | DEFAULT datetime('now') |
| `updated_at` | TEXT | DEFAULT datetime('now') |

#### agencies テーブル

| カラム | 型 | 制約 |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `case_id` | TEXT | NOT NULL, UNIQUE, FK → cases ON DELETE CASCADE |
| `name` | TEXT | NOT NULL |
| `representative` | TEXT | NOT NULL |
| `phone` | TEXT | NOT NULL |

#### family_members テーブル

| カラム | 型 | 制約 |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `case_id` | TEXT | NOT NULL, FK → cases ON DELETE CASCADE |
| `name` | TEXT | NOT NULL |
| `name_kana` | TEXT | NOT NULL, DEFAULT '' |
| `relationship` | TEXT | NOT NULL |
| `birth_date` | TEXT | NOT NULL |
| `gender` | TEXT | NOT NULL, CHECK ('male', 'female') |
| `sort_order` | INTEGER | NOT NULL, DEFAULT 0 |

#### policies テーブル

| カラム | 型 | 制約 |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `case_id` | TEXT | NOT NULL, FK → cases ON DELETE CASCADE |
| `company_name` | TEXT | NOT NULL |
| `policy_type` | TEXT | NOT NULL |
| `policy_number` | TEXT | |
| `contract_date` | TEXT | NOT NULL |
| `contract_age` | INTEGER | NOT NULL |
| `insured_member_id` | TEXT | NOT NULL, FK → family_members ON DELETE RESTRICT |
| `beneficiary_member_id` | TEXT | FK → family_members ON DELETE SET NULL |
| `death_benefit_disease` | INTEGER | NOT NULL, DEFAULT 0 |
| `death_benefit_accident` | INTEGER | NOT NULL, DEFAULT 0 |
| `hosp_day_disease` | INTEGER | NOT NULL, DEFAULT 0 |
| `hosp_day_accident` | INTEGER | NOT NULL, DEFAULT 0 |
| `diagnosis_benefit` | INTEGER | NOT NULL, DEFAULT 0 |
| `policy_end_age` | INTEGER | NOT NULL |
| `payment_frequency` | TEXT | NOT NULL, CHECK ('monthly', 'annual', 'single') |
| `premium_amount` | INTEGER | NOT NULL, DEFAULT 0 |
| `payment_end_date` | TEXT | |
| `payment_end_age` | INTEGER | NOT NULL |
| `annual_premium` | INTEGER | NOT NULL, DEFAULT 0 |
| `maturity_benefit` | INTEGER | NOT NULL, DEFAULT 0 |
| `consultant_note` | TEXT | |
| `sort_order` | INTEGER | NOT NULL, DEFAULT 0 |

#### app_state_meta テーブル

| カラム | 型 | 制約 |
|---|---|---|
| `case_id` | TEXT | PRIMARY KEY, FK → cases ON DELETE CASCADE |
| `schema_version` | INTEGER | NOT NULL, DEFAULT 1 |
| `updated_at` | TEXT | DEFAULT datetime('now') |
| `last_exported_at` | TEXT | |

#### agency_masters テーブル

| カラム | 型 | 制約 |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `name` | TEXT | NOT NULL |
| `representative` | TEXT | NOT NULL |
| `phone` | TEXT | NOT NULL |
| `created_at` | TEXT | DEFAULT datetime('now') |
| `updated_at` | TEXT | DEFAULT datetime('now') |

#### インデックス

| インデックス名 | 対象 |
|---|---|
| `idx_family_members_case_id_sort_order` | family_members(case_id, sort_order) |
| `idx_policies_case_id_sort_order` | policies(case_id, sort_order) |
| `idx_policies_case_id_policy_number` | policies(case_id, policy_number) |
| `idx_policies_insured_member_id` | policies(insured_member_id) |
| `idx_policies_beneficiary_member_id` | policies(beneficiary_member_id) |

---

## 3. API 仕様

### 3.1 顧客ケース管理

#### GET /api/cases

一覧取得。

**レスポンス** `200 OK`
```json
[
  {
    "id": "string",
    "title": "string",
    "primaryMemberName": "string",
    "primaryMemberNameKana": "string",
    "memberCount": 0,
    "policyCount": 0,
    "updatedAt": "string | null"
  }
]
```

#### POST /api/cases

新規作成。デフォルトの家族 (本人1名) と空の代理店情報で初期化。

**レスポンス** `201 Created` — CaseSummary

#### DELETE /api/cases/[id]

削除。関連する全データ (家族、代理店、証券、メタ) をカスケード削除。

**レスポンス** `200 OK` — `{ "ok": true }`
**エラー** `404` — ケースが存在しない

### 3.2 診断データ管理

全エンドポイントでクエリパラメータ `caseId` が必須。

#### GET /api/app-state?caseId=...

指定ケースの AppState を取得。

**レスポンス** `200 OK` — AppState
**エラー** `404` — ケースが存在しない

#### PUT /api/app-state?caseId=...

診断データの保存。既存の家族・証券を全削除後、リクエストボディの内容で再挿入。

**リクエスト** `Content-Type: application/json` — AppState
**バリデーション** — validators/appState.ts による検証 (後述)
**レスポンス** `200 OK` — 保存後の AppState
**エラー** `400` — バリデーション失敗, `415` — Content-Type 不正

#### POST /api/app-state/reset?caseId=...

サンプルデータにリセット。

**レスポンス** `200 OK` — リセット後の AppState

#### POST /api/app-state/clear?caseId=...

データ消去。証券を全削除し、家族を本人1名 (デフォルト値) のみに戻す。

**レスポンス** `200 OK` — 消去後の AppState

#### GET /api/app-state/export?caseId=...

JSON ファイルとしてダウンロード。

**レスポンスヘッダー**
- `Content-Type: application/json`
- `Content-Disposition: attachment; filename="insurance-app-state-YYYYMMDD-HHMMSS.json"`

**レスポンスボディ**
```json
{
  "schemaVersion": 1,
  "exportedAt": "ISO 8601",
  "familyMembers": [...],
  "agency": {...},
  "policies": [...]
}
```

### 3.3 代理店マスター管理

#### GET /api/agency-masters

全代理店マスターの一覧取得。

**レスポンス** `200 OK`
```json
[
  {
    "id": "string",
    "name": "string",
    "representative": "string",
    "phone": "string"
  }
]
```

#### POST /api/agency-masters

新規代理店マスターの作成。

**リクエスト** `Content-Type: application/json`
```json
{
  "name": "string",
  "representative": "string",
  "phone": "string"
}
```

**レスポンス** `201 Created` — AgencyMaster

#### PUT /api/agency-masters/[id]

代理店マスターの更新。

**リクエスト** `Content-Type: application/json` — name, representative, phone
**レスポンス** `200 OK` — 更新後の AgencyMaster
**エラー** `404` — マスターが存在しない

#### DELETE /api/agency-masters/[id]

代理店マスターの削除。

**レスポンス** `200 OK` — `{ "ok": true }`
**エラー** `404` — マスターが存在しない

### 3.4 CSV 取込

#### POST /api/policies/import-csv

FormData で CSV ファイルをアップロードし、証券データを取り込む。

**リクエスト** `Content-Type: multipart/form-data`

| フィールド | 型 | 説明 |
|---|---|---|
| `file` | File | CSV ファイル (最大 5MB) |
| `caseId` | string | 対象ケース ID |
| `overwriteDuplicates` | string? | `'true'` で重複証券番号を上書き |

**CSV ヘッダーマッピング**

| CSV ヘッダー (日本語) | 内部フィールド名 |
|---|---|
| 保険会社 | companyName |
| 保険種類 | policyType |
| 証券番号 | policyNumber |
| 契約日 | contractDate |
| 契約年齢 | contractAge |
| 被保険者 / 被保険者名 | insuredName |
| 受取人 / 受取人名 | beneficiaryName |
| 死亡保障疾病 | deathBenefitDisease |
| 死亡保障災害 | deathBenefitAccident |
| 入院日額疾病 | hospDayDisease |
| 入院日額災害 | hospDayAccident |
| 診断一時金 | diagnosisBenefit |
| 保険期間 | policyEndAge |
| 払方 | paymentFrequency |
| 保険料 | premiumAmount |
| 払込終了年月日 | paymentEndDate |
| 払込終了年齢 | paymentEndAge |
| 満期保険金 | maturityBenefit |
| コンサルタントメモ | consultantNote |
| フリガナ / カナ / 氏名カナ | nameKana |

**エンコーディング**: UTF-8 (BOM 有無) および CP932 (Shift-JIS) を自動判定

**レスポンス**
- `200 OK` — 取込成功 (importedCount, state)
- `400 Bad Request` — バリデーションエラー (errors 配列)
- `409 Conflict` — 重複証券番号あり (code: `DUPLICATE_POLICY_NUMBER`, duplicates 配列)

### 3.5 ヘルスチェック

#### GET /api/health

**レスポンス** `200 OK` — `{ "status": "ok", "database": "ok" | "error" }`

---

## 4. バリデーション

### 4.1 サーバー側 (validators/appState.ts)

PUT /api/app-state で適用。

**familyMembers**
- 1件以上の配列が必須
- 各要素: `id` (必須文字列), `name`, `nameKana` (任意文字列), `relationship`, `birthDate` (文字列), `gender` (`male` or `female`)

**agency**
- オブジェクト必須
- `name`, `representative`, `phone` (全て文字列)

**policies**
- 配列必須
- 各要素: `id`, `companyName` (必須), `policyType` (6種のいずれか), `contractDate` (必須), `contractAge` (数値), `insuredId` (必須), `policyEndAge` (数値), `paymentFrequency` (monthly/annual/single), `premiumAmount` (数値), `paymentEndAge` (数値)

### 4.2 クライアント側 (app/page.tsx)

保存ボタン押下時に適用。

- 家族情報が1件以上存在すること
- 全家族: `id`, `relationship` が存在し、`gender` が `male` or `female`
- 代理店: `name`, `representative`, `phone` が文字列型
- 全証券: `companyName`, `contractDate`, `insuredId` が存在し、`policyType` と `paymentFrequency` が正当な値

### 4.3 CSV 取込バリデーション

行単位で検証。1行でもエラーがあれば全行取込中止。

- `companyName`: 必須
- `policyType`: 6種のいずれか
- `contractDate`: 必須
- `insuredName`: 必須、家族情報に名前が一致する人物が必要
- `beneficiaryName`: 任意、指定時は家族情報に一致が必要
- `policyEndAge`: 必須
- `paymentFrequency`: monthly / annual / single
- `premiumAmount`: 必須
- `paymentEndDate` or `paymentEndAge`: いずれか必須

---

## 5. 分析エンジン (utils/analysisUtils.ts)

### 5.1 保険種類情報 (INSURANCE_TYPE_INFO)

各 PolicyType に対して以下を定義:
- アイコン名 (lucide-react)
- 配色 (テキスト色, 背景色, ボーダー色)
- 短い説明、詳細説明、目的

### 5.2 保険料計算

| 関数 | 説明 |
|---|---|
| `calculateTotalPremiumsPaid(policy, currentAge)` | 現在までの累計払込保険料 |
| `calculateProjectedTotalPremiums(policy)` | 払込完了までの総保険料 |
| `calculateRemainingPremiums(policy, currentAge)` | 残りの払込保険料 |
| `getMonthlyPremium(policy)` | 月額保険料 (年払→÷12, 一時払→0) |

### 5.3 保障分析

| 関数 | 説明 |
|---|---|
| `getCurrentDeathBenefit(policy, currentAge)` | 現在の死亡保障額 (収入保障は逓減計算) |
| `getRemainingCoverageYears(policy, currentAge)` | 残り保障年数 (終身は 'lifetime') |
| `getRemainingPaymentYears(policy, currentAge)` | 残り払込年数 |
| `isPaidUp(policy, currentAge)` | 払込完了済みか |
| `isExpired(policy, currentAge)` | 保障期間終了済みか |

### 5.4 評価ロジック

3段階評価: `good` (良好) / `caution` (注意) / `warning` (警告)

**保障期間評価**
- 終身 → good
- 残り10年以上 → good
- 残り5〜10年 → caution
- 残り5年未満 → warning

**払込状況評価**
- 払込完了 → good
- 残り少 → good (もうすぐ完了)
- 継続中 → caution

**保障充実度評価 (種類別)**

| 保険種類 | warning | caution | good |
|---|---|---|---|
| 医療保険 | 入院日額 < 5,000円 | — | 入院日額 >= 10,000円 |
| 終身/変額終身 | — | 死亡保障 < 300万円 | 死亡保障 >= 300万円 |
| 収入保障 | 死亡保障 < 500万円 | — | 死亡保障 >= 500万円 |

### 5.5 自動コンサルタントメモ

保険種類ごとに特性に応じたメモを自動生成:

- **収入保障**: 逓減する受取構造の説明
- **変額終身**: 最低保証死亡保障 + 運用実績連動の説明
- **医療保険**: 入院日額水準、診断一時金、保障終了年齢の強調
- **個人年金**: 受取開始年齢、受取期間、年間受取額、返戻率
- **終身保険**: 終身保障の価値、払済後のメリット
- **養老保険**: 満期保険金、返戻率

### 5.6 ポートフォリオ分析

`analyzePortfolio(policies, currentAge)` — 証券群全体の分析結果を生成。

| 種別 | 条件 | メッセージ例 |
|---|---|---|
| gap (不足) | 医療保険なし | 医療保険が含まれていません |
| gap (不足) | 死亡保障なし | 死亡保障がありません |
| recommendation | 医療保険が間もなく終了 | 医療保険の保障期間が残り少なくなっています |
| recommendation | 収入保障が間もなく終了 | 収入保障保険の保障期間が残り少なくなっています |
| recommendation | 終身保険なし | 終身型の死亡保障の検討をお勧めします |
| redundancy | 死亡保障付き証券が3件以上 | 死亡保障が複数の証券に分散しています |

---

## 6. コンポーネント仕様

### 6.1 画面遷移

```
CaseListPage (顧客一覧)
  ↓ ケース選択
MainDashboard (診断ダッシュボード)
  ├── SummaryDashboard (サマリーカード)
  ├── PolicyTable (証券一覧表)
  ├── CoverageChart + CostChart (グラフ)
  └── PolicyAnalysisSection (証券分析)
        ├── InsuranceTypeOverview (種類別概要)
        └── PolicyAnalysisCard × N (個別分析)

モーダル:
  ├── PolicyForm (証券追加・編集)
  ├── CustomerModal (顧客情報編集)
  ├── CsvImportDialog (CSV 取込)
  └── AgencyMasterModal (代理店マスター管理)
```

### 6.2 CaseListPage (顧客一覧)

| 機能 | 説明 |
|---|---|
| 一覧表示 | 顧客名 (アバター付き), 世帯人数, 証券数, 最終更新日 |
| 検索 | 顧客名・フリガナでリアルタイムフィルタリング |
| ソート | 各カラムのクリックで昇順/降順切替 |
| 新規作成 | ボタンクリックで空のケースを作成 |
| 削除 | 確認ダイアログ後に削除 |
| 代理店管理 | ヘッダーのボタンから AgencyMasterModal を起動 |
| 空状態 | ケースがない場合の案内表示 |

### 6.3 SummaryDashboard (サマリー)

3枚のカードで主要指標を表示:

| カード | 内容 | 計算方法 |
|---|---|---|
| 月額保険料合計 | 全有効証券の月額合計 | 年払→÷12, 一時払→除外 |
| 現在の死亡保障合計 | 全有効証券の死亡保障合計 | 収入保障は逓減計算 |
| 入院日額合計 | 全有効証券の入院日額合計 | 疾病分のみ |

### 6.4 PolicyTable (証券一覧表)

| 機能 | 説明 |
|---|---|
| 列 | No., ドラッグハンドル, 保険種類, 保険会社, 証券番号, 死亡保障, 入院日額, 受取人, 保険料, 操作 |
| ドラッグ並替 | ハンドルで行の順番を変更 |
| 集計行 | 月額合計, 年額合計, 年間総額 (3行) |
| 操作 | 編集ボタン, 削除ボタン (確認あり) |
| 新規追加 | テーブル下部のボタン |

### 6.5 PolicyForm (証券フォーム)

モーダル形式。3セクション構成。

**基本情報セクション**
- 保険会社名, 保険種類 (セレクト), 証券番号
- 契約日, 契約年齢, 保険期間終了年齢
- 被保険者 (セレクト), 受取人 (セレクト)

**保障内容セクション**
- 死亡保障 (疾病/災害), 入院日額 (疾病/災害), 診断一時金

**費用・貯蓄セクション**
- 払込頻度 (月払/年払/一時払), 保険料, 払込終了年齢
- 満期保険金
- 金額入力はカンマ区切り表示

### 6.6 CoverageChart (保障推移グラフ)

- **種類**: Recharts AreaChart (積み上げ)
- **X 軸**: 年齢 (現在〜90歳)
- **Y 軸**: 保障額 (万円単位)
- **系列**: 証券ごとに1系列、色分け
- **特殊処理**: 収入保障は年齢とともに逓減

### 6.7 CostChart (費用推移グラフ)

- **種類**: Recharts BarChart
- **X 軸**: 年齢 (現在〜80歳)
- **Y 軸**: 月額保険料 (円)
- **表示**: 各年齢時点の有効証券の月額保険料合計

### 6.8 PolicyAnalysisSection (証券分析セクション)

2つのサブコンポーネントで構成:

#### InsuranceTypeOverview (種類別概要)

- 証券を保険種類ごとにグループ化
- 各種類: アイコン, 名称, 件数バッジ, 詳細説明, 目的, 集計値 (死亡保障合計, 入院日額合計, 月額合計)
- **ポートフォリオ分析**: 自動生成インサイト (不足/推奨/重複) をカードで表示
  - インライン編集・削除・追加・リセット機能

#### PolicyAnalysisCard (個別証券分析)

各証券の詳細分析カード:

| セクション | 内容 |
|---|---|
| ヘッダー | 保険種類バッジ, 会社名, 期間切れバッジ, 証券番号, 契約日, 被保険者, 受取人 |
| 保障詳細 | 死亡保障 (疾病/災害), 入院日額, 診断一時金 |
| 費用分析 | 月額保険料, 累計払込額, 残り払込額, 総払込見込額 |
| 年金情報 | 受取開始年齢, 受取期間, 年間受取額, 総受取額, 返戻率 (該当種類のみ) |
| ミニチャート | PolicyMiniChart (保障額推移 or 積立/受取推移) |
| 評価バッジ | 保障期間, 払込状況, 保障充実度 (3段階色分け) |
| メモ | コンサルタントメモ (編集可能 textarea) |

### 6.9 CustomerModal (顧客情報編集)

モーダル形式。2セクション:

**家族情報**
- 行ごとに編集: 続柄, 氏名, フリガナ (任意), 生年月日, 性別
- フリガナ入力: ひらがな入力時にカタカナへ自動変換 (Unicode +0x60)
- 行追加ボタン, 行削除ボタン (最低1名は削除不可)

**代理店情報**
- 代理店名, 取扱者名, 電話番号
- 「マスターから読込」ドロップダウン: 登録済み代理店マスターから選択してコピー (選択後に個別編集可)

### 6.10 AgencyMasterModal (代理店マスター管理)

モーダル形式。CaseListPage ヘッダーの「代理店管理」ボタンから起動。

| 機能 | 説明 |
|---|---|
| 一覧表示 | テーブル形式で全マスターを表示 (代理店名, 取扱者, 電話番号) |
| インライン編集 | 行の編集ボタンで入力フィールドに切替 |
| 追加 | 「代理店を追加」ボタンでフォーム表示 (全項目必須) |
| 削除 | 確認ダイアログ後に削除 |

### 6.11 CsvImportDialog (CSV 取込)

| 機能 | 説明 |
|---|---|
| ファイル選択 | ドラッグ&ドロップ or クリック |
| ファイル検証 | .csv 拡張子, 最大 5MB |
| エラー表示 | 行番号付きエラーテーブル |
| 重複処理 | 重複証券番号の一覧表示 + 上書き確認ボタン |

### 6.12 PrintCoverPage (印刷表紙)

印刷時のみ表示される表紙ページ:
- 顧客名
- 作成日 (令和暦)
- タイトル「保険証券分析表」
- 代理店情報
- NJPW ロゴ

---

## 7. 印刷仕様

`@media print` で制御。A4 横向き、余白 10mm。

| 要素 | 印刷時の扱い |
|---|---|
| 表紙 | 1ページ目に表示、改ページ |
| 操作ボタン | 非表示 (保存, 印刷, ドロップダウン, 追加, フォーム) |
| サマリーカード | 表示 |
| 証券一覧表 | 表示 (影なし, ボーダーのみ) |
| グラフ | 高さ 75mm 固定で表示 |
| 証券分析カード | 各証券の前で改ページ |
| フォント | 縮小表示 |
| 配色 | `print-color-adjust: exact` で保持 |

---

## 8. レスポンシブ対応

| ブレークポイント | 変更内容 |
|---|---|
| 900px 以下 | ヘッダーを縦積み、アクションボタンを折り返し |
| 768px 以下 | 分析カード本文を1カラム化、種類別概要を1カラム化、証券テーブルを横スクロール |

---

## 9. Docker 構成

### 9.1 Dockerfile

4ステージ構成:

| ステージ | ベース | 用途 |
|---|---|---|
| base | node:22-alpine | libc6-compat, python3, make, g++ (better-sqlite3 ビルド用) |
| deps | base | npm ci |
| dev | deps | `next dev --port 3020` |
| runner | node:22-alpine | standalone サーバー (`node server.js`) |

本番イメージ: `next build` → `.next/standalone` + `.next/static` + `public` をコピー。

### 9.2 docker-compose.yml (開発)

| 項目 | 値 |
|---|---|
| ポート | 3020 |
| ボリューム | app/, components/, lib/, services/, validators/, utils/, types.ts, data/, public/ |
| 環境変数 | NODE_ENV=development, DATABASE_PATH=/app/data/insurance.sqlite |
| ヘルスチェック | GET /api/health |
| メモリ制限 | 512MB |

### 9.3 docker-compose.prod.yml (本番オーバーライド)

| 項目 | 値 |
|---|---|
| ターゲット | runner |
| ボリューム | なし (イメージ内蔵) |
| 環境変数 | NODE_ENV=production |
| メモリ制限 | 256MB |

---

## 10. サンプルデータ

### 家族

| 氏名 | フリガナ | 続柄 | 生年月日 | 性別 |
|---|---|---|---|---|
| 佐々木健介 | ササキケンスケ | 本人 | 1966-08-04 | 男性 |
| 北斗晶 | ホクトアキラ | 配偶者 | 1985-04-12 | 女性 |

### 代理店

| 項目 | 値 |
|---|---|
| 代理店名 | 新日本プロレス |
| 取扱者 | 橋本信也 |
| 電話番号 | 050-3317-0226 |

### 証券 (4件)

| 保険会社 | 保険種類 | 月額保険料 | 主な保障 |
|---|---|---|---|
| 住友生命 | 個人年金保険 | 20,000円 | 満期金 500万円 |
| プルデンシャル | 収入保障保険 | 14,225円 | 死亡保障 1,560万円 (逓減) |
| プルデンシャル | 変額終身保険 | 8,935円 | 死亡保障 500万円 (最低保証) |
| プルデンシャル | 医療保険 | 10,798円 | 入院日額 10,000円, 診断一時金 50万円 |
