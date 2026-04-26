# Azure Services Mapping - ERP-GL Reconciliation System

**作成日**: 2026-04-26
**参照元**:
- `specs-architecture.md` (仕様書)
- `architecture-diagram.md` (アーキテクチャ図)

---

## 📋 Azure Services 対応表

| # | Azureサービス | 仕様書参照 | architecture-diagram.md 実装箇所 | 使用コンポーネント |
|---|-------------|-----------|-------------------------------|----------------|
| 1 | **Azure Functions** | 推測（スケジューリング） | 行36, 426, 433 | Job Orchestrator |
| 2 | **Azure Container Apps** | 行4 明示 | 行39, 40, 45, 48, 54, 56, 61, 65, 72, 74, 167, 456, 588, 634-637 | API Connector, RPA Service, Normalizer, AI Troubleshooter, Batch Processor, Exception Manager, AI Investigator, Confidence Scorer, Approval Gateway, Controlled Output |
| 3 | **Azure SQL** | 行4 明示 (SQL/PostgreSQL) | 行50, 168, 457, 565, 635 | Reconciliation DB |
| 4 | **Azure Blob Storage** | 行4 明示 (OneLake) | 行43, 76, 169, 458, 560, 561 | Landing Zone, Audit Store |
| 5 | **OneLake** | 行4 明示 | 行43, 169 | Landing Zone |
| 6 | **Azure Monitor** | 行4 明示 | 行83, 470, 507, 527, 543, 587, 638 | Monitoring & Alerts |
| 7 | **LangGraph** | 行4 明示 | 行61, 428, 437, 571, 636 | AI Investigator (AI orchestration) |
| 8 | **Azure Key Vault** | 行4 明示 | 行81, 585, 638 | Secrets management |
| 9 | **Azure Static Web Apps** | 行4 明示 | 行70, 170, 460, 576, 637 | Finance Workbench UI |
| 10 | **Power Automate** | 行49, 97 明示 | 行52, 188, 412-437, 557, 591, 634 | Deterministic Reconciliation Engine |
| 11 | **Azure AI Search** | 推測（RAG） | 行63, 171, 459, 572, 636 | RAG Pipeline |
| 12 | **Azure Entra ID** | 推測（RBAC/SoD） | 行85, 584, 638 | RBAC Service |
| 13 | **Azure OpenAI** | 推測（LLM） | 暗黙的（LangGraph内） | AI Investigator (LLM inference) |

---

## 🔍 詳細マッピング

### 1. Azure Functions

**仕様書参照**:
- 明示的記載なし（推測：月次スケジューリング）

**architecture-diagram.md 実装箇所**:
| 行番号 | 内容 | コンポーネント |
|-------|------|--------------|
| 36 | `Orchestrator["<b>Job Orchestrator</b><br/>⚡ <b>Azure Functions</b><br/>Monthly scheduling"]` | Job Orchestrator |
| 426 | `❌ Job scheduling (handled by Job Orchestrator - Python API/Azure Functions)` | 設計理由説明 |
| 433 | `- Python API, Azure Functions, or scheduled triggers` | 実装選択肢 |

**役割**:
- タイマートリガーで月次バッチジョブを起動
- API Connector を呼び出してデータ取得開始

---

### 2. Azure Container Apps

**仕様書参照**:
- **行4**: "Azure Container Aps" (明示)

