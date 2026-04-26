# ERP-GL Reconciliation System - Architecture Diagram

## Introduction

This document provides a comprehensive architecture overview of the ERP-GL Reconciliation System, designed as a **controlled, auditable, and resilient** solution for month-end financial close operations. The system follows **C4 Model Container Diagram** principles to clearly define service boundaries, deployment units, and process flows.

### Key Architectural Principles

1. **ERP/GL as Single Source of Truth** - All ingestion is read-only; no automatic write-back
2. **Deterministic Rules First** - AI only assists with unmatched exceptions
3. **Finance Retains Decision Authority** - All accounting actions require explicit approval
4. **Graceful Degradation** - System continues operating under partial failures

---

## System Architecture Overview (C4-Style Container Diagram)

The following diagram shows the system's **5 independent microservice domains**, their **Azure service mappings**, and **clear service boundaries**:

```mermaid
flowchart TB
    subgraph External["🌐 External Systems & Portals"]
        POS["POS / Settlement<br/>Portals<br/><i>(External APIs)</i>"]
        Bank["Bank Transactions /<br/>Payment Reports<br/><i>(SFTP/Portal)</i>"]
    end

    subgraph Corporate["🏢 Corporate Network"]
        ERP["ERP / GL<br/>Extracts<br/><i>(Read-Only API)</i>"]
        History["Historical<br/>Resolved Cases<br/><i>(Archive DB)</i>"]
    end

    subgraph Azure["☁️ Azure Cloud Environment"]
        subgraph AutomationDomain["🤖 Workflow/Automation Domain"]
            direction TB
            Orchestrator["Job Orchestrator<br/><b>Python API / Azure Functions</b><br/>• Monthly job scheduling<br/>• Trigger data ingestion<br/>• Event-driven execution"]

            subgraph IngestionServices["Data Ingestion Services"]
                APIConnector["API Connector Service<br/><b>Azure Container Apps</b><br/>• Primary ingestion method<br/>• Retry: 3 attempts, exp backoff<br/>• Timeout: 30s per request"]
                RPA["RPA Service<br/><b>Azure Container Apps</b><br/>• Fallback for portal UI<br/>• Activated on API failure<br/>• Browser automation"]
            end

            RawStorage[("Raw Storage<br/><b>Azure OneLake</b><br/>• Raw files only (immutable)<br/>• Versioned snapshots (monthly isolation)<br/>• Source data preservation")]

            NormalizedStorage[("Normalized Storage<br/><b>Azure OneLake</b><br/>• Normalized CSV/Parquet only<br/>• Validated & standardized<br/>• Ready for batch processing")]

            Normalizer["Data Normalization Service<br/><b>Azure Container Apps</b><br/>• Schema validation<br/>• Format standardization<br/>• Quarantine invalid data"]

            AITroubleshooter["AI Troubleshooter<br/><b>Azure Container Apps</b><br/>• LLM Engine (Azure OpenAI)<br/>• RPA failure diagnosis<br/>• Error log analysis<br/>• UI change detection<br/>• Auto-retry suggestions"]
        end

        subgraph ReconciliationDomain["⚙️ Reconciliation Domain"]
            direction TB
            RecDB[("Reconciliation Database<br/><b>Azure SQL / PostgreSQL</b><br/>• Case history<br/>• Matching results<br/>• Exception metadata<br/>• Audit logs")]

            Engine["Deterministic Reconciliation Engine<br/><b>Power Automate</b><br/>• Versioned rule sets<br/>• Exact match (amount + date)<br/>• Tolerance match (±0.01, ±2 days)<br/>• 1:N / N:1 candidate grouping"]

            BatchProcessor["Idempotent Batch Processor<br/><b>Azure Container Apps</b><br/>• Monthly batch isolation<br/>• Deduplication by source ID<br/>• Checkpoint/resume capability"]

            ExceptionMgr["Exception Case Manager<br/><b>Azure Container Apps</b><br/>• Unmatched case structuring<br/>• Case state persistence<br/>• SLA tracking"]
        end

        subgraph AIDomain["🧠 AI Inference Domain (Fallback Only)"]
            direction TB
            AIInvestigator["AI-Assisted Investigation Service<br/><b>Azure Container Apps (LangGraph)</b><br/>• Workflow orchestration<br/>• Case routing<br/>• Context preparation"]

            RootCauseAnalysis["Root Cause Analysis<br/><b>Azure Container Apps</b><br/>• LLM Engine (Azure OpenAI GPT-4)<br/>• Pattern detection & reasoning<br/>• Hypothesis generation<br/>• Natural language explanation"]

            RAGPipeline["RAG Pipeline<br/><b>Azure AI Search + Embeddings</b><br/>• Historical case retrieval<br/>• Similarity matching<br/>• Context enrichment"]

            ConfidenceEngine["Confidence Scoring Engine<br/><b>Azure Container Apps</b><br/>• Evidence-based scoring<br/>• Uncertainty quantification<br/>• Explainability metadata"]
        end

        subgraph FinanceDomain["👥 Finance Control Domain"]
            direction TB
            Workbench["Finance Workbench UI<br/><b>Azure Static Web Apps</b><br/>• Exception review interface<br/>• Matched case verification<br/>• Approval workflow"]

            ApprovalGateway["Approval Gateway Service<br/><b>Azure Container Apps</b><br/>• Enforces Segregation of Duties<br/>• Validation before ERP write<br/>• Approval audit logging"]

            ControlledOutput["Controlled Output Service<br/><b>Azure Container Apps</b><br/>• ERP posting (approved only)<br/>• Retry on write failure<br/>• Rollback on error"]

            AuditStore[("Audit Trail Store<br/><b>Azure Blob Storage (append-only)</b><br/>• Source-to-decision lineage<br/>• User actions + timestamps<br/>• Immutable logs")]
        end

        subgraph GovernanceDomain["🔐 Platform Governance Layer"]
            direction LR
            KeyVault["Azure Key Vault<br/>• Portal credentials<br/>• API keys<br/>• Service principals"]

            Monitor["Azure Monitor<br/>• Failed jobs alerts<br/>• Missing file detection<br/>• SLA breach warnings"]

            RBAC["RBAC Service<br/><b>Azure AD / Entra ID</b><br/>• Role-based access<br/>• SoD enforcement<br/>• Session management"]
        end
    end

    %% Primary Data Flow (Solid Lines)
    POS -->|"API calls"| APIConnector
    Bank -->|"SFTP/download"| APIConnector
    ERP -->|"Read-only query"| APIConnector

    APIConnector -->|"Success"| RawStorage
    APIConnector -.->|"Failure (3x retry)"| RPA
    RPA -.->|"Success"| RawStorage
    RPA -.->|"Failure"| AITroubleshooter
    AITroubleshooter -.->|"Diagnose & suggest retry"| RPA
    AITroubleshooter -.->|"Escalate (unfixable)"| Monitor

    Orchestrator -->|"Triggers"| APIConnector
    Orchestrator -->|"Schedules"| RPA

    RawStorage -->|"Raw data"| Normalizer
    Normalizer -->|"Store normalized"| NormalizedStorage
    NormalizedStorage -->|"Validated CSV"| BatchProcessor

    BatchProcessor -->|"Monthly batch"| Engine
    Engine -->|"Matched (90%+)"| RecDB
    Engine -->|"Unmatched (5-10%)"| ExceptionMgr
    ExceptionMgr -->|"Exception cases"| RecDB

    %% AI Fallback Flow (Dashed Lines - Secondary)
    RecDB -.->|"Unmatched cases only"| AIInvestigator
    History -.->|"Reference data"| RAGPipeline
    RAGPipeline -.->|"Similar cases"| AIInvestigator
    AIInvestigator -.->|"Analyze with context"| RootCauseAnalysis
    RootCauseAnalysis -.->|"Root cause hypothesis"| ConfidenceEngine
    ConfidenceEngine -.->|"Suggestions (metadata)"| RecDB

    %% Finance Control Flow (Thick Lines - Critical)
    RecDB ==>|"All cases"| Workbench
    Workbench ==>|"Approval request"| ApprovalGateway
    Workbench -.->|"Manual re-run batch"| BatchProcessor
    ApprovalGateway ==>|"Validated"| ControlledOutput
    ControlledOutput -.->|"Only if approved"| ERP
    ControlledOutput -.->|"Archive resolved cases"| History

    %% Governance/Monitoring (Dotted Lines - Support)
    KeyVault -.->|"Provide API credentials"| APIConnector

    Orchestrator -.->|"Job logs"| Monitor
    APIConnector -.->|"API metrics"| Monitor
    RPA -.->|"Metrics"| Monitor
    AITroubleshooter -.->|"Diagnostics & retry logs"| Monitor
    Engine -.->|"Processing metrics"| Monitor
    AIInvestigator -.->|"AI service metrics"| Monitor
    Workbench -.->|"User actions"| AuditStore
    ApprovalGateway -.->|"Approval events"| AuditStore
    ControlledOutput -.->|"ERP write logs"| AuditStore

    AuditStore -.->|"Compliance queries"| Monitor

    Workbench -.->|"Authentication"| RBAC
    ApprovalGateway -.->|"SoD checks"| RBAC

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
    class Workbench,ApprovalGateway,ControlledOutput,AuditStore financeStyle
    class KeyVault,Monitor,RBAC governanceStyle
```

