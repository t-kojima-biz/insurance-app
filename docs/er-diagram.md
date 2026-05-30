# ER図 — 保険証券分析・診断ダッシュボード

```mermaid
erDiagram
    cases {
        TEXT id PK "UUID"
        TEXT title "ケースタイトル"
        TEXT created_at "作成日時"
        TEXT updated_at "更新日時"
    }

    agencies {
        TEXT id PK "UUID"
        TEXT case_id FK, UK "cases.id (UNIQUE)"
        TEXT name "代理店名"
        TEXT representative "取扱者名"
        TEXT phone "電話番号"
        TEXT created_at "作成日時"
        TEXT updated_at "更新日時"
    }

    family_members {
        TEXT id PK "UUID"
        TEXT case_id FK "cases.id"
        TEXT name "氏名"
        TEXT name_kana "フリガナ"
        TEXT relationship "続柄"
        TEXT birth_date "生年月日 (YYYY-MM-DD)"
        TEXT gender "性別 (male/female)"
        INTEGER sort_order "表示順"
        TEXT created_at "作成日時"
        TEXT updated_at "更新日時"
    }

    policies {
        TEXT id PK "UUID"
        TEXT case_id FK "cases.id"
        TEXT company_name "保険会社名"
        TEXT policy_type "保険種類"
        TEXT policy_number "証券番号"
        TEXT contract_date "契約日 (YYYY-MM-DD)"
        INTEGER contract_age "契約年齢"
        TEXT insured_member_id FK "family_members.id (被保険者)"
        TEXT beneficiary_member_id FK "family_members.id (受取人)"
        INTEGER death_benefit_disease "死亡保障・疾病 (円)"
        INTEGER death_benefit_accident "死亡保障・災害 (円)"
        INTEGER hosp_day_disease "入院日額・疾病 (円)"
        INTEGER hosp_day_accident "入院日額・災害 (円)"
        INTEGER diagnosis_benefit "診断一時金 (円)"
        INTEGER policy_end_age "保険期間終了年齢"
        TEXT payment_frequency "払込頻度"
        INTEGER premium_amount "1回あたり保険料 (円)"
        TEXT payment_end_date "払込終了年月日"
        INTEGER payment_end_age "払込終了年齢"
        INTEGER annual_premium "年間保険料 (円)"
        INTEGER maturity_benefit "満期保険金 (円)"
        TEXT consultant_note "コンサルタントメモ"
        INTEGER sort_order "表示順"
        TEXT created_at "作成日時"
        TEXT updated_at "更新日時"
    }

    app_state_meta {
        TEXT case_id PK, FK "cases.id"
        INTEGER schema_version "スキーマバージョン"
        TEXT updated_at "更新日時"
        TEXT last_exported_at "最終エクスポート日時"
    }

    agency_masters {
        TEXT id PK "UUID"
        TEXT name "代理店名"
        TEXT representative "取扱者名"
        TEXT phone "電話番号"
        TEXT created_at "作成日時"
        TEXT updated_at "更新日時"
    }

    insurance_type_descriptions {
        TEXT policy_type PK "保険種類"
        TEXT long_description "詳細説明"
        TEXT purpose "目的"
        TEXT updated_at "更新日時"
    }

    portfolio_insights {
        TEXT id PK "UUID"
        TEXT case_id FK "cases.id"
        TEXT type "gap/redundancy/recommendation"
        TEXT text "分析コメント"
        INTEGER is_custom "手入力フラグ"
        INTEGER sort_order "表示順"
        TEXT created_at "作成日時"
        TEXT updated_at "更新日時"
    }

    app_settings {
        TEXT setting_key PK "設定キー"
        TEXT value "設定値"
        TEXT updated_at "更新日時"
    }

    cases ||--o| agencies : "1:1 代理店情報"
    cases ||--o{ family_members : "1:N 家族"
    cases ||--o{ policies : "1:N 証券"
    cases ||--o| app_state_meta : "1:1 メタ情報"
    cases ||--o{ portfolio_insights : "1:N 分析コメント"
    family_members ||--o{ policies : "被保険者 (RESTRICT)"
    family_members |o--o{ policies : "受取人 (SET NULL)"
```

## リレーション一覧

| 親テーブル | 子テーブル | 関係 | FKカラム | 削除時 |
|---|---|---|---|---|
| cases | agencies | 1:1 | case_id (UNIQUE) | CASCADE |
| cases | family_members | 1:N | case_id | CASCADE |
| cases | policies | 1:N | case_id | CASCADE |
| cases | app_state_meta | 1:1 | case_id | CASCADE |
| cases | portfolio_insights | 1:N | case_id | CASCADE |
| family_members | policies | 1:N | insured_member_id | RESTRICT |
| family_members | policies | 0:N | beneficiary_member_id | SET NULL |
| 独立 | agency_masters | - | - | - |
| 独立 | insurance_type_descriptions | - | - | - |
| 独立 | app_settings | - | - | - |

## インデックス

| インデックス名 | テーブル | カラム |
|---|---|---|
| idx_family_members_case_id_sort_order | family_members | `(case_id, sort_order)` |
| idx_policies_case_id_sort_order | policies | `(case_id, sort_order)` |
| idx_policies_case_id_policy_number | policies | `(case_id, policy_number)` |
| idx_policies_insured_member_id | policies | `(insured_member_id)` |
| idx_policies_beneficiary_member_id | policies | `(beneficiary_member_id)` |
| idx_portfolio_insights_case_id | portfolio_insights | `(case_id, sort_order)` |

## 制約

- `family_members.gender`: `male` または `female`
- `policies.payment_frequency`: `monthly`、`annual`、`single`
- `portfolio_insights.type`: `gap`、`redundancy`、`recommendation`
- `agencies.case_id`: `UNIQUE`
- 被保険者 `insured_member_id` は削除時 `RESTRICT`
- 受取人 `beneficiary_member_id` は削除時 `SET NULL`
- `app_settings.setting_key`: 主キー。証券取込プロンプトは `policy_import_prompt`