**architecture-diagram.md 実装箇所**:
| 行番号 | 内容 | コンポーネント |
|-------|------|--------------|
| 39 | `APIConnector["<b>API Connector</b><br/>📦 <b>Container Apps</b><br/>API + Retry"]` | API Connector Service |
| 40 | `RPA["<b>RPA Service</b><br/>📦 <b>Container Apps</b><br/>Portal Fallback"]` | RPA Service |
| 45 | `Normalizer["<b>Normalizer</b><br/>📦 <b>Container Apps</b><br/>Validation"]` | Data Normalization Service |
| 48 | `AITroubleshooter["<b>AI Troubleshooter</b><br/>📦 <b>Container Apps</b> + LangGraph<br/>RPA failure diagnosis"]` | AI Troubleshooter (Ingestion) |
| 54 | `BatchProcessor["<b>Batch Processor</b><br/>📦 <b>Container Apps</b><br/>Idempotent"]` | Idempotent Batch Processor |
| 56 | `ExceptionMgr["<b>Exception Manager</b><br/>📦 <b>Container Apps</b><br/>Unmatched cases"]` | Exception Case Manager |
| 61 | `AIInvestigator["<b>AI Investigator</b><br/>📦 <b>Container Apps</b> + LangGraph<br/>Root cause"]` | AI Investigation Service |
| 65 | `ConfidenceEngine["<b>Confidence Scorer</b><br/>📦 <b>Container Apps</b><br/>0-100%"]` | Confidence Scoring Engine |
| 72 | `ApprovalGateway["<b>Approval Gateway</b><br/>📦 <b>Container Apps</b><br/>SoD enforcement"]` | Approval Gateway Service |
| 74 | `ControlledOutput["<b>Controlled Output</b><br/>📦 <b>Container Apps</b><br/>ERP posting"]` | Controlled Output Service |
| 167 | `- **Azure Container Apps** - Microservices requiring auto-scaling, HTTPS ingress, and event-driven triggers` | サービス選択理由 |
| 456 | `- **Container Apps** - Auto-scaling microservices with HTTP/event triggers` | Azure Service Mapping |
| 588 | `Release management (Dev/Test/Prod) \| 90 \| Azure Container Apps \| Environment-based deployments` | Requirements Traceability |
| 634 | `🟨 Yellow \| Workflow/Automation \| Power Automate, Container Apps (ingestion)` | Legend |
| 635 | `🟩 Green \| Reconciliation \| Container Apps (engine), Azure SQL/PostgreSQL` | Legend |
| 636 | `🌸 Pink (dashed border) \| AI Inference (Fallback) \| Container Apps (LangGraph), Azure AI Search` | Legend |
| 637 | `🟦 Purple (thick border) \| Finance Control \| Static Web Apps, Container Apps (gateway)` | Legend |

**役割**:
- **合計10個のマイクロサービス**をホスティング
  - Ingestion: API Connector, RPA Service, Normalizer, AI Troubleshooter
  - Reconciliation: Batch Processor, Exception Manager
  - AI: AI Investigator, Confidence Scorer
  - Finance: Approval Gateway, Controlled Output
- Auto-scaling, HTTPS ingress, event-driven triggers対応

---

### 3. Azure SQL

**仕様書参照**:
- **行4**: "Azure SQL/PostgreSQL" (明示)
- **行60**: "Reconciliation DB"
- **行61-63**: Case history, Matching results, Audit logs

**architecture-diagram.md 実装箇所**:
| 行番号 | 内容 | コンポーネント |
|-------|------|--------------|
| 50 | `RecDB[("<b>Recon DB</b><br/>🗄️ <b>Azure SQL</b><br/>Case history")]` | Reconciliation Database |
| 168 | `- **Azure SQL/PostgreSQL** - Transactional data requiring ACID guarantees` | サービス選択理由 |
| 457 | `- **Azure SQL** - ACID-compliant transactional database for case history` | Azure Service Mapping |
| 565 | `Case history \| 61 \| Reconciliation DB \| Azure SQL/PostgreSQL schema` | Requirements Traceability |
| 635 | `🟩 Green \| Reconciliation \| Container Apps (engine), Azure SQL/PostgreSQL` | Legend |

**格納データ**:
- Case history（ケース履歴）
- Matching results（マッチング結果）
- Audit logs（監査ログ）
- Persistent case state（永続化ケース状態）

---

### 4. Azure Blob Storage / OneLake

**仕様書参照**:
- **行4**: "OneLake" (明示 - Blob Storage の代替/併用)
- **行53-56**: Landing zone - Raw files, Normalized files, Monthly snapshots
- **行88**: Audit trails

**architecture-diagram.md 実装箇所**:
| 行番号 | 内容 | コンポーネント |
|-------|------|--------------|
| 43-47 | `RawStorage` + `NormalizedStorage` | Raw Storage + Normalized Storage (分離設計) |
| 76 | `AuditStore[("<b>Audit Store</b><br/>💾 <b>Blob Storage</b><br/>Append-only")]` | Audit Trail Store |
| 169 | `- **Azure Blob/OneLake** - Immutable audit logs and monthly snapshots` | サービス選択理由 |
| 458 | `- **Azure Blob** - Immutable audit logs with append-only writes` | Azure Service Mapping |

**格納データ（分離設計）**:
- **Raw Storage**:
  - Raw files only（API/RPAから取得した生データ専用）
  - Monthly snapshots（月次スナップショット）
  - Immutable（変更不可）
- **Normalized Storage**:
  - Normalized files only（Normalizerで正規化後のデータ専用）
  - Validated & standardized CSV/Parquet
  - Ready for batch processing
- **Audit Store**:
  - Append-only audit logs

