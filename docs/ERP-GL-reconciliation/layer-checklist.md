# ERP-GL Reconciliation System - Layer Structure & Data Flow Checklist

## 📋 レイヤー順序の定義

```
Layer 1: Data Source Layer (Corporate Network)
    ↓
Layer 2: Ingestion & Automation Layer (Azure)
    ↓
Layer 3: Reconciliation Core Layer (Azure)
    ↓ (fallback to AI if unmatched)
Layer 3b: AI-Assisted Investigation Layer (Azure - fallback only)
    ↓
Layer 4: Finance Control Layer (Azure + Corporate Network access)
    ↓
[Output]: ERP/GL Update (only if approved)
```

---

## Layer 1: Data Source Layer

### ✅ 配置場所
- **Corporate Network** (external to Azure)

### ✅ 機能リスト（順序）
1. ☐ POS / Settlement portals からの生データ提供
2. ☐ Bank Transactions / Payment reports からの決済データ提供
3. ☐ ERP / GL extracts からの会計データ提供
4. ☐ Historical resolved cases からの過去解決済みケース提供

### ✅ セーフガード
- ☐ Retry mechanisms（接続失敗時の再試行）
- ☐ Fallback mechanisms（API失敗時のRPA切替）

### ✅ 出力 → Layer 2への受け渡し
| 出力データ | フォーマット | 受け渡し先 |
|-----------|------------|----------|
| POS transaction files | CSV/JSON/XML | Ingestion Service (API or RPA) |
| Bank transaction reports | CSV/PDF/Excel | Ingestion Service (API or RPA) |
| ERP/GL extracts | CSV/Database export | Ingestion Service (Read-only access) |
| Historical case records | JSON/Database | AI RAG Pipeline (read-only) |

---

## Layer 2: Ingestion & Automation Layer

### ✅ 配置場所
- **Azure Cloud** (Landing Zone: Azure Blob Storage / OneLake)
- **Azure Functions / Container Apps** (Ingestion services)

### ✅ 機能リスト（順序）
1. ☐ **Job Orchestrator**（月次バッチジョブのスケジューリング）
   - Python API / Azure Functions による定期実行トリガー
   - Ingestion services起動

2. ☐ **API Connector Service**（プライマリ取り込み）
   - POS/Bank/ERP APIへの接続
   - データダウンロード
   - Retry logic（3回、exponential backoff）
   - Timeout handling

3. ☐ **RPA Service**（フォールバック取り込み）
   - API失敗時のUI automation起動
   - Portal login & screen scraping
   - File download

4. ☐ **AI Troubleshooter**（RPA失敗診断）
   - RPA失敗時のエラーログ解析
   - 動的UI変更の検出
   - AI-suggested retry（限定的な自動修正）
   - 開発チームへの診断レポート付きエスカレーション

5. ☐ **Data Normalization Service**
   - File format standardization（CSV統一など）
   - Schema validation
   - Data cleansing
   - Currency/date format normalization

6. ☐ **Raw Storage**（生データ専用ストレージ）
   - Raw files格納（元データ保存：API/RPAから直接）
   - Monthly snapshots作成（月次スナップショット分離）
   - Immutable storage（変更不可）

7. ☐ **Normalized Storage**（正規化済みデータ専用ストレージ）
   - Normalized files格納（正規化後データ：Normalizerから保存）
   - Validated & standardized CSV/Parquet
   - Ready for batch processing

   **データフロー（明確な分離）**:
   - API/RPA → **Raw Storage** (Raw files保存)
   - **Raw Storage** → Normalizer (Raw files読み取り)
   - Normalizer → **Normalized Storage** (Normalized files保存)
   - **Normalized Storage** → Batch Processor (Normalized files読み取り)

### ✅ セーフガード
- ☐ **Read-only ingestion**（ERPへの書き込み禁止）
- ☐ **Monthly snapshot isolation**（監査可能性担保）
- ☐ **Idempotent processing**（重複実行時の冪等性）
- ☐ **AI troubleshooting controls**（AI診断は提案のみ、限定的な自動リトライ、監査ログ記録）
- ☐ **No security bypass**（AIはCAPTCHA解読や認証情報操作を実施しない）

### ✅ 出力 → Layer 3への受け渡し
| 出力データ | フォーマット | 受け渡し先 |
|-----------|------------|----------|
| Normalized POS transactions | Standardized CSV | Batch Processor (from Normalized Storage) |
| Normalized Bank settlements | Standardized CSV | Batch Processor (from Normalized Storage) |
| Normalized ERP/GL entries | Standardized CSV | Batch Processor (from Normalized Storage) |
| Raw files snapshot | Immutable blob | Raw Storage (monthly isolation) |
| Normalized files snapshot | Immutable blob | Normalized Storage (monthly isolation) |
| Ingestion audit logs | JSON | Reconciliation DB (audit trail) |

---

## Layer 3: Reconciliation Core Layer