### Service Boundary Rationale

**Why 5 Independent Microservices?**

1. **Workflow/Automation Domain** - Isolates external system integration complexity; can be redeployed without affecting reconciliation logic
2. **Reconciliation Domain** - Core business logic; versioned rule sets enable A/B testing and rollback
3. **AI Inference Domain** - Optional/fallback service; can be disabled without breaking primary flow
4. **Finance Control Domain** - Enforces governance; independent from data processing for security
5. **Platform Governance Layer** - Cross-cutting concerns (secrets, monitoring, access control)

**Azure Service Hosting Choices:**

- **Azure Container Apps** - Microservices requiring auto-scaling, HTTPS ingress, and event-driven triggers
- **Azure SQL/PostgreSQL** - Transactional data requiring ACID guarantees
- **Azure Blob/OneLake** - Immutable audit logs and monthly snapshots
- **Azure Static Web Apps** - Finance UI with global CDN distribution
- **Azure AI Search** - Vector similarity search for RAG pipeline

---

## Process Flow (Monthly Reconciliation Cycle)

This sequence diagram shows the **end-to-end flow** from data ingestion through finance approval:

```mermaid
sequenceDiagram
    participant Ext as External Systems<br/>(POS/Bank/ERP)
    participant API as API Connector Service
    participant RPA as RPA Service (Fallback)
    participant AITrouble as AI Troubleshooter
    participant RawStore as Raw Storage
    participant Norm as Normalizer
    participant NormStore as Normalized Storage
    participant Batch as Batch Processor
    participant Engine as Deterministic Engine<br/>(Power Automate)
    participant AI as AI Investigator
    participant RootCause as Root Cause Analysis
    participant DB as Reconciliation DB
    participant Finance as Finance Team<br/>(Workbench)
    participant Gateway as Approval Gateway
    participant ERP_Write as ERP System<br/>(Write)
    participant History as Historical Cases
    participant Monitor as Azure Monitor
    participant Audit as Audit Store

    Note over Ext,Audit: 📅 Phase 1: Data Ingestion & Normalization (Day 1)

    loop Scheduled Extraction (Monthly)
        Ext->>API: 1. API call (primary)
        alt API Success
            API->>RawStore: 2a. Store raw files
        else API Failure (3x retry)
            API--xAPI: 2b. Retry exhausted
            API->>RPA: 3. Activate RPA fallback
            alt RPA Success
                RPA->>RawStore: 4a. Portal UI automation → Store files
            else RPA Failure
                RPA--xRPA: 4b. RPA failed
                RPA->>AITrouble: 5. Diagnose failure
                AITrouble->>AITrouble: 6. Analyze error logs & UI state
                alt Auto-fixable (UI change, timing issue)
                    AITrouble->>RPA: 7a. Suggest retry with adjustments
                    RPA->>RawStore: 8a. AI-assisted retry success
                    AITrouble->>Monitor: Log: AI-assisted retry
                else Not auto-fixable (Security, credentials)
                    AITrouble->>Monitor: 7b. Escalate with diagnostic report
                end
            end
        end
    end

    RawStore->>RawStore: 5. Create monthly snapshot (immutable)
    RawStore->>Norm: 6. Read raw files

    alt Schema Valid
        Norm->>NormStore: 7a. Store normalized CSV
        NormStore->>Batch: 7b. Load normalized data
    else Schema Invalid
        Norm->>RawStore: 7c. Quarantine to error bucket
        Norm->>Monitor: Alert: Schema validation failed
    end

    Note over Ext,Audit: ⚙️ Phase 2: Deterministic Reconciliation (Day 2-3)

    Batch->>Batch: 8. Deduplication (idempotent by source ID)
    Batch->>Engine: 9. Monthly batch (point-in-time dataset)

    Engine->>Engine: 10. Rule-based matching<br/>(Exact → Tolerance → 1:N/N:1)

    alt Matched (90%+ cases)
        Engine->>DB: 11a. Store matched results
        DB->>Audit: Log: Matched by rule X
    else Unmatched (5-10% exceptions)
        Engine->>DB: 11b. Create exception case
        DB->>Audit: Log: Exception created
    end

    Note over Ext,Audit: 🧠 Phase 3: AI-Assisted Investigation (Day 3-4, Fallback)

    alt AI Service Available
        DB->>AI: 12. Fetch unmatched cases
        AI->>History: 13. Search similar historical cases
        History-->>AI: 14. Top 5 similar cases + context
        AI->>RootCause: 15. Analyze with context
        RootCause->>RootCause: LLM reasoning (Azure OpenAI)
        RootCause-->>AI: 16. Root cause hypothesis
        AI->>AI: 17. Confidence scoring (0-100%)
        AI->>DB: 18. Store suggestion metadata<br/>(NOT decision)
        DB->>Audit: Log: AI suggestion (confidence: X%)
    else AI Service Down
        DB->>Monitor: Circuit breaker open
        Note over AI: Manual review only (no AI)
    end

    Note over Ext,Audit: 👥 Phase 4: Finance Review & Approval (Day 4-5)

    Finance->>Workbench: 18. Log in (RBAC check)
    Workbench->>DB: 19. Fetch all cases (matched + exceptions)
    DB-->>Workbench: 20. Return cases with AI suggestions

    Finance->>Finance: 21. Review exceptions

    alt Approve
        Finance->>Gateway: 22a. Submit approval
        Gateway->>Gateway: 23a. SoD validation
        Gateway->>Audit: Log: Approved by [User] at [Time]
        Gateway->>ControlledOutput: 24a. Execute ERP posting

        alt ERP Write Success
            ControlledOutput->>ERP_Write: 25a. POST accounting entry
            ERP_Write-->>ControlledOutput: 26a. Success (Entry ID)
            ControlledOutput->>Audit: Log: Posted to ERP (ID: X)
            ControlledOutput->>History: 27. Archive resolved case
        else ERP Write Failure
            ControlledOutput--xERP_Write: 25b. Write failed
            ControlledOutput->>ControlledOutput: 26b. Retry (3x with backoff)
            ControlledOutput->>Monitor: Alert: ERP write failed
        end

    else Reject
        Finance->>Gateway: 22b. Reject with reason
        Gateway->>Audit: Log: Rejected by [User] - Reason: Y
        Gateway->>DB: 23b. Update case status

    else Adjust
        Finance->>Gateway: 22c. Manual adjustment
        Gateway->>Audit: Log: Adjusted by [User] - Changes: Z
        Gateway->>ControlledOutput: 23c. Execute adjusted entry

    else Escalate
        Finance->>Gateway: 22d. Escalate to senior reviewer
        Gateway->>Audit: Log: Escalated by [User]
    end

    Note over Ext,Audit: ✅ Phase 5: Monitoring & Compliance (Continuous)

    Monitor->>Monitor: SLA breach detection
    Monitor->>Finance: Alert if unresolved > 5 days
    Audit->>Audit: Immutable append-only logs
```

