# バックエンド追加 要件定義

## 1. 背景

現在の保険証券分析・診断ダッシュボードは Vite + React + TypeScript のフロントエンド単体アプリとして構成されている。保険証券、家族情報、代理店情報は画面上の React state と `public/sample-data.json` を起点に扱われており、入力・編集した内容はブラウザを閉じると失われる。

本機能追加では、入力した診断データを Docker 開発環境上のバックエンドと SQLite で永続化し、再読込・編集・削除・外部入出力できる状態にする。

## 2. 目的

- 保険証券、家族情報、代理店情報をバックエンドに保存できるようにする。
- 画面再読込後も、最後に保存した診断データを復元できるようにする。
- SQLite を利用し、Docker 開発環境で軽量に永続化できる構成にする。
- 診断データを JSON として出力できるようにする。
- CSV ファイルから保険証券情報を取り込めるようにする。
- 開発・検証は Docker Compose で再現できるようにする。

## 3. スコープ

### 対象

- 保険診断データの取得 API
- 保険診断データの保存 API
- サンプルデータへのリセット API
- 保険診断データの JSON 出力 API
- CSV による保険証券情報の取り込み API
- SQLite によるデータ永続化
- SQLite DB ファイルの自動作成、スキーマ作成、マイグレーション
- バックエンドの入力値バリデーション
- Docker Compose でフロントエンド、バックエンド、SQLite 保存領域を起動する開発環境
- API のヘルスチェック

### 対象外

- ログイン、認証、権限管理（今回の実装予定なし）
- 複数ユーザー、複数テナント対応（今回の実装予定なし）
- PostgreSQL / MySQL など外部 DB サーバーの導入
- Nginx による静的ファイル配信、リバースプロキシ構成
- 証券画像・PDF アップロード、OCR、画像管理
- 本番環境の SSL/TLS、外部ドメイン設定

## 4. 利用者

- 保険コンサルタント、代理店担当者
- 顧客の保険証券情報を入力し、保障内容・保険料・診断メモを管理する利用者

## 5. 機能要件

### F-01 初期データ取得

画面起動時、フロントエンドはバックエンド API から保険診断データを取得する。

- データが保存済みの場合は保存済みデータを返す。
- データが未作成の場合はサンプルデータを元に初期データを生成して返す。
- 取得に失敗した場合は画面にエラーを表示し、再試行できる状態にする。

### F-02 保険診断データ保存

利用者が以下を変更した場合、画面上の一時状態として保持し、明示的な「保存」ボタン押下時にバックエンドへ保存できるようにする。

- 保険証券の追加
- 保険証券の編集
- 保険証券の削除
- 保険証券の並び替え
- コンサルタントメモの編集
- 家族情報の編集
- 代理店情報の編集

保存対象は、画面の診断状態全体とする。

```json
{
  "familyMembers": [],
  "agency": {},
  "policies": []
}
```

保存ボタン仕様:

- 通常の追加・編集・削除・並び替え・メモ編集・家族情報編集・代理店情報編集は、保存ボタン押下まで SQLite に反映しない。
- 保存ボタン押下時に `PUT /api/app-state` を呼び出し、画面の診断状態全体を SQLite に保存する。
- 未保存の変更がある場合、画面上で未保存状態が分かる表示を行う。
- 未保存の変更がある状態で再読込や画面離脱を行う場合は、確認を表示する。
- 保存成功後は、未保存状態を解除し、DB から返された保存後データで画面状態を同期する。
- 「サンプル読込」と「データ消去」は保存ボタンを待たず、確認後ただちにバックエンド保存データへ反映する。

### F-03 サンプルデータ読込

既存の「サンプル読込」操作は、バックエンド側の保存データをサンプルデータで上書きする。

- 操作後、画面は上書き後のデータを表示する。
- 利用者にとっては現在の画面挙動を維持しつつ、保存先も更新される。

### F-04 データ消去

既存の「データ消去」操作は、画面 state だけでなくバックエンド保存データにも反映する。