### ✅ 配置場所
- **Azure SQL / PostgreSQL** (Reconciliation DB)
- **Power Automate** (Deterministic Engine implementation)
- **Azure Container Apps** (Batch Processor)

### ✅ 機能リスト（順序）

#### 3-1. Batch Processor（前処理）
1. ☐ Normalized filesのロード
2. ☐ データ重複排除（deduplication）
3. ☐ バッチIDの付与
4. ☐ 処理済みフラグのチェック（冪等性確保）

#### 3-2. Deterministic Reconciliation Engine（Power Automate実装）
5. ☐ **Exact matching**
   - Amount完全一致
   - Date完全一致
   - Transaction ID一致

6. ☐ **Tolerance matching**
   - Amount tolerance（±0.01など）
   - Date lag tolerance（±2 daysなど）

7. ☐ **1:N / N:1 candidate grouping**
   - 複数トランザクションの合計マッチング
   - Candidate pair生成

8. ☐ **Match confirmation**
   - Matched casesをReconciliation DBに保存
   - Match typeとconfidence記録

#### 3-3. Exception Case Manager
9. ☐ **Exception creation**
   - Unmatched transactions検出
   - Exception type分類（timing, partial, unmatched）
   - Structured case objectsの作成

10. ☐ **Persistent case state**
    - Case statusをDBに保存（open, investigating, resolved）
    - Versioningによる変更履歴保存

#### 3-4. Reconciliation DB（データ永続化）
11. ☐ **Case history保存**
    - すべてのmatching結果
    - Exception cases
    - Case state transitions

12. ☐ **Audit logs記録**
    - 誰が・いつ・何を実行したか
    - Rule version適用履歴

### ✅ セーフガード
- ☐ **Rules first**（AIより先に決定論的ルールを優先）
- ☐ **Versioned rule sets**（ルールのバージョン管理）
- ☐ **Idempotent batch processing**（再実行時の冪等性）
- ☐ **Monthly snapshot isolation**（月次分離による監査可能性）

### ✅ 出力 → Layer 3b (AI) または Layer 4への受け渡し
| 出力データ | フォーマット | 受け渡し先 | 条件 |
|-----------|------------|----------|------|
| **Matched cases** | JSON/DB records | Finance Workbench | 常時（レビュー用） |
| **Unmatched exceptions** | JSON/DB records | AI Investigation Service | unmatched cases のみ（fallback） |
| **Exception metadata** | JSON | Finance Workbench | 常時（レビュー用） |
| **Reconciliation audit logs** | JSON | Audit Trail Store | 常時（監査用） |

---

## Layer 3b: AI-Assisted Investigation Layer (Fallback Only)

### ✅ 配置場所
- **Azure Container Apps** (LangGraph service)
- **Azure AI Search** (RAG pipeline)
- **Azure OpenAI** (LLM inference)

### ✅ 機能リスト（順序）
1. ☐ **Unmatched case routing**
   - Exception Managerから未解決ケースを受信
   - Case status = "investigating"に更新

2. ☐ **RAG-based similar case retrieval**
   - Historical resolved casesからベクトル検索
   - Top-K similar cases取得

3. ☐ **Root cause analysis**
   - LLMによる原因分析
   - Timing issue / Data quality issue / Missing transaction判定

4. ☐ **Resolution suggestion generation**
   - 推奨アクション生成（"wait for next batch", "manual adjustment needed"など）
   - Confidence score算出（0.0-1.0）
   - Explanation text生成（explainability確保）

5. ☐ **Suggestion storage**
   - AI suggestionsをReconciliation DBに保存（metadata）
   - **重要**: AI決定ではなくsuggest metadata のみ

### ✅ セーフガード
- ☐ **AI suggestion only**（AIは決定しない、提案のみ）
- ☐ **No autonomous matching**（AIはマッチング実行しない）
- ☐ **No accounting entry triggering**（AIは仕訳起票しない）
- ☐ **Explainable outputs**（根拠と信頼度を明示）

### ✅ 出力 → Layer 4への受け渡し
| 出力データ | フォーマット | 受け渡し先 |
|-----------|------------|----------|
| AI root cause suggestions | JSON metadata | Finance Workbench (review UI) |
| Similar historical cases | JSON references | Finance Workbench (context) |
| Confidence scores | Float (0.0-1.0) | Finance Workbench (indicator) |
| Explanation text | String | Finance Workbench (explainability) |

---

## Layer 4: Finance Control Layer

### ✅ 配置場所
- **Azure Static Web Apps** (Finance Workbench UI)
- **Azure Container Apps** (Approval Gateway API)
- **Azure SQL / PostgreSQL** (Audit Trail Store)

### ✅ 機能リスト（順序）

#### 4-1. Finance Workbench（レビューUI）
1. ☐ **Matched cases review**
   - 自動マッチング結果の確認
   - Tolerance matchの妥当性チェック