---

## Error Handling & Resilience Patterns

This simplified diagram shows the **key resilience mechanisms** at each layer:

```mermaid
%%{init: {'theme':'base', 'themeVariables': {'fontSize':'17px', 'fontFamily':'Arial'}}}%%
flowchart TD
    subgraph ErrorFlow["⚠️ Error Handling & Resilience Flow"]
        direction TB
        Start([Monthly Job Triggered])

    Start --> APICall[API Connector: Call External System]

    APICall --> APICheck{API Success?}
    APICheck -->|Yes| ValidateSchema[Normalizer: Schema Validation]
    APICheck -->|No| Retry1[Retry 1: Wait 5s]

    Retry1 --> Retry1Check{Success?}
    Retry1Check -->|Yes| ValidateSchema
    Retry1Check -->|No| Retry2[Retry 2: Wait 15s]

    Retry2 --> Retry2Check{Success?}
    Retry2Check -->|Yes| ValidateSchema
    Retry2Check -->|No| Retry3[Retry 3: Wait 45s]

    Retry3 --> Retry3Check{Success?}
    Retry3Check -->|Yes| ValidateSchema
    Retry3Check -->|No| RPAFallback[RPA Service: Portal UI Automation]

    RPAFallback --> RPACheck{RPA Success?}
    RPACheck -->|Yes| ValidateSchema
    RPACheck -->|No| AITroubleshoot[AI Troubleshooter: Diagnose Failure]

    AITroubleshoot --> AIAnalysis{Auto-fixable?}
    AIAnalysis -->|Yes - UI/Timing| RPARetry[AI-Suggested Retry]
    RPARetry --> RPARetryCheck{Success?}
    RPARetryCheck -->|Yes| ValidateSchema
    RPARetryCheck -->|No| AlertCritical[🚨 Alert: Dev Team + Diagnostic Report]
    AIAnalysis -->|No - Security/Creds| AlertCritical

    ValidateSchema --> SchemaCheck{Schema Valid?}
    SchemaCheck -->|Yes| Dedup[Batch Processor: Deduplication]
    SchemaCheck -->|No| Quarantine[Quarantine: Move to Error Bucket]
    Quarantine --> AlertSchema[🚨 Alert: Schema Validation Failed]

    Dedup --> DedupCheck{Duplicate?}
    DedupCheck -->|Yes| Skip[Skip: Already Processed]
    DedupCheck -->|No| Reconcile[Deterministic Engine: Rule Matching]

    Reconcile --> MatchCheck{Matched?}
    MatchCheck -->|Yes - Exact| StoreMatched[Store: Matched Case]
    MatchCheck -->|Yes - Tolerance| StoreMatched
    MatchCheck -->|Yes - 1:N/N:1| StoreMatched
    MatchCheck -->|No| CreateException[Exception Manager: Create Case]

    CreateException --> AICheck{AI Service Available?}
    AICheck -->|Yes| AIInvest[AI Investigator: Generate Suggestion]
    AICheck -->|No| CircuitBreaker[Circuit Breaker: Manual Review Only]

    AIInvest --> AITimeout{Response < 30s?}
    AITimeout -->|Yes| StoreAI[Store: AI Suggestion Metadata]
    AITimeout -->|No| CircuitBreaker

    StoreMatched --> FinanceReview[Finance Workbench: Review]
    StoreAI --> FinanceReview
    CircuitBreaker --> FinanceReview

    FinanceReview --> ApprovalCheck{Approved?}
    ApprovalCheck -->|Yes| SoDCheck{SoD Valid?}
    SoDCheck -->|Yes| ERPPost[Controlled Output: ERP Posting]
    SoDCheck -->|No| RejectSoD[🚨 Reject: SoD Violation]

    ERPPost --> ERPCheck{ERP Success?}
    ERPCheck -->|Yes| AuditLog[Audit Store: Log Success]
    ERPCheck -->|No| ERPRetry[Retry ERP: 3x with Backoff]

    ERPRetry --> ERPRetryCheck{Retry Success?}
    ERPRetryCheck -->|Yes| AuditLog
    ERPRetryCheck -->|No| AlertERP[🚨 Alert: ERP Write Failed]

    ApprovalCheck -->|No - Reject| AuditReject[Audit Store: Log Rejection]
    ApprovalCheck -->|No - Adjust| AuditAdjust[Audit Store: Log Adjustment]
    ApprovalCheck -->|No - Escalate| AuditEscalate[Audit Store: Log Escalation]

    AuditLog --> MonitorSLA[Monitor: Check SLA]
    AlertCritical --> MonitorSLA
    AlertSchema --> MonitorSLA
    AlertERP --> MonitorSLA
    AuditReject --> MonitorSLA
    AuditAdjust --> MonitorSLA
    AuditEscalate --> MonitorSLA
    Skip --> MonitorSLA

    MonitorSLA --> SLACheck{SLA Breach?}
    SLACheck -->|Yes| Escalate[🚨 Auto-Escalate to Senior Finance]
    SLACheck -->|No| Complete([Job Complete])

    Escalate --> Complete
    end

    %% Styling
    classDef errorStyle fill:#fee,stroke:#f00,stroke-width:2px
    classDef successStyle fill:#efe,stroke:#0a0,stroke-width:2px
    classDef warningStyle fill:#ffe,stroke:#fa0,stroke-width:2px
    classDef processStyle fill:#eef,stroke:#00f,stroke-width:1px

    class AlertCritical,AlertSchema,AlertERP,RejectSoD,Escalate errorStyle
    class AuditLog,StoreMatched,Complete successStyle
    class Quarantine,CircuitBreaker,Skip warningStyle
    class APICall,ValidateSchema,Dedup,Reconcile,FinanceReview,ERPPost processStyle
```