- 保険証券は空にする。
- 家族情報は本人 1 名の初期状態にする。
- 代理店情報は 1 社のみを扱うため、初期値へ戻さず、SQLite に保存されている代理店情報と画面表示を常に一致させる。
- 代理店情報が未登録の場合のみ、初期代理店情報を作成して DB に保存する。

### F-05 入力値バリデーション

バックエンドは保存時に最低限の妥当性を検証する。

- `familyMembers` は 1 件以上の配列
- `agency.name`、`agency.representative`、`agency.phone` は文字列
- `policies` は配列
- 保険証券の必須項目が存在すること
- 金額、年齢、保障期間、払込終了年齢は数値
- CSV 取り込み時の契約年齢と払込終了年齢は、入力必須値ではなく算出可能な値として扱う
- 性別は `male` または `female`
- 払方は `monthly`、`annual`、`single`
- 保険種類は既存 `PolicyType` のいずれか

### F-06 ヘルスチェック

Docker の healthcheck および開発確認用に、バックエンドはヘルスチェック API を提供する。

- `GET /api/health`
- 正常時は HTTP 200 と稼働状態を返す。
- SQLite DB ファイルに接続できる場合は DB 接続状態も返す。

### F-07 JSON 出力

利用者は現在の保険診断データを JSON として出力できる。

- 出力対象は `familyMembers`、`agency`、`policies`、`updatedAt` とする。
- 出力時に `exportedAt` と `schemaVersion` を付与する。
- ブラウザからダウンロードできる形式にする。
- 出力データは、バックアップ・移行・外部連携で利用できる構造にする。

### F-08 CSV による保険証券情報の取り込み

利用者は CSV ファイルから保険証券情報を取り込める。

- 取り込み対象は保険証券情報のみとする。
- 家族情報と代理店情報は CSV 取り込み対象外とする。
- CSV はヘッダー行ありを必須とする。
- 文字コードは UTF-8、UTF-8 BOM 付き、Shift_JIS / CP932 に対応する。
- 取り込み方式は既存証券への追加を基本とする。
- 取り込み前にバックエンドで行単位のバリデーションを行う。
- 取り込みに失敗した行がある場合、成功件数・失敗件数・行番号・エラー理由を返す。
- 既存証券と証券番号が重複した場合は、利用者へ確認を表示し、確認後に既存証券を上書きする。
- 重複確認前は SQLite の既存データを変更しない。
- 上書き判定は同一案件内の `policyNumber` で行う。証券番号が空の行は重複判定対象外とする。
- 保険種類、払方、金額、日付の形式は既存の入力値バリデーションと同じ制約を適用する。
- 契約年齢は CSV では任意とし、未指定時は契約日と被保険者の生年月日から算出する。
- 払込終了年齢は CSV では任意とし、未指定時は払込終了年月日と被保険者の生年月日から算出する。
- 年齢算出は、対象日時点の満年齢を基準とする。
- 被保険者・受取人は既存の家族情報と照合する。照合できない場合は自動追加せず、行番号と理由を返してエラーにする。

CSV 取り込みの想定カラム:

| カラム | 必須 | 内容 |
| --- | --- | --- |
| `companyName` | 必須 | 保険会社 |
| `policyType` | 必須 | 保険種類 |
| `policyNumber` | 任意 | 証券番号 |
| `contractDate` | 必須 | 契約日 |
| `contractAge` | 任意 | 契約年齢。未指定時は契約日と被保険者の生年月日から算出 |
| `insuredName` | 必須 | 被保険者名 |
| `beneficiaryName` | 任意 | 受取人名 |
| `deathBenefitDisease` | 任意 | 死亡保障（疾病） |
| `deathBenefitAccident` | 任意 | 死亡保障（災害） |
| `hospDayDisease` | 任意 | 入院日額（疾病） |
| `hospDayAccident` | 任意 | 入院日額（災害） |
| `diagnosisBenefit` | 任意 | 診断一時金 |
| `policyEndAge` | 必須 | 保険期間 |
| `paymentFrequency` | 必須 | 払方 |
| `premiumAmount` | 必須 | 保険料 |
| `paymentEndDate` | 必須 | 払込終了年月日 |
| `paymentEndAge` | 任意 | 払込終了年齢。未指定時は払込終了年月日と被保険者の生年月日から算出 |
| `maturityBenefit` | 任意 | 満期保険金 |
| `consultantNote` | 任意 | コンサルタントメモ |