**データフロー（明確な分離）**:
1. API/RPA → **Raw Storage** (Raw files保存)
2. **Raw Storage** → Normalizer (Raw files読み取り)
3. Normalizer → **Normalized Storage** (Normalized files保存)
4. **Normalized Storage** → Batch Processor (Normalized files読み取り)

**分離設計のメリット**:
- データの流れが明確（Raw → Normalized の一方向）
- 誤って生データを処理するリスクを低減
- アクセス制御やライフサイクル管理が容易
- 監査時のトレーサビリティ向上

---

### 5. OneLake

**仕様書参照**:
- **行4**: "OneLake" (明示)
- **行53**: "Landing zone"

**architecture-diagram.md 実装箇所**:
| 行番号 | 内容 | コンポーネント |
|-------|------|--------------|
| 43 | `Landing["<b>Landing Zone</b><br/>💾 <b>Blob / OneLake</b><br/>Monthly snapshots"]` | Landing Zone Storage |
| 169 | `- **Azure Blob/OneLake** - Immutable audit logs and monthly snapshots` | サービス選択理由 |

**役割**:
- Azure Blob Storage の代替または併用
- データレイクとしての大規模データ格納

---

### 6. Azure Monitor

**仕様書参照**:
- **行4**: "Azure Monitor" (明示)
- **行11**: "provide monitoring and alerting"
- **行89**: "Monitoring & alerts when failed jobs and missing files"

**architecture-diagram.md 実装箇所**:
| 行番号 | 内容 | コンポーネント |
|-------|------|--------------|
| 83 | `Monitor["📊 <b>Azure Monitor</b><br/>Alerts & Logs"]` | Azure Monitor |
| 470 | `- **Monitoring** - Azure Monitor alerts on job failures, missing files, and SLA breaches` | 設計セーフガード |
| 507 | `- **SLA monitoring** - Azure Monitor tracks unresolved exceptions > 5 days` | Operational Continuity |
| 527 | `Monitoring and alerting \| 11 \| Azure Monitor \| Job failures, missing files, SLA breaches` | Requirements Traceability |
| 543 | `Monitor completeness and exceptions \| 25 \| Azure Monitor \| Tracks unresolved cases and completeness %` | Requirements Traceability |
| 587 | `Monitoring & alerts \| 89 \| Azure Monitor \| Failed jobs, missing files` | Requirements Traceability |
| 638 | `⚪ Gray \| Platform Governance \| Key Vault, Monitor, Azure AD/Entra ID` | Legend |

**監視対象**:
- Failed jobs（失敗ジョブ）
- Missing files（欠落ファイル）
- SLA breaches（SLA違反）
- Unresolved exceptions（未解決例外）
- **RPA Service failures（RPAサービス失敗）** - AI Troubleshooter診断後、開発チームへのアラート
- **AI Troubleshooter diagnostics（AI診断ログ）** - AI-assisted retryの成功/失敗記録

---

### 7. LangGraph

**仕様書参照**:
- **行4**: "LangGraph service in Azure environment" (明示)
- **行68**: "AI-assisted investigation"
- **行114-119**: AI fallback layer

**architecture-diagram.md 実装箇所**:
| 行番号 | 内容 | コンポーネント |
|-------|------|--------------|
| 61 | `AIInvestigator["<b>AI Investigator</b><br/>📦 <b>Container Apps</b> + LangGraph<br/>Root cause"]` | AI Investigation Service |
| 428 | `❌ AI-driven analysis (handled by AI Investigator - LangGraph)` | 設計理由説明 |
| 437 | `The architecture clearly separates **job scheduling** (Job Orchestrator) from **reconciliation logic** (Power Automate) from **AI inference** (LangGraph).` | 設計理由 |
| 571 | `Root cause suggestion \| 69 \| AI Investigator \| LangGraph workflow` | Requirements Traceability |
| 636 | `🌸 Pink (dashed border) \| AI Inference (Fallback) \| Container Apps (LangGraph), Azure AI Search` | Legend |

**役割**:
- AI orchestration（AIワークフロー制御）
- Root cause analysis（根本原因分析）
- Confidence scoring（信頼度スコアリング）

---

### 8. Azure Key Vault

**仕様書参照**:
- **行4**: "Azure Key Vault" (明示)
- **行87**: "Credential management for secrets and portal credentials"