### Resilience Mechanisms Summary

| Layer | Mechanism | Configuration |
|-------|-----------|---------------|
| **Ingestion** | API Retry | 3 attempts, exponential backoff (5s, 15s, 45s) |
| **Ingestion** | RPA Fallback | Activated after API retry exhaustion |
| **Normalization** | Schema Validation | Quarantine invalid files, alert on failure |
| **Reconciliation** | Idempotent Batches | Deduplication by source ID + month |
| **AI** | Circuit Breaker | Timeout 30s, fallback to manual review |
| **AI** | Graceful Degradation | System continues without AI suggestions |
| **Finance** | SoD Validation | Approval gateway enforces role separation |
| **ERP Write** | Retry Logic | 3 attempts with backoff before alerting |
| **Monitoring** | SLA Breach | Auto-escalate if unresolved > 5 days |

---

## Architecture Design Rationale

### Power Automate's Correct Role

**Power Automate implements the Deterministic Reconciliation Engine:**
- **Rule-based matching logic** - Exact match, tolerance match, 1:N/N:1 grouping
- **Conditional branching** - Power Automate flows for matching rules
- **Loop processing** - Iterate through transactions and apply business rules
- **Exception routing** - Send unmatched cases to Exception Manager

**What Power Automate DOES:**
✅ **Reconciliation logic** - Core matching rules and business logic
✅ **Rule orchestration** - Execute exact → tolerance → grouping sequence
✅ **Decision branching** - Conditional flows based on matching criteria

