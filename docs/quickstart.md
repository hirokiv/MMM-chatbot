# クイックスタート

## 前提条件

- Node.js 18+
- [uv](https://docs.astral.sh/uv/)（Python ツール管理）
- [Anthropic API Key](https://console.anthropic.com)
- [E2B API Key](https://e2b.dev)

## 1. セットアップ（Makefile 利用）

```bash
# リポジトリをクローン
git clone <repository-url>
cd MMM-MCP-chatbot-engineering

# 全依存関係のインストール + DB シード + MCP ビルドを一括実行
make setup
```

!!! tip "make setup が行うこと"
    1. `npm install`（Next.js 依存関係）
    2. `cd mcp-server && npm install`（MCP サーバー依存関係）
    3. `uv tool install honcho`（プロセスマネージャー）
    4. `uv tool install mkdocs --with mkdocs-material`（ドキュメント）
    5. `cd mcp-server && npx tsc`（MCP サーバービルド）
    6. `npx tsx scripts/seed-db.ts`（SQLite DB シード）

## 2. 環境変数の設定

`.env.local` を編集して API キーを設定：

```bash
ANTHROPIC_API_KEY=sk-ant-xxxxx
E2B_API_KEY=e2b_xxxxx
```

## 3. 開発サーバーの起動

```bash
# Next.js (port 3000) + MkDocs (port 8000) を同時起動
make dev
```

| サービス | URL | 説明 |
|---------|-----|------|
| Web アプリ | http://localhost:3000 | チャット UI + GraphViewer |
| GraphiQL | http://localhost:3000/api/graphql | GraphQL プレイグラウンド |
| 設計ドキュメント | http://localhost:8000 | MkDocs デザインスペック |

## 4. 動作確認

### GraphQL API のテスト

ブラウザで http://localhost:3000/api/graphql を開き、以下のクエリを実行：

```graphql
{
  channels {
    id
    name
    description
  }
  channelSummaries {
    channelName
    totalSpend
    avgWeeklySpend
  }
}
```

### チャットの動作確認

http://localhost:3000 を開き、以下のプロンプトを試す：

1. **データ取得**: 「チャネルごとの週次支出を見せて」
2. **回帰分析**: 「収益に対する回帰分析を実行して」
3. **Python 分析**: 「Python で相関行列を計算して」

## Makefile コマンド一覧

| コマンド | 説明 |
|---------|------|
| `make dev` | Honcho で全サービスを同時起動 |
| `make web` | Next.js のみ起動 |
| `make docs` | MkDocs のみ起動 |
| `make seed` | DB を再シード |
| `make build-mcp` | MCP サーバーをリビルド |
| `make install` | Node.js 依存関係のインストール |
| `make install-python` | Python ツール（honcho, mkdocs）を uv でインストール |
| `make setup` | フルセットアップ（初回） |
| `make clean` | 生成物を削除（`.next`, `data/mmm.db`, `mcp-server/build`） |