**architecture-diagram.md 実装箇所**:
| 行番号 | 内容 | コンポーネント |
|-------|------|--------------|
| 81 | `KeyVault["🔑 <b>Azure Key Vault</b><br/>Secrets"]` | Azure Key Vault |
| 585 | `Credential management \| 87 \| Azure Key Vault \| Secrets and service principals` | Requirements Traceability |
| 638 | `⚪ Gray \| Platform Governance \| Key Vault, Monitor, Azure AD/Entra ID` | Legend |

**格納シークレット**:
- Portal credentials（ポータル認証情報）
- API keys（APIキー）
- Service principals（サービスプリンシパル）

---

### 9. Azure Static Web Apps

**仕様書参照**:
- **行4**: "Azure Static Web Apps" (明示)
- **行75**: "Finance Workbench"

**architecture-diagram.md 実装箇所**:
| 行番号 | 内容 | コンポーネント |
|-------|------|--------------|
| 70 | `Workbench["<b>Finance Workbench</b><br/>🌐 <b>Static Web Apps</b><br/>Review & Approve"]` | Finance Workbench UI |
| 170 | `- **Azure Static Web Apps** - Finance UI with global CDN distribution` | サービス選択理由 |
| 460 | `- **Azure Static Web Apps** - Global CDN for Finance Workbench UI` | Azure Service Mapping |
| 576 | `Review \| 76 \| Finance Workbench \| Azure Static Web Apps UI` | Requirements Traceability |
| 637 | `🟦 Purple (thick border) \| Finance Control \| Static Web Apps, Container Apps (gateway)` | Legend |

**役割**:
- Finance team向けUIホスティング
- Global CDN distribution
- Review, Approve, Reject, Adjust, Escalate機能

---

### 10. Power Automate

**仕様書参照**:
- **行49**: "Power Automate / RPA"
- **行97**: "rule-based reconciliation logic using Power Automate"
- **行98-101**: Portal login, Scheduled downloads, File normalization, Rule-based matching

**architecture-diagram.md 実装箇所**:
| 行番号 | 内容 | コンポーネント |
|-------|------|--------------|
| 52 | `Engine["<b>Deterministic Engine</b><br/>🔄 <b>Power Automate</b><br/>Rule matching"]` | Deterministic Reconciliation Engine |
| 188 | `participant Engine as <b>Deterministic Engine<br/>(Power Automate)</b>` | Sequence Diagram |
| 412 | `### Power Automate's Correct Role` | 設計理由セクション |
| 414 | `**Power Automate implements the Deterministic Reconciliation Engine:**` | 役割説明 |
| 416 | `- **Conditional branching** - Power Automate flows for matching rules` | 機能説明 |
| 420 | `**What Power Automate DOES:**` | 機能リスト |
| 425 | `**What Power Automate DOES NOT do:**` | 除外機能リスト |
| 437 | `The architecture clearly separates **job scheduling** (Job Orchestrator) from **reconciliation logic** (Power Automate) from **AI inference** (LangGraph).` | 設計理由 |
| 557 | `Scheduled downloads \| 50 \| Power Automate Orchestrator \| Monthly job scheduling` | Requirements Traceability |
| 591 | `Scheduled downloads \| 99 \| Power Automate Orchestrator \| Cron-based triggers` | Requirements Traceability |
| 634 | `🟨 Yellow \| Workflow/Automation \| Power Automate, Container Apps (ingestion)` | Legend |

**役割**:
- **Deterministic Reconciliation Engine の実装**
- Rule-based matching（Exact, Tolerance, 1:N/N:1）
- Conditional branching（条件分岐）
- Loop processing（ループ処理）
- Exception routing（例外ルーティング）

**重要な設計原則**:
- ✅ Reconciliation logic実装
- ❌ Job scheduling（Job Orchestratorが担当）
- ❌ AI-driven analysis（LangGraphが担当）
- ❌ Accounting entries（Controlled Outputが担当）

---

### 11. Azure AI Search

**仕様書参照**:
- **行116**: "Retrieve a similar historical cases for the unmatched case (RAG-based)" (推測)

**architecture-diagram.md 実装箇所**:
| 行番号 | 内容 | コンポーネント |
|-------|------|--------------|
| 63 | `RAGPipeline["<b>RAG Pipeline</b><br/>🔍 <b>Azure AI Search</b><br/>Similar cases"]` | RAG Pipeline |
| 171 | `- **Azure AI Search** - Vector similarity search for RAG pipeline` | サービス選択理由 |
| 459 | `- **Azure AI Search** - Vector embeddings for RAG similarity search` | Azure Service Mapping |
| 572 | `Similar case reference \| 70 \| RAG Pipeline \| Azure AI Search embeddings` | Requirements Traceability |
| 636 | `🌸 Pink (dashed border) \| AI Inference (Fallback) \| Container Apps (LangGraph), Azure AI Search` | Legend |