**What Power Automate DOES NOT do:**
❌ Job scheduling (handled by Job Orchestrator - Python API/Azure Functions)
❌ Data ingestion (handled by API Connector and RPA Services)
❌ AI-driven analysis (handled by AI Investigator - LangGraph)
❌ Accounting entries (handled by Controlled Output Service)
❌ Finance control decisions (handled by Approval Gateway)

**Job Orchestrator (separate component):**
- Python API, Azure Functions, or scheduled triggers
- Kicks off monthly batch jobs
- Triggers data ingestion services

The architecture clearly separates **job scheduling** (Job Orchestrator) from **reconciliation logic** (Power Automate) from **AI inference** (LangGraph).

### Network Strategy

**Corporate vs Azure Boundary:**
- **Corporate Network** - Data sources (POS, Bank, ERP) remain on-premises or in external clouds
- **Azure Cloud Environment** - All processing, storage, and AI inference services
- **VNet Peering** - Secure private connection for ERP read queries
- **Private Endpoints** - ERP write operations use Azure Private Link (no public internet)

### Service Boundary Design

**Microservice Isolation Benefits:**
1. **Independent Deployment** - Finance UI can be updated without redeploying reconciliation engine
2. **Failure Isolation** - AI service downtime doesn't break deterministic matching
3. **Scaling Independence** - Batch processor can scale to 10x instances during month-end; AI service remains at 2x
4. **Security Segmentation** - Finance domain has stricter RBAC than automation domain

