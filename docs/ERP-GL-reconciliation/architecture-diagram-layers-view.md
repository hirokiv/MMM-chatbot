# ERP-GL Reconciliation System - Architecture Diagram (Layers View)

**レイアウト**: レイヤー構造を縦並びに配置

---

## System Architecture Overview (Layers View)

```mermaid
%%{init: {'theme':'base', 'themeVariables': {'fontSize':'18px', 'fontFamily':'Arial'}}}%%
flowchart TD
    subgraph Layer1["📍 LAYER 1: Data Source Layer (Corporate Network)"]
        direction LR
        subgraph External["🌐 External Systems"]
            POS["<b>POS / Settlement</b><br/>External APIs"]
            Bank["<b>Bank Transactions</b><br/>SFTP/Portal"]
        end

        subgraph Corporate["🏢 Corporate Network"]
            ERP["<b>ERP / GL</b><br/>Read-Only"]
            History["<b>Historical Cases</b><br/>Archive"]
        end
    end

    subgraph Layer2["📍 LAYER 2: Ingestion & Automation Layer (Azure)"]
        direction TB
        subgraph AutomationDomain["🤖 Automation Domain"]
            direction TB
            Orchestrator["<b>Job Orchestrator</b><br/>⚡ <b>Azure Functions</b><br/>Monthly scheduling"]

            subgraph IngestionServices["Data Ingestion"]
                APIConnector["<b>API Connector</b><br/>📦 <b>Container Apps</b><br/>API + Retry"]
                RPA["<b>RPA Service</b><br/>📦 <b>Container Apps</b><br/>Portal Fallback"]
            end

            RawStorage[("<b>Raw Storage</b><br/>💾 <b>Azure OneLake</b><br/>Raw files only<br/>Versioned snapshots (monthly isolation)")]

            NormalizedStorage[("<b>Normalized Storage</b><br/>💾 <b>Azure OneLake</b><br/>Normalized files only<br/>Validated & standardized")]

            Normalizer["<b>Normalizer</b><br/>📦 <b>Container Apps</b><br/>Validation"]

            AITroubleshooter["<b>AI Troubleshooter</b><br/>📦 <b>Container Apps</b><br/>LLM Engine (Azure OpenAI)<br/>Diagnostic analysis"]
        end
    end

    subgraph Layer3["📍 LAYER 3: Reconciliation Core Layer (Azure)"]
        direction TB
        subgraph ReconciliationDomain["⚙️ Reconciliation Domain"]
            direction TB
            RecDB[("<b>Recon DB</b><br/>🗄️ <b>Azure SQL</b><br/>Case history")]

            Engine["<b>Deterministic Engine</b><br/>🔄 <b>Power Automate</b><br/>Versioned rule sets"]

            BatchProcessor["<b>Batch Processor</b><br/>📦 <b>Container Apps</b><br/>Idempotent"]

            ExceptionMgr["<b>Exception Manager</b><br/>📦 <b>Container Apps</b><br/>Unmatched cases"]
        end
    end

    subgraph Layer3b["📍 LAYER 3b: AI Investigation Layer (Azure - Fallback)"]
        direction TB
        subgraph AIDomain["🧠 AI Domain (Fallback)"]
            direction TB
            AIInvestigator["<b>AI Investigator</b><br/>📦 <b>Container Apps</b><br/>LangGraph orchestration"]

            RootCauseAnalysis["<b>Root Cause Analysis</b><br/>📦 <b>Container Apps</b><br/>LLM Engine (Azure OpenAI)<br/>Pattern detection"]

            RAGPipeline["<b>RAG Pipeline</b><br/>🔍 <b>Azure AI Search</b><br/>Similar cases"]

            ConfidenceEngine["<b>Confidence Scorer</b><br/>📦 <b>Container Apps</b><br/>0-100%"]
        end
    end

    subgraph Layer4["📍 LAYER 4: Finance Control Layer (Azure)"]
        direction TB
        subgraph FinanceDomain["👥 Finance Domain"]
            direction TB
            Workbench["<b>Finance Workbench</b><br/>🌐 <b>Static Web Apps</b><br/>Review & Approve"]

            RerunOptions["<b>Re-run Options</b><br/>📦 <b>Container Apps</b><br/>Full / Partial re-run"]

            ApprovalGateway["<b>Approval Gateway</b><br/>📦 <b>Container Apps</b><br/>SoD enforcement"]

            ControlledOutput["<b>Controlled Output</b><br/>📦 <b>Container Apps</b><br/>ERP posting"]

            AuditStore[("<b>Audit Store</b><br/>💾 <b>Azure Blob Storage</b><br/>Append-only")]
        end
    end

    subgraph Governance["📍 CROSS-CUTTING: Platform Governance (Azure)"]
        direction LR
        subgraph GovernanceDomain["🔐 Governance"]
            direction LR
            KeyVault["🔑 <b>Azure Key Vault</b><br/>Secrets"]

            Monitor["📊 <b>Azure Monitor</b><br/>Alerts & Logs"]

            RBAC["👤 <b>Entra ID</b><br/>RBAC & SoD"]
        end
    end

    %% Primary Data Flow
    POS -->|"<b>API</b>"| APIConnector
    Bank -->|"<b>SFTP</b>"| APIConnector
    ERP -->|"<b>Read-only</b>"| APIConnector

    APIConnector -->|"<b>Success</b>"| RawStorage
    APIConnector -.->|"<b>Fail → Retry</b>"| RPA
    RPA -.->|"<b>Success</b>"| RawStorage
    RPA -.->|"<b>Failure</b>"| AITroubleshooter
    AITroubleshooter -.->|"<b>Diagnose & suggest retry</b>"| RPA
    AITroubleshooter -.->|"<b>Escalate (if unfixable)</b>"| Monitor

    Orchestrator -->|"<b>Trigger</b>"| APIConnector
    Orchestrator -->|"<b>Schedule</b>"| RPA

    RawStorage -->|"<b>Raw files</b>"| Normalizer
    Normalizer -->|"<b>Store normalized</b>"| NormalizedStorage
    NormalizedStorage -->|"<b>Validated CSV</b>"| BatchProcessor

    BatchProcessor -->|"<b>Batch</b>"| Engine
    Engine -->|"<b>Matched 90%</b>"| RecDB
    Engine -->|"<b>Unmatched 10%</b>"| ExceptionMgr
    ExceptionMgr -->|"<b>Exceptions</b>"| RecDB

    %% AI Fallback Flow
    RecDB -.->|"<b>Unmatched Only</b>"| AIInvestigator
    History -.->|"<b>Reference</b>"| RAGPipeline
    RAGPipeline -.->|"<b>Similar</b>"| AIInvestigator
    AIInvestigator -.->|"<b>Analyze</b>"| RootCauseAnalysis
    RootCauseAnalysis -.->|"<b>Root cause</b>"| ConfidenceEngine
    ConfidenceEngine -.->|"<b>Suggest</b>"| RecDB

    %% Finance Control Flow
    RecDB ==>|"<b>All Cases</b>"| Workbench
    Workbench ==>|"<b>Request</b>"| ApprovalGateway
    Workbench -.->|"<b>Re-run request</b>"| RerunOptions
    RerunOptions -.->|"<b>Full re-run<br/>(from ingestion)</b>"| Orchestrator
    RerunOptions -.->|"<b>Reconciliation only</b>"| BatchProcessor
    ApprovalGateway ==>|"<b>Approved</b>"| ControlledOutput
    ControlledOutput -.->|"<b>If Approved</b>"| ERP
    ControlledOutput -.->|"<b>Archive Resolved</b>"| History

    %% Governance/Monitoring
    KeyVault -.->|"<b>API Creds</b>"| APIConnector

    Orchestrator -.->|"<b>Logs</b>"| Monitor
    APIConnector -.->|"<b>Metrics</b>"| Monitor
    RPA -.->|"<b>Metrics</b>"| Monitor
    AITroubleshooter -.->|"<b>Diagnostics & retry logs</b>"| Monitor
    Engine -.->|"<b>Metrics</b>"| Monitor
    AIInvestigator -.->|"<b>Metrics</b>"| Monitor
    Workbench -.->|"<b>Actions</b>"| AuditStore
    RerunOptions -.->|"<b>Re-run decisions</b>"| AuditStore
    ApprovalGateway -.->|"<b>Events</b>"| AuditStore
    ControlledOutput -.->|"<b>Logs</b>"| AuditStore

    AuditStore -.->|"<b>Query</b>"| Monitor

    Workbench -.->|"<b>Auth</b>"| RBAC
    ApprovalGateway -.->|"<b>SoD</b>"| RBAC

    %% Styling by Domain
    classDef sourceStyle fill:#e1f5ff,stroke:#0078d4,stroke-width:2px,color:#000
    classDef automationStyle fill:#fff4ce,stroke:#f7b500,stroke-width:2px,color:#000
    classDef reconcileStyle fill:#d5f4e6,stroke:#10a37f,stroke-width:2px,color:#000
    classDef aiStyle fill:#ffe0f0,stroke:#d946ef,stroke-width:2px,stroke-dasharray: 5 5,color:#000
    classDef financeStyle fill:#e0e7ff,stroke:#6366f1,stroke-width:3px,color:#000
    classDef governanceStyle fill:#f3f4f6,stroke:#6b7280,stroke-width:2px,color:#000

    class POS,Bank,ERP,History sourceStyle
    class Orchestrator,APIConnector,RPA,RawStorage,NormalizedStorage,Normalizer,AITroubleshooter automationStyle
    class RecDB,Engine,BatchProcessor,ExceptionMgr reconcileStyle
    class AIInvestigator,RootCauseAnalysis,RAGPipeline,ConfidenceEngine aiStyle
    class Workbench,RerunOptions,ApprovalGateway,ControlledOutput,AuditStore financeStyle
    class KeyVault,Monitor,RBAC governanceStyle
```

**レイアウトの特徴**:
- ✅ レイヤーが縦に明確に分離
- ✅ データフローが上から下へ流れる
- ✅ 各レイヤーに「📍 LAYER X:」ラベル付き
- ✅ Governanceは横断的に配置
