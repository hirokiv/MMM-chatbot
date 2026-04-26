I have a system to develop with the folllowing design specs. 
I would like to summarize the architecture flow of each service/container using markdown. 
Make the workflow as abstract as possible when writing to markdown
Please also design the boundaries between corporate network, Azure services (Azure Container Aps, Azure SQL/PostgreSQL/One Lake, Azure Monitor, LangGraph service in Azure environment, Azure Key Vault, Azure Static Web Apps)

## The system must be constructed such that following reliability is controlled
1. Automation robustness: Automation issues impact efficency, not process continuity
- ensure stable ingestion across heterogeneous external poratals, 
- Combine API-based ingestion with controled UI automation fallback
- implement retry, timeout and exception handling mechanisms
- prvide monitoring and alerting 
2. Data integrity : ERP / GL remains the single source of truth
- preserve source system integrity through read-only ingestion
- perform reconciliation on controlled and versioned datasets
- maintain monthly snapshot isolation for auditability 
- prevent automatic write-back to ERP / GL systems
3. AI control & Explainability: AI supports analysis: finance team retains decision authority
- Apply deterministic rules as the primary reconcilation mechanism
- Use AI for two controlled purposes:
  (a) Ingestion troubleshooting: Diagnose RPA failures and suggest fixes (limited auto-retry)
  (b) Reconciliation investigation: Support unresolved exception investigation
- Provide explainable outputs with root cause and confidence
- Ensure no autonomous accounting decisions or systems overrides
- AI-driven ingestion retries are logged and limited to safe operations only
4. Operational continuity : Designed for graceful degradation under operational stress
- Ensure continuity during close through controlled fallback options
- Allow partial processing of available data
- Monitor completeness and unresolved exceptions
- Define SLA-based remediation workflows

## Control boundaries:
- Does not replace ERP / GL systems
- Does not automate accounting postings without approvals
- Does not rely on AI without deterministic rules (for reconciliation)
- Does not move or store data outside client controlled environment
- AI troubleshooting does not bypass security controls (e.g., no CAPTCHA breaking, no credential manipulation)
- AI-suggested ingestion retries require audit logging and are limited to UI navigation adjustments only

## Overall layer structure
we will have 4 main layers
Data source layer 
Automation layer
Reconcillation layer (include AI Layer when fallback)
Finance controlled layer

### Data source systems
POS / settlement portals
Bank files / Payment reports
ERP / GL extracts
Hisotrical resolved cases
* Design safeguard: retry and fallback mechanisms

### Ingestion & Automation
Power Automate / RPA
- scheduled ownloads
- Portal access
- file normalization
AI-assisted troubleshooting (fallback for RPA failures)
- Error message analysis
- Dynamic UI change detection
- Automated retry with AI-suggested adjustments
- Escalation to dev team with diagnostic insights
Landng zone
- Raw files
- normalized files
- monthly snapshots
* Design safeguard: Read-only ingestion and snapshotting
* Design safeguard: AI troubleshooting is diagnostic-only; limited automated retries with audit logging

### Reconciliation core
Reconciliation DB
- case history
- matching results
- audit logs
Deterministic Engine
- Extract / tolerance match
- 1:N / N:1 logic
- Exception creation
AI-assisted investigation 
- Root cause suggestion 
- Similar case reference 
- Confidence indication 
* Design safeguard: Rules first, AI sugggestion only

### Finance control layer
Finance Workench
- Review
- Approve / reject / adjust
- Escalate 
Controlled Output
- Exception log
- Suggested entries
- ERP update only if approved
* Design safeguard: Finance approval required.

## Platform governance and controls
- Access control by rule based access and SoD
- Credential management for secrets and portal credentials
- Audit trails for source-to-decision traceability
- Monitoring & alerts when failed jobs and missing files
- Release management by Dev/Test/Prod and rollback




## Roles of each component

### 1. rule-based reconcillation logic using Power Automate
The layer handles portal login & data extraction
Scheduled Data downloads
File Normalization / Formatting
Rule based matching. 

This layer is exact, tolerance and date-lag matching
Candidate grouping for 1:N, N:1 scenarios
Idempotent batch processing. 

Exception modeling is, structured case objects (unmatched, partial, timing, )
Persistent case state across runs. 

Execution is controlled via Versioned rule sets and monthly snapshot isolation for auditability

When succeeded in, it stores items to DB in a isolated DB from the corporate system, and make it accessible from the corporate network

### 2. AI based troubleshooting layer (ingestion failures)
AI assists RPA failure diagnosis and recovery
- Analyze error logs and portal responses
- Detect dynamic UI changes (e.g., portal layout updates)
- Suggest RPA script adjustments or retry strategies
- Escalate to dev team with diagnostic insights if auto-retry fails
Control boundary: AI does not bypass security (no CAPTCHA breaking), only suggests navigation/timing adjustments
All AI-driven retries are logged for audit

### 3. AI based fallback layer, reconcillation suggestion reasoning layer.
AI will assist investigation (post-reconcillation only)
Retrieve a similar historical cases for the unmatched case (RAG-based)
Suggesting resolution with confidence scores.
Control boundary is, AI does not perform matching itself, so all decisions are made by approver/reviewer of the company.
Also, AI does not trigger accounting entries. 

### 4. Finance decisions and contorl strategy
Finance controlled decision layer
- Reviews and approve, adjust exception cases
- Incur explicit approval required for any accounting action
- No automatic ERP/GL posting by Rule-based and AI-supported modules
- the systems should be auditable by logs of user, timestamps and versions. Full lineage from source transaction to final decisions required.

## Some general rules when workflows
1. make explicit cases "run as batch, idempotent processing"
2. make the AI orchestration layer routed for unmatched transactions, call it only when neeeded and track case status
3. add controls like audit logs, versioning, snapshot isolation
4. retry, rerun capability and failure handling should be visible. Should add somewhere "batch-based processing with re-run capability for month-end control"