## 6. API 要件

### GET /api/app-state

保存済みの診断データを返す。

レスポンス例:

```json
{
  "familyMembers": [
    {
      "id": "m1",
      "name": "佐々木健介",
      "relationship": "本人",
      "birthDate": "1966-08-04",
      "gender": "male"
    }
  ],
  "agency": {
    "name": "新日本プロレス",
    "representative": "橋本 信也",
    "phone": "050-3317-0226"
  },
  "policies": [],
  "updatedAt": "2026-05-17T00:00:00.000Z"
}
```

### PUT /api/app-state

保存ボタン押下時に、診断データ全体を保存する。

- 成功時は保存後のデータを返す。
- バリデーションエラー時は HTTP 400 を返す。
- DB 書き込み失敗時は HTTP 500 を返す。
- 保存対象はリクエスト body の AppState 全体とし、部分更新 API は初期実装では用意しない。

### POST /api/app-state/reset

保存データをサンプルデータで初期化する。

- 成功時は初期化後のデータを返す。

### GET /api/app-state/export

保存済みの診断データを JSON として出力する。

- レスポンス Content-Type は `application/json` とする。
- ブラウザでダウンロードできるよう `Content-Disposition` を付与する。
- ファイル名は `insurance-app-state-YYYYMMDD-HHmmss.json` を基本とする。