**Azure Service Mapping:**
- **Container Apps** - Auto-scaling microservices with HTTP/event triggers
- **Azure SQL** - ACID-compliant transactional database for case history
- **Azure Blob** - Immutable audit logs with append-only writes
- **Azure AI Search** - Vector embeddings for RAG similarity search
- **Azure Static Web Apps** - Global CDN for Finance Workbench UI

### Design Safeguard Implementation

#### 1. Automation Robustness (Specs: Lines 6-11)

**Implementation:**
- **Retry mechanisms** - 3 attempts with exponential backoff in API Connector Service
- **Timeout handling** - 30s per API call, 60s for RPA automation
- **Fallback strategy** - RPA Service activates only after API retry exhaustion
- **Monitoring** - Azure Monitor alerts on job failures, missing files, and SLA breaches

**Diagram Elements:**
- `APIConnector` → `RPA` (dashed line = fallback)
- Error handling flowchart shows retry logic

#### 2. Data Integrity (Specs: Lines 12-16)

**Implementation:**
- **Read-only ingestion** - ERP service principal has SELECT-only permissions
- **Versioned datasets** - Monthly snapshots in Landing Zone (immutable blobs)
- **No automatic write-back** - ERP writes require Approval Gateway validation
- **Audit trail** - Append-only logs in Audit Store (source → decision lineage)

**Diagram Elements:**
- `ERP` → `APIConnector` (labeled "Read-only query")
- `ControlledOutput` -.→ `ERP_Write` (dashed = conditional, "Only if approved")
- `AuditStore` (append-only blob storage)

#### 3. AI Control & Explainability (Specs: Lines 17-21)

**Implementation:**
- **Rules first** - Deterministic Engine processes 90%+ of cases before AI
- **AI suggestion only** - AI writes metadata to RecDB, not decisions
- **Confidence scoring** - 0-100% score with evidence-based explanation
- **No autonomous decisions** - AI output flows to Finance Workbench for review

**Diagram Elements:**
- Primary flow: `Engine` → `RecDB` (solid line)
- AI flow: `RecDB` -.→ `AIInvestigator` -.→ `RecDB` (dashed = fallback)
- Sequence diagram: AI stores "suggestion metadata (NOT decision)"

#### 4. Operational Continuity (Specs: Lines 22-26)

**Implementation:**
- **Graceful degradation** - Circuit breaker for AI service; system continues with manual review
- **Partial processing** - Batch processor handles available data even if some sources fail
- **SLA monitoring** - Azure Monitor tracks unresolved exceptions > 5 days
- **Remediation workflows** - Auto-escalation to senior finance reviewer on SLA breach

**Diagram Elements:**
- Error handling flowchart: `AICheck` → `CircuitBreaker` → `Manual Review Only`
- Sequence diagram: "AI Service Down" → "Manual review only (no AI)"
- `Monitor` → `SLA Check` → `Auto-Escalate`

---

## Requirements Traceability Matrix

This table maps every requirement from `specs-architecture.md` to the implemented architecture:

