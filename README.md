# 保険証券分析・診断ダッシュボード

保険コンサルタント向けに、顧客ごとの保険証券を管理し、保障内容・保険料負担・証券別分析を可視化するNext.jsアプリです。証券情報はSQLiteに保存し、CSV取込、JSON貼り付け、印刷用レポート出力に対応しています。

## 主な機能

- 顧客ケース、家族情報、代理店情報、保険証券の管理
- 代理店情報のSQLite保存、代理店マスターへの登録・更新・呼び出し
- 保険証券CSV取込と重複証券番号チェック
- 保険証券画像OCR向けJSONプロンプトの表示・編集・SQLite保存
- 現在の月額保険料負担、死亡保障、入院日額のサマリー表示
- 保険料推移、保障推移、種類別概要、個別証券分析
- A4横向きの印刷レポート、表紙、ページ番号、証券別改ページ
- SQLiteデータベースのバックアップ・復元

## 技術スタック

| 分類 | 技術 |
|---|---|
| フレームワーク | Next.js 16 App Router |
| UI | React 19, TypeScript 6, lucide-react |
| グラフ | Recharts |
| データベース | SQLite, better-sqlite3 |
| 実行環境 | Docker, node:22-alpine |

## Dockerで開発する

このリポジトリの開発はDocker前提です。

```powershell
docker compose up -d --build
```

起動後、ブラウザで `http://localhost:3030` を開きます。
`3020` は他用途で使うことがあるため、このアプリの標準ポートは `3030` にしています。

よく使う操作:

```powershell
docker compose logs -f insurance-app
docker compose down
docker compose restart insurance-app
```

## 本番ビルド確認

本番用のstandaloneビルドは以下で確認します。

```powershell
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache insurance-app
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

ヘルスチェック:

```powershell
curl http://localhost:3030/api/health
```

## 検証コマンド

TypeScriptチェック:

```powershell
docker compose exec -T insurance-app ./node_modules/.bin/tsc --noEmit --pretty false
```

サンプルリセットAPIの確認:

```powershell
docker compose exec -T insurance-app npm run test:sample-reset
```

## データ保存

開発環境ではSQLiteファイルを `data/insurance.sqlite` に保存します。`docker-compose.yml` では `./data:/app/data` をマウントしているため、コンテナを作り直してもデータは残ります。

本番オーバーライド `docker-compose.prod.yml` はビルド済み成果物を使い、SQLite保存先の `./data:/app/data` だけをマウントします。Windowsのbind mount上のSQLiteを書き込めるよう、このローカル本番構成ではサービスを `root` ユーザーで起動します。メモリ上限は `192m`、Node.jsヒープ上限は `128MB` に抑えています。
ポートを変更する場合は、`Dockerfile` の `APP_PORT`、`docker-compose.yml` の `APP_PORT` / `ports` / `healthcheck`、`package.json` の起動スクリプト、README/docsのURLを同じ値に揃えます。

## 関連ドキュメント

- [技術仕様書](docs/specification.md)
- [ER図](docs/er-diagram.md)
