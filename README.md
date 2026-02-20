# MMM-MCP Chatbot Engineering

Marketing Mix Model (MMM) 分析プラットフォーム。AI チャットボットが GraphQL・MCP・E2B を駆使してマーケティングデータを分析し、インタラクティブなチャートを生成します。

## アーキテクチャ

```
┌─────────────────────────────────────────────────┐
│                 Next.js App                      │
│  ┌──────────────────┐  ┌─────────────────────┐  │
│  │   ChatPanel       │  │   GraphViewer       │  │
│  │   (conversation)  │  │   (Plotly.js)       │  │
│  └────────┬─────────┘  └──────────▲──────────┘  │
│           │    plotly JSON blocks  │              │
│           ▼                        │              │
│  ┌────────────────────────────────────────────┐  │
│  │         POST /api/chat                     │  │
│  │         (Claude tool-use loop)             │  │
│  └───┬──────────┬──────────────┬──────────────┘  │
│      │          │              │                  │
│      ▼          ▼              ▼                  │
│  GraphQL     E2B Cloud     MCP Client            │
│  /api/graphql  Sandbox     (stdio spawn)         │
│      │                        │                  │
│      ▼                        ▼                  │
│  SQLite DB              MCP Server               │
│  (data/mmm.db)          (3 analysis tools)       │
└─────────────────────────────────────────────────┘
```

## クイックスタート

```bash
# 全依存関係のインストール + DB シード + MCP ビルド
make setup

# .env.local に API キーを設定
ANTHROPIC_API_KEY=sk-ant-...
E2B_API_KEY=e2b_...

# Next.js + MkDocs を同時起動
make dev
```

| サービス | URL |
|---------|-----|
| Web アプリ | http://localhost:3456 |
| GraphiQL | http://localhost:3456/api/graphql |
| 設計ドキュメント | http://localhost:8765 |

## 応答例

### チャネル別支出の棒グラフ

「チャネル別のデータをプロットして」と質問した例。GraphQL でデータを取得し、チャネル別の総支出額と週次推移を Plotly チャートで表示。

![チャネル別支出の棒グラフ](scratch/channel-spend-bar.png)

### 収益貢献度の分析（ROI ランキング + 円グラフ）

「各チャネルが収益にどの程度影響しているか分析して」と質問した例。MCP の `run_mmm_regression` で回帰分析を実行し、`decompose_contributions` で貢献度を分解。ROI 効率性ランキングと円グラフを生成。

![収益貢献度の分析](scratch/revenue-contribution-pie.png)

### 収益貢献度の積み上げグラフ

「収益への各チャネルの貢献度を分解して、積み上げグラフで表示して」と質問した例。MCP の `decompose_contributions` + `generate_plot_data` で週次の貢献度を積み上げ棒グラフとして可視化。

![収益貢献度の積み上げグラフ](scratch/contribution-stacked-bar.png)

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 16, React, Tailwind CSS, Plotly.js |
| LLM | Anthropic Claude (tool use) |
| データ | SQLite (better-sqlite3) |
| API | GraphQL (graphql-yoga) |
| 分析 | MCP Server (Model Context Protocol) |
| コード実行 | E2B Cloud Sandboxes |

## Makefile コマンド

| コマンド | 説明 |
|---------|------|
| `make dev` | Honcho で全サービスを同時起動 |
| `make web` | Next.js のみ起動 |
| `make docs` | MkDocs のみ起動 |
| `make seed` | DB を再シード |
| `make build-mcp` | MCP サーバーをリビルド |
| `make setup` | フルセットアップ（初回） |
| `make clean` | 生成物を削除 |

## ドキュメント

設計仕様は MkDocs で管理されています。`make docs` で http://localhost:8765 から閲覧可能。

- [クイックスタート](docs/quickstart.md)
- [アーキテクチャ](docs/architecture.md)
- [データベース](docs/database.md)
- [GraphQL API](docs/graphql.md)
- [MCP サーバー](docs/mcp-server.md)
- [チャットボット](docs/chatbot.md)
- [E2B 連携](docs/e2b.md)
- [フロントエンド](docs/frontend.md)
- [API ルート](docs/api.md)
- [サンプルシナリオ](docs/scenarios.md)