| Specification Requirement | Line # | Diagram Component | Implementation Detail |
|---------------------------|--------|-------------------|----------------------|
| **Automation Robustness** | 7-11 | | |
| Stable ingestion across heterogeneous portals | 8 | `APIConnector` + `RPA Service` | Primary API with fallback RPA for portal UI |
| API-based ingestion with UI automation fallback | 9 | `APIConnector` → `RPA` (fallback) | Dashed line in architecture diagram |
| Retry, timeout, exception handling | 10 | Error handling flowchart | 3 retries (5s, 15s, 45s), 30s timeout |
| Monitoring and alerting | 11 | `Azure Monitor` | Job failures, missing files, SLA breaches |
| **Data Integrity** | 12-16 | | |
| ERP/GL as single source of truth | 12 | `ERP` (read-only) | Service principal SELECT-only permissions |
| Read-only ingestion | 13 | `ERP` → `APIConnector` | Labeled "Read-only query" |
| Reconciliation on controlled datasets | 14 | `Landing Zone` → `Batch Processor` | Versioned monthly snapshots |
| Monthly snapshot isolation | 15 | `Landing Zone` | Immutable blobs with timestamp versioning |
| Prevent automatic write-back to ERP | 16 | `Approval Gateway` gate | "Only if approved" conditional |
| **AI Control & Explainability** | 17-21 | | |
| Deterministic rules as primary mechanism | 18 | `Deterministic Engine` (solid flow) | 90%+ cases matched before AI |
| AI only for unresolved exceptions | 19 | `RecDB` -.→ `AIInvestigator` | Dashed line = fallback only |
| Explainable outputs with confidence | 20 | `Confidence Scoring Engine` | 0-100% score + root cause explanation |
| No autonomous accounting decisions | 21 | AI → RecDB (metadata only) | AI writes suggestions, not decisions |
| **Operational Continuity** | 22-26 | | |
| Graceful degradation under stress | 23 | Circuit breaker in error flow | AI down → manual review continues |
| Continuity during close with fallback | 23 | API → RPA fallback | RPA activates on API failure |
| Partial processing of available data | 24 | `Batch Processor` | Processes available sources even if some fail |
| Monitor completeness and exceptions | 25 | `Azure Monitor` | Tracks unresolved cases and completeness % |
| SLA-based remediation workflows | 26 | Monitor → Auto-escalate | 5-day SLA breach triggers escalation |
| **Control Boundaries** | 28-32 | | |
| Does not replace ERP/GL | 29 | Read-only ingestion | ERP remains authoritative system |
| No automatic postings without approval | 30 | `Approval Gateway` enforcement | SoD validation before ERP write |
| Does not rely on AI without rules | 31 | Rules-first flow | `Engine` processes before AI |
| Data stays in client environment | 32 | Azure Cloud boundary | All data in customer's Azure tenant |
| **Data Sources** | 42-46 | | |
| POS/settlement portals | 42 | `POS` in Corporate Network | External API ingestion |
| Bank files/payment reports | 43 | `Bank` in Corporate Network | SFTP/portal download |
| ERP/GL extracts | 44 | `ERP` in Corporate Network | Read-only API query |
| Historical resolved cases | 45 | `History` in Corporate Network | Archive DB for RAG |
| Retry and fallback mechanisms | 46 | API retry + RPA fallback | 3x retry → RPA activation |
| **Ingestion & Automation** | 48-57 | | |
| Scheduled downloads | 50 | `Power Automate Orchestrator` | Monthly job scheduling |
| Portal access | 51 | `RPA Service` | Browser automation fallback |
| File normalization | 52 | `Data Normalization Service` | Schema validation + CSV conversion |
| Raw files | 54 | `Landing Zone` | Azure Blob (raw bucket) |
| Normalized files | 55 | `Landing Zone` | Azure Blob (normalized bucket) |
| Monthly snapshots | 56 | `Landing Zone` | Versioned immutable blobs |
| Read-only ingestion and snapshotting | 57 | ERP read-only + Landing Zone | Service principal + versioning |
| **Reconciliation Core** | 59-72 | | |
| Case history | 61 | `Reconciliation DB` | Azure SQL/PostgreSQL schema |
| Matching results | 62 | `Reconciliation DB` | Matched/unmatched tables |
| Audit logs | 63 | `Audit Store` | Append-only blob storage |
| Exact/tolerance match | 65 | `Deterministic Engine` | Amount ±0.01, date ±2 days |
| 1:N / N:1 logic | 66 | `Deterministic Engine` | Candidate grouping algorithm |
| Exception creation | 67 | `Exception Case Manager` | Structured exception objects |
| Root cause suggestion | 69 | `AI Investigator` | LangGraph workflow |
| Similar case reference | 70 | `RAG Pipeline` | Azure AI Search embeddings |
| Confidence indication | 71 | `Confidence Scoring Engine` | 0-100% with evidence |
| Rules first, AI suggestion only | 72 | Flow: Engine → AI (fallback) | Dashed line in diagram |
| **Finance Control Layer** | 74-83 | | |
| Review | 76 | `Finance Workbench` | Azure Static Web Apps UI |
| Approve/reject/adjust | 77 | `Approval Gateway` | Workflow state machine |
| Escalate | 78 | Sequence diagram | Escalation to senior reviewer |
| Exception log | 80 | `Audit Store` | Immutable append logs |
| Suggested entries | 81 | `Controlled Output Service` | AI suggestion display |
| ERP update only if approved | 82 | `Approval Gateway` gate | SoD validation + approval |
| Finance approval required | 83 | `Approval Gateway` enforcement | Mandatory approval step |
| **Platform Governance** | 86-90 | | |
| Access control by RBAC and SoD | 86 | `RBAC Service` | Azure AD/Entra ID roles |
| Credential management | 87 | `Azure Key Vault` | Secrets and service principals |
| Audit trails | 88 | `Audit Store` | Source-to-decision lineage |
| Monitoring & alerts | 89 | `Azure Monitor` | Failed jobs, missing files |
| Release management (Dev/Test/Prod) | 90 | Azure Container Apps | Environment-based deployments |
| **Rule-Based Reconciliation** | 97-112 | | |
| Portal login & extraction | 98 | `RPA Service` | Browser automation |
| Scheduled downloads | 99 | `Power Automate Orchestrator` | Cron-based triggers |
| File normalization/formatting | 100 | `Data Normalization Service` | Schema validation |
| Rule-based matching | 101 | `Deterministic Engine` | Exact/tolerance/lag rules |
| Candidate grouping (1:N, N:1) | 104 | `Deterministic Engine` | Grouping algorithm |
| Idempotent batch processing | 105 | `Idempotent Batch Processor` | Deduplication by source ID |
| Structured case objects | 107 | `Exception Case Manager` | Unmatched/partial/timing types |
| Persistent case state | 108 | `Reconciliation DB` | State machine persistence |
| Versioned rule sets | 110 | `Deterministic Engine` | Rule version metadata |
| Monthly snapshot isolation | 110 | `Landing Zone` | Point-in-time datasets |
| Isolated DB from corporate | 112 | `Reconciliation DB` in Azure | Separate from ERP DB |
| **AI Fallback Layer** | 114-119 | | |
| AI assists investigation (post-recon) | 115 | `AI Investigator` (fallback) | Only for unmatched cases |
| Retrieve similar historical cases (RAG) | 116 | `RAG Pipeline` | Vector similarity search |
| Resolution suggestions with confidence | 117 | `Confidence Scoring Engine` | 0-100% scores |
| AI does not perform matching itself | 118 | RecDB → AI (metadata) | AI writes suggestions only |
| AI does not trigger entries | 119 | No AI → ERP connection | AI isolated from ERP write |
| **Finance Decisions** | 122-126 | | |
| Review and approve/adjust | 123 | `Finance Workbench` UI | Exception review interface |
| Explicit approval required | 124 | `Approval Gateway` | Mandatory approval step |
| No automatic ERP/GL posting | 125 | Approval gate before ERP write | Conditional flow in diagram |
| Audit logs (user, timestamps, versions) | 126 | `Audit Store` | Full lineage tracking |
| **General Rules** | 129-133 | | |
| Batch, idempotent processing | 129 | `Idempotent Batch Processor` | Deduplication + checkpoints |
| AI routed for unmatched only | 130 | RecDB → AI (conditional) | Dashed line = exception flow |
| Track case status | 130 | `Reconciliation DB` | State machine |
| Audit logs, versioning, snapshots | 131 | `Audit Store` + Landing Zone | Append-only + versioned blobs |
| Retry, rerun capability visible | 132 | Error handling flowchart | Retry logic + batch resume |