2. ☐ **Exception cases review**
   - Unmatched exceptionsの確認
   - AI suggestionsの参照（あれば）
   - Similar historical casesの参照

3. ☐ **Decision making**
   - Approve（承認）
   - Reject（却下・再調査）
   - Adjust（手動調整）
   - Escalate（エスカレーション）

#### 4-2. Approval Gateway（承認制御）
4. ☐ **SoD validation**（職務分離検証）
   - 起票者と承認者の分離確認
   - 権限レベルチェック

5. ☐ **Approval workflow**
   - 承認フロー実行（1段階 or 2段階承認）
   - 承認ステータス管理

6. ☐ **Full audit trail recording**
   - User ID記録
   - Timestamp記録
   - Decision reason記録
   - Version記録
   - Source-to-decision lineage保存

#### 4-3. Controlled Output Service
7. ☐ **Exception log generation**
   - 未解決exceptions一覧作成
   - SLA breach alerts

8. ☐ **Suggested accounting entries generation**
   - 承認済みケースから仕訳提案作成
   - ERP format変換

9. ☐ **ERP write execution**（承認時のみ）
   - **承認済みのみ**ERP/GLに書き込み
   - Write結果の確認
   - Rollback機能（失敗時）

10. ☐ **Historical cases archival**
    - 解決済みケースをHistorical Cases DBにアーカイブ
    - AI RAG pipelineで再利用可能に

### ✅ セーフガード
- ☐ **Finance approval required**（すべてのERP書き込みに承認必須）
- ☐ **No automatic ERP/GL posting**（自動起票禁止）
- ☐ **SoD enforcement**（職務分離強制）
- ☐ **Full auditability**（完全な監査証跡）

### ✅ 出力 → ERP/GL & Historical Cases
| 出力データ | フォーマット | 受け渡し先 | 条件 |
|-----------|------------|----------|------|
| **Approved accounting entries** | ERP-specific format (CSV/API) | ERP / GL system | 承認済みのみ |
| **Exception log** | Excel/PDF report | Finance team | 月次レポート |
| **Audit trail** | JSON/DB records | Audit Trail Store | 常時 |
| **Resolved historical cases** | JSON | Historical Cases DB | 解決済みケースのみ |

---

## 🔄 End-to-End Data Flow Summary

```
[Data Sources]
  → Raw files
      ↓
[Ingestion & Automation]
  → Normalized files + Monthly snapshots
      ↓
[Reconciliation Core]
  → Matched cases (90%+) ────────────────┐
  → Unmatched exceptions (5-10%) ───┐    │
      ↓                             ↓    │
[AI Investigation] (fallback)       │    │
  → AI suggestions + confidence     │    │
      ↓                             ↓    ↓
[Finance Control]
  → Review all cases (matched + exceptions + AI suggestions)
  → Finance decision (approve/reject/adjust/escalate)
  → Audit trail
      ↓ (approved only)
[ERP/GL Update]
  → Accounting entries posted

[Historical Cases Archive] ← Resolved cases
  → Used for future AI RAG retrieval
```

---

## ⚠️ Critical Control Points Checklist

### ✅ Layer 1 → Layer 2
- ☐ Read-only access to ERP/GL（書き込み権限なし）
- ☐ API failure → RPA fallback実行
- ☐ Retry 3回（exponential backoff）

### ✅ Layer 2 → Layer 3
- ☐ Schema validation pass（不正データは quarantine）
- ☐ Monthly snapshot作成完了
- ☐ Normalization完了確認

### ✅ Layer 3 → Layer 3b (AI)
- ☐ **Deterministic rules優先実行完了**（AI呼び出し前）
- ☐ Unmatched cases のみAIにルーティング
- ☐ AI service unavailable時は手動レビューにフォールバック

### ✅ Layer 3b → Layer 4
- ☐ AI suggestions は metadata のみ（decision権限なし）
- ☐ Confidence score < 0.5 の場合は警告表示

### ✅ Layer 4 → ERP/GL
- ☐ **Finance approval必須**（自動実行禁止）
- ☐ SoD validation pass
- ☐ Full audit trail記録完了
- ☐ ERP write成功確認 or Rollback

---

## 📝 使用方法

このチェックリストは以下の用途で使用できます：

1. **設計検証**: 現在のアーキテクチャ図（architecture-diagram.md）が仕様を正しく反映しているか確認
2. **実装ガイド**: 各レイヤーの実装時に必要な機能の抜け漏れチェック
3. **テスト計画**: 統合テストシナリオ作成時のレイヤー間データフロー確認
4. **レビュー資料**: ステークホルダーレビュー時の網羅性確認

---

**作成日**: 2026-04-26
**参照元**: `/docs/ERP-GL-reconciliation/specs-architecture.md`
**関連ドキュメント**:
- `/docs/ERP-GL-reconciliation/architecture-diagram.md` (PowerPoint版)
- `/docs/ERP-GL-reconciliation/architecture-diagram-detailed.md` (詳細版)