レスポンス例:

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-05-17T00:00:00.000Z",
  "familyMembers": [],
  "agency": {},
  "policies": [],
  "updatedAt": "2026-05-17T00:00:00.000Z"
}
```

### POST /api/policies/import-csv

CSV ファイルから保険証券情報を取り込む。

- リクエスト Content-Type は `multipart/form-data` を基本とする。
- CSV 文字コードは UTF-8、UTF-8 BOM 付き、Shift_JIS / CP932 を受け付ける。
- クエリまたはフォーム値で `overwriteDuplicates=true` が指定された場合、証券番号が重複する既存証券を上書きする。
- `overwriteDuplicates` が未指定または `false` の状態で重複が見つかった場合、DB を変更せず HTTP 409 を返す。
- HTTP 409 のレスポンスには、重複した行番号、証券番号、既存証券 ID を含める。
- 取り込み成功時は、保存後の保険診断データと取り込み結果を返す。
- バリデーションエラー時は HTTP 400 を返す。
- 一部行のみ失敗した場合も、DB への保存は行わず全体をロールバックする。

レスポンス例:

```json
{
  "importedCount": 3,
  "failedCount": 1,
  "errors": [
    {
      "row": 4,
      "message": "保険種類が不正です"
    }
  ],
  "state": {
    "familyMembers": [],
    "agency": {},
    "policies": []
  }
}
```

重複確認レスポンス例:

```json
{
  "code": "DUPLICATE_POLICY_NUMBER",
  "message": "同じ証券番号の保険証券があります。上書きしますか？",
  "duplicates": [
    {
      "row": 3,
      "policyNumber": "2709300566",
      "existingPolicyId": "2"
    }
  ]
}
```

### GET /api/health

バックエンドの稼働状態を返す。

レスポンス例:

```json
{
  "status": "ok",
  "database": "ok"
}
```

## 7. データ保存方式

データ保存には SQLite を利用し、今回のバックエンド実装対象に含める。

理由:

- Docker Compose でアプリコンテナだけを起動すれば、軽量にローカル永続化を再現できる。
- 単一端末・小規模運用の保険診断データ管理に適している。
- PostgreSQL などの外部 DB サーバーを立てずに開発・検証できる。
- JSON 出力や CSV 取り込み後のデータ整合性を DB 制約とトランザクションで担保しやすい。

実装する DB ファイル:

- コンテナ内: `/app/data/insurance.sqlite`
- ホスト側: `./data/insurance.sqlite`

実装するテーブル:

- `cases`: 診断案件
- `agencies`: 代理店情報
- `family_members`: 家族情報
- `policies`: 保険証券情報
- `app_state_meta`: 診断データの更新日時、スキーマバージョンなど

初期実装では単一案件の保存を前提とし、`cases.id = "default"` の 1 件を利用する。将来の複数顧客管理に備え、各テーブルは `case_id` で案件に紐づける。

SQLite 実装要件:

- `DATABASE_PATH` が指す SQLite DB ファイルをバックエンド起動時に確認する。
- DB ファイルが存在しない場合は、親ディレクトリを作成したうえで DB ファイルを自動作成する。
- 起動時にマイグレーションを実行し、必要なテーブル、制約、インデックスを作成する。
- マイグレーションは再実行しても壊れない冪等な処理にする。
- DB スキーマのバージョンは `app_state_meta.schema_version` または専用のマイグレーション管理テーブルで管理する。
- 書き込み処理は SQLite トランザクション内で実行し、途中失敗時はロールバックする。
- 接続ごとに `PRAGMA foreign_keys = ON` を有効化する。
- `GET /api/health` は SQLite DB へ読み取りクエリを実行し、接続可否を返す。

## 8. SQLite テーブル設計 / ER

### ER 図

```mermaid
erDiagram
  CASES ||--|| AGENCIES : "has"
  CASES ||--o{ FAMILY_MEMBERS : "has"
  CASES ||--o{ POLICIES : "has"
  CASES ||--|| APP_STATE_META : "has"
  FAMILY_MEMBERS ||--o{ POLICIES : "insured"
  FAMILY_MEMBERS ||--o{ POLICIES : "beneficiary"

  CASES {
    text id PK
    text title
    text created_at
    text updated_at
  }

  AGENCIES {
    text id PK
    text case_id FK
    text name
    text representative
    text phone
    text created_at
    text updated_at
  }

  FAMILY_MEMBERS {
    text id PK
    text case_id FK
    text name
    text relationship
    text birth_date
    text gender
    integer sort_order
    text created_at
    text updated_at
  }

  POLICIES {
    text id PK
    text case_id FK
    text company_name
    text policy_type
    text policy_number
    text contract_date
    integer contract_age
    text insured_member_id FK
    text beneficiary_member_id FK
    integer death_benefit_disease
    integer death_benefit_accident
    integer hosp_day_disease
    integer hosp_day_accident
    integer diagnosis_benefit
    integer policy_end_age
    text payment_frequency
    integer premium_amount
    text payment_end_date
    integer payment_end_age
    integer annual_premium
    integer maturity_benefit
    text consultant_note
    integer sort_order
    text created_at
    text updated_at
  }

  APP_STATE_META {
    text case_id PK FK
    integer schema_version
    text updated_at
    text last_exported_at
  }
```

### テーブル定義

#### `cases`

診断データ全体の親となる案件テーブル。初期実装では `id = "default"` の 1 件のみを利用する。

| カラム | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `id` | TEXT | PRIMARY KEY | 案件 ID |
| `title` | TEXT | NOT NULL | 案件名。初期値は顧客名または `default` |
| `created_at` | TEXT | NOT NULL | 作成日時 ISO 8601 |
| `updated_at` | TEXT | NOT NULL | 更新日時 ISO 8601 |

#### `agencies`

代理店情報を保存する。1 案件につき 1 件を想定する。

| カラム | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `id` | TEXT | PRIMARY KEY | 代理店 ID |
| `case_id` | TEXT | NOT NULL, UNIQUE, FK | `cases.id` |
| `name` | TEXT | NOT NULL | 代理店名 |
| `representative` | TEXT | NOT NULL | 担当者名 |
| `phone` | TEXT | NOT NULL | 電話番号 |
| `created_at` | TEXT | NOT NULL | 作成日時 ISO 8601 |
| `updated_at` | TEXT | NOT NULL | 更新日時 ISO 8601 |

#### `family_members`

本人、配偶者、子などの家族情報を保存する。

| カラム | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `id` | TEXT | PRIMARY KEY | 家族 ID |
| `case_id` | TEXT | NOT NULL, FK | `cases.id` |
| `name` | TEXT | NOT NULL | 氏名 |
| `relationship` | TEXT | NOT NULL | 続柄 |
| `birth_date` | TEXT | NOT NULL | 生年月日 `YYYY-MM-DD` |
| `gender` | TEXT | NOT NULL | `male` または `female` |
| `sort_order` | INTEGER | NOT NULL DEFAULT 0 | 表示順 |
| `created_at` | TEXT | NOT NULL | 作成日時 ISO 8601 |
| `updated_at` | TEXT | NOT NULL | 更新日時 ISO 8601 |

制約:

- `gender` は `male`、`female` のいずれかに限定する。
- 同一 `case_id` 内で `sort_order` の昇順に表示する。

#### `policies`

保険証券情報を保存する。金額は円単位の整数、日付は `YYYY-MM-DD` 文字列で保存する。

| カラム | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `id` | TEXT | PRIMARY KEY | 保険証券 ID |
| `case_id` | TEXT | NOT NULL, FK | `cases.id` |
| `company_name` | TEXT | NOT NULL | 保険会社 |
| `policy_type` | TEXT | NOT NULL | 保険種類 |
| `policy_number` | TEXT | NULL | 証券番号 |
| `contract_date` | TEXT | NOT NULL | 契約日 `YYYY-MM-DD` |
| `contract_age` | INTEGER | NOT NULL | 契約年齢。CSV 取り込み時は算出可 |
| `insured_member_id` | TEXT | NOT NULL, FK | 被保険者 `family_members.id` |
| `beneficiary_member_id` | TEXT | NULL, FK | 受取人 `family_members.id` |
| `death_benefit_disease` | INTEGER | NOT NULL DEFAULT 0 | 死亡保障（疾病） |
| `death_benefit_accident` | INTEGER | NOT NULL DEFAULT 0 | 死亡保障（災害） |
| `hosp_day_disease` | INTEGER | NOT NULL DEFAULT 0 | 入院日額（疾病） |
| `hosp_day_accident` | INTEGER | NOT NULL DEFAULT 0 | 入院日額（災害） |
| `diagnosis_benefit` | INTEGER | NOT NULL DEFAULT 0 | 診断一時金 |
| `policy_end_age` | INTEGER | NOT NULL | 保険期間。`999` は終身 |
| `payment_frequency` | TEXT | NOT NULL | `monthly`、`annual`、`single` |
| `premium_amount` | INTEGER | NOT NULL DEFAULT 0 | 保険料 |
| `payment_end_date` | TEXT | NULL | 払込終了年月日 `YYYY-MM-DD` |
| `payment_end_age` | INTEGER | NOT NULL | 払込終了年齢。CSV 取り込み時は算出可 |
| `annual_premium` | INTEGER | NOT NULL DEFAULT 0 | 年換算保険料 |
| `maturity_benefit` | INTEGER | NOT NULL DEFAULT 0 | 満期保険金 |
| `consultant_note` | TEXT | NULL | コンサルタントメモ |
| `sort_order` | INTEGER | NOT NULL DEFAULT 0 | 表示順 |
| `created_at` | TEXT | NOT NULL | 作成日時 ISO 8601 |
| `updated_at` | TEXT | NOT NULL | 更新日時 ISO 8601 |

制約:

- `policy_type` は既存 `PolicyType` のいずれかに限定する。
- `payment_frequency` は `monthly`、`annual`、`single` のいずれかに限定する。
- `insured_member_id` は必須とし、参照先の家族情報が削除される場合は削除を制限する。
- `beneficiary_member_id` は任意とし、参照先の家族情報が削除される場合は `NULL` にする。
- `policy_number` は CSV 取り込み時の重複確認に利用する。証券番号が空の証券を許容するため、初期実装では UNIQUE 制約を付けない。

#### `app_state_meta`

診断データ全体のメタ情報を保存する。

| カラム | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `case_id` | TEXT | PRIMARY KEY, FK | `cases.id` |
| `schema_version` | INTEGER | NOT NULL | DB / JSON 出力スキーマバージョン |
| `updated_at` | TEXT | NOT NULL | AppState 最終更新日時 ISO 8601 |
| `last_exported_at` | TEXT | NULL | 最終 JSON 出力日時 ISO 8601 |

### インデックス

- `idx_family_members_case_id_sort_order` on `family_members(case_id, sort_order)`
- `idx_policies_case_id_sort_order` on `policies(case_id, sort_order)`
- `idx_policies_case_id_policy_number` on `policies(case_id, policy_number)`
- `idx_policies_insured_member_id` on `policies(insured_member_id)`
- `idx_policies_beneficiary_member_id` on `policies(beneficiary_member_id)`

### 外部キー方針

- `agencies.case_id`、`family_members.case_id`、`policies.case_id`、`app_state_meta.case_id` は `cases.id` を参照する。
- 案件を削除する場合、案件配下の代理店情報、家族情報、保険証券情報、メタ情報はまとめて削除する。
- `policies.insured_member_id` は必須のため、参照先の家族情報が使われている間は削除を制限する。
- `policies.beneficiary_member_id` は任意のため、参照先の家族情報が削除された場合は `NULL` にする。
- SQLite では接続時に `PRAGMA foreign_keys = ON` を有効化する。

### AppState への変換方針

- API レスポンスでは DB の snake_case カラムを既存フロントエンドの camelCase に変換する。
- `family_members.birth_date` は `FamilyMember.birthDate` として返す。
- `policies.insured_member_id` は `Policy.insuredId`、`policies.beneficiary_member_id` は `Policy.beneficiaryId` として返す。
- `policies.payment_end_date` は CSV 取り込み・将来拡張用に保持し、既存画面が必要とする `paymentEndAge` も返す。
- JSON 出力では API レスポンスと同じ AppState 形式に `schemaVersion`、`exportedAt` を付与する。

## 9. Docker 開発要件

### 起動方式

開発は Docker Compose を標準とする。

想定コマンド:

```bash
docker compose up -d --build
docker compose logs -f
docker compose down
```

### コンテナ構成

初期実装では単一コンテナ構成を基本とする。

- Vite 開発サーバー
- Node バックエンド
- SQLite DB ファイル
- Vite proxy 経由で `/api` をバックエンドへ転送
- 本番運用時も Nginx は利用せず、Node サーバーが API とビルド済み静的ファイルを配信する。

サービス構成:

- `insurance-app`: フロントエンド + API + SQLite

### ポート

- フロントエンド: `3020`
- バックエンド: コンテナ内部で `3021`
- ブラウザからの API アクセスは `/api` に統一する。

### 永続化

開発中にコンテナを作り直しても保存データが残るよう、`./data:/app/data` を bind mount する。

想定環境変数:

- `DATABASE_PATH=/app/data/insurance.sqlite`
- `API_PORT=3021`

## 10. 非機能要件

### N-01 再現性

新規環境では Docker Compose のみで起動できること。

### N-02 保守性

フロントエンドは API クライアント層を経由してバックエンドと通信する。React コンポーネント内に API URL や fetch 処理を散在させない。

### N-03 拡張性

DB 内部は正規化しつつ、API ではアプリ状態全体を明示的な `AppState` として扱う。

### N-04 安定性

複数テーブルを更新する処理は SQLite のトランザクション内で実行する。

### N-05 セキュリティ

初期実装では認証なしとするが、バックエンドは以下を満たす。

- API ごとに許可された Content-Type 以外のリクエストを拒否する。
- 通常 API は `application/json` を受け付ける。
- CSV 取り込み API は `multipart/form-data` または `text/csv` を受け付ける。
- 受信 body サイズに上限を設ける。
- CSV 取り込みではファイルサイズと行数に上限を設ける。
- 想定外のパスは 404 を返す。
- DB ファイルパスは環境変数で変更可能にする。

## 11. エラー表示要件

フロントエンドは API エラー時に以下を表示する。

- 初期取得失敗: 「データの読み込みに失敗しました」
- 保存失敗: 「保存に失敗しました」
- JSON 出力失敗: 「JSON 出力に失敗しました」
- CSV 取り込み失敗: 「CSV 取り込みに失敗しました」
- バリデーションエラー: バックエンドから返されたメッセージ

保存中は必要に応じて「保存中...」を表示する。
CSV 取り込み中は「取り込み中...」を表示する。
CSV 取り込みで家族情報を照合できない場合は「被保険者または受取人が家族情報に存在しません」を表示する。

## 12. 受け入れ条件

- `docker compose up -d --build` で開発環境が起動する。
- `http://localhost:3020/insurance/` または設定済み URL で画面を表示できる。
- 初回起動時に `./data/insurance.sqlite` が自動作成される。
- 初回起動時に SQLite の必要テーブル、制約、インデックスが作成される。
- 再起動時にマイグレーションが再実行されても既存データが失われない。
- 画面起動時に `/api/app-state` からデータを取得する。
- 保険証券を追加しただけでは DB に反映されず、保存ボタン押下後に画面を再読込すると追加内容が残っている。
- 家族情報・代理店情報を変更しただけでは DB に反映されず、保存ボタン押下後に画面を再読込すると変更内容が残っている。
- 未保存の変更がある場合、画面上で未保存状態が分かる。
- 「サンプル読込」で保存データがサンプルに戻る。
- 「データ消去」で保険証券と家族情報が初期状態に戻り、代理店情報は SQLite に保存されている 1 社分の情報と一致する。
- JSON 出力操作で現在の診断データを `.json` ファイルとして取得できる。
- CSV 取り込み操作で保険証券情報を追加でき、取り込み結果が画面に反映される。
- CSV 取り込みで不正な行がある場合、行番号と理由が表示される。
- CSV 取り込みで既存証券番号と重複した場合、確認ダイアログを表示し、利用者が承認すると既存証券が上書きされる。
- CSV 取り込みで一部行が失敗した場合、成功行も含めて DB に保存されない。
- CSV 取り込みで UTF-8、UTF-8 BOM 付き、Shift_JIS / CP932 のファイルを読み込める。
- `GET /api/health` が HTTP 200 を返す。
- コンテナを再作成しても、`./data/insurance.sqlite` が残っていれば保存データを復元できる。
- `npm run build` が成功する。

## 13. 確定事項

- コンサルタントメモは入力ごとに画面上の未保存状態へ反映する。SQLite への保存は保存ボタン押下時のみ行う。
- 本番運用時は Nginx を利用せず、Node サーバーで API とビルド済み静的ファイルを配信する。
- CSV 取り込み時に被保険者・受取人が既存家族情報と照合できない場合は、自動追加せずエラーにする。
- CSV 取り込みで一部行が失敗した場合は、成功行も保存せず全体をロールバックする。
- CSV は UTF-8、UTF-8 BOM 付き、Shift_JIS / CP932 に初期実装で対応する。

## 14. 実装対象・フェーズ

1. Docker Compose に `./data:/app/data` の永続化設定を追加する。
2. バックエンドに SQLite DB ファイル自動作成、接続、マイグレーション、`/api/health` を実装する。
3. `/api/app-state`、`/api/app-state/reset` を実装する。
4. `/api/app-state/export` による JSON 出力を実装する。
5. `/api/policies/import-csv` による CSV 取り込みを実装する。
6. `src/lib/api.ts` を追加し、React 側のデータ取得・保存・JSON 出力・CSV 取り込みを API 経由に変更する。
7. Docker 開発環境で Vite、API、SQLite を同時利用できるようにする。
8. API 単体テスト、CSV 取り込みテスト、`npm run build` で検証する。