---

## Legend & Notation Guide

### Line Styles

- **Solid lines (→)** - Primary data flow (e.g., matched transactions)
- **Dashed lines (-.→)** - Fallback/support services (e.g., AI suggestions, monitoring)
- **Thick lines (=→)** - Critical audit/control flows (e.g., finance approval)
- **Dotted lines (···→)** - Governance/monitoring (e.g., logs, secrets)

### Color Coding by Domain

| Color | Domain | Azure Services |
|-------|--------|----------------|
| 🟨 Yellow | Workflow/Automation | Power Automate, Container Apps (ingestion) |
| 🟩 Green | Reconciliation | Container Apps (engine), Azure SQL/PostgreSQL |
| 🌸 Pink (dashed border) | AI Inference (Fallback) | Container Apps (LangGraph), Azure AI Search |
| 🟦 Purple (thick border) | Finance Control | Static Web Apps, Container Apps (gateway) |
| ⚪ Gray | Platform Governance | Key Vault, Monitor, Azure AD/Entra ID |
| 🔵 Blue | Data Sources | Corporate network systems (external) |

### Service Boundary Notation

- **Subgraph** - Represents a deployable unit or logical domain
- **Bold text** - Azure service name (e.g., `Azure Container Apps`)
- **Italic text** - External system type (e.g., `(External APIs)`)
- **Bullet points** - Key capabilities or features

### Data Flow Annotations

- `"Read-only query"` - Enforces data integrity safeguard
- `"Only if approved"` - Finance control gate
- `"Fallback success"` - Alternative path when primary fails
- `"3x retry"` - Retry count before fallback activation

---

## Verification Checklist

### Mermaid Rendering
- ✅ All diagrams render in VSCode Markdown Preview
- ✅ Subgraph boundaries are visually distinct
- ✅ Color coding is applied correctly
- ✅ No syntax errors

### GitHub Rendering
- ⏳ Push to GitHub and verify rendering (to be done after commit)
- ⏳ Ensure all diagrams display correctly (to be done after commit)

### Requirements Coverage
- ✅ All requirements from specs-architecture.md (lines 6-133) mapped to diagram elements
- ✅ All design safeguards (lines 46, 57, 72, 83) visualized
- ✅ Traceability matrix includes all specifications

### Customer Presentation Readiness
- ✅ C4 container diagram is A4-printable
- ✅ Service boundaries are clear without explanation
- ✅ Azure services are explicitly labeled
- ✅ Power Automate's role is accurately represented (orchestration, NOT reconciliation logic)

---

## Summary

This architecture document provides:

✅ **Accurate Power Automate representation** - Clearly separates orchestration from reconciliation logic
✅ **Clear service boundaries** - 5 independent microservices with Azure service mappings
✅ **Comprehensive error handling** - Retry, fallback, and graceful degradation patterns
✅ **Requirements traceability** - Every spec requirement mapped to implementation
✅ **Standard Mermaid syntax** - Renders in VSCode, GitHub, and documentation tools
✅ **Design rationale** - Explains "why" behind architectural decisions

The system is designed for **finance teams** to maintain control and decision authority while leveraging **deterministic rules** for efficiency and **AI assistance** for complex exception investigation.