**役割**:
- Vector similarity search（ベクトル類似度検索）
- Historical cases retrieval（過去ケース検索）
- RAG (Retrieval-Augmented Generation) pipeline

---

### 12. Azure Entra ID

**仕様書参照**:
- **行86**: "Access control by rule based access and SoD" (推測)

**architecture-diagram.md 実装箇所**:
| 行番号 | 内容 | コンポーネント |
|-------|------|--------------|
| 85 | `RBAC["👤 <b>Entra ID</b><br/>RBAC & SoD"]` | RBAC Service |
| 584 | `Access control by RBAC and SoD \| 86 \| RBAC Service \| Azure AD/Entra ID roles` | Requirements Traceability |
| 638 | `⚪ Gray \| Platform Governance \| Key Vault, Monitor, Azure AD/Entra ID` | Legend |

**役割**:
- Role-Based Access Control (RBAC)
- Segregation of Duties (SoD) enforcement
- Session management

---

### 13. Azure OpenAI

**仕様書参照**:
- **行69**: "Root cause suggestion" (推測)
- **行115**: "AI will assist investigation" (推測)

**architecture-diagram.md 実装箇所**:
| 行番号 | 内容 | コンポーネント |
|-------|------|--------------|
| 暗黙的 | LangGraph内でLLM inferenceとして使用 | AI Investigator (暗黙的) |

**役割**:
- LLM inference（大規模言語モデル推論）
- Root cause analysis（根本原因分析）
- Resolution suggestion generation（解決策提案生成）

**注意**: Azure OpenAIは図に明示的に表示されていませんが、LangGraphの内部でLLMエンジンとして使用されることが想定されます。

---

## ✅ 検証サマリー

### 仕様書で明示されたAzureサービス（行4）

| Azureサービス | 仕様書 | architecture-diagram.md | 状態 |
|-------------|-------|------------------------|------|
| Azure Container Apps | ✅ 明示 | ✅ 9コンポーネントで使用 | ✅ 完全実装 |
| Azure SQL/PostgreSQL | ✅ 明示 | ✅ Reconciliation DB | ✅ 完全実装 |
| OneLake | ✅ 明示 | ✅ Landing Zone (Blob併記) | ✅ 完全実装 |
| Azure Monitor | ✅ 明示 | ✅ Governance Domain | ✅ 完全実装 |
| LangGraph service | ✅ 明示 | ✅ AI Investigator | ✅ 完全実装 |
| Azure Key Vault | ✅ 明示 | ✅ Governance Domain | ✅ 完全実装 |
| Azure Static Web Apps | ✅ 明示 | ✅ Finance Workbench | ✅ 完全実装 |

### 仕様書で推測されるAzureサービス

| Azureサービス | 仕様書 | architecture-diagram.md | 状態 |
|-------------|-------|------------------------|------|
| Power Automate | ✅ 行49, 97 | ✅ Deterministic Engine | ✅ 完全実装 |
| Azure Functions | ⚠️ 推測 | ✅ Job Orchestrator | ✅ 実装済み |
| Azure Blob Storage | ⚠️ 推測 | ✅ Landing Zone, Audit Store | ✅ 実装済み |
| Azure AI Search | ⚠️ 推測 | ✅ RAG Pipeline | ✅ 実装済み |
| Azure Entra ID | ⚠️ 推測 | ✅ RBAC Service | ✅ 実装済み |
| Azure OpenAI | ⚠️ 推測 | ⚠️ 暗黙的（LangGraph内） | ⚠️ 明示化検討 |

---

## 📊 統計

- **明示的に指定されたAzureサービス**: 7個
- **推測されるAzureサービス**: 6個
- **合計Azureサービス**: 13個
- **architecture-diagram.mdでの実装率**: 100% (13/13)

---

## 🎯 推奨事項

1. **Azure OpenAI の明示化検討**
   - 現在、LangGraph内で暗黙的に使用
   - C4 Diagramで明示的に表示するか検討

2. **OneLake vs Azure Blob の選択**
   - 現在、両方が併記されている（"Blob / OneLake"）
   - プロジェクト要件に応じてどちらか一方に統一を検討

3. **Azure Functions の明示化**
   - 仕様書に明示的記載がないが、実装済み
   - 仕様書の更新を検討

---

**作成者**: Claude Code
**最終更新**: 2026-04-26
