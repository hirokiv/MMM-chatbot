# AI Orchestrator Fallback - Cost Estimation

## Background

In the ERP-GL Reconciliation system, the Deterministic Engine (Layer 3) handles ~90% of transaction matching through rule-based logic. The remaining ~5-10% of unmatched cases fall back to the **AI Investigation layer (Layer 4)** for root cause analysis and resolution suggestions.

This cost estimation quantifies the Azure OpenAI token consumption for AI fallback processing.

## AI Investigation Pipeline

Each unmatched case passes through 4 sequential components:

| # | Component | Model | Task Type |
|---|-----------|-------|-----------|
| 1 | **AI Investigator** | GPT-4o-mini | Orchestration - route case, determine investigation strategy |
| 2 | **RAG Pipeline** | text-embedding-3-small | Embedding generation for vector search on historical cases |
| 3 | **Root Cause Analysis** | GPT-4.1 | Reasoning - pattern detection, hypothesis, resolution proposal |
| 4 | **Confidence Scorer** | GPT-4o-mini | Classification - confidence scoring (0-100%) with reasoning |

### Model Selection Rationale

- **GPT-4.1** is used for Root Cause Analysis, which requires multi-step reasoning over transaction data, historical patterns, and business logic (timing delays, rounding errors, FX differences).
- **GPT-4o-mini** is used for orchestration and classification tasks where the input/output is structured and the reasoning depth is shallow.
- **text-embedding-3-small** is used solely for generating vector embeddings to query the RAG pipeline against historical resolved cases.

## Token Estimates

Token counts are estimated from representative sample prompts included in each function sheet:

| Component | Input Tokens | Output Tokens | Rationale |
|-----------|-------------|--------------|-----------|
| AI Investigator | 500 | 150 | Case summary + routing decision |
| RAG Pipeline | 300 | 0 | Case description for embedding (no generation) |
| Root Cause Analysis | 2,000 | 800 | Case + RAG context + detailed analysis output |
| Confidence Scorer | 1,000 | 300 | Analysis result + score with reasoning |

## Pricing Source

Azure OpenAI Global Standard pay-as-you-go rates (as of 2025):

| Model | Input (USD/1M tokens) | Output (USD/1M tokens) |
|-------|----------------------|------------------------|
| GPT-4.1 | $2.00 | $8.00 |
| GPT-4o-mini | $0.15 | $0.60 |
| text-embedding-3-small | $0.02 | N/A |

Source: [Azure OpenAI Service Pricing](https://azure.microsoft.com/en-us/pricing/details/azure-openai/)

Prompt Caching (not applied in this estimate) can reduce input costs by up to 75%.

## Spreadsheet Usage

Open `ai-orchestrator-cost-estimation.xlsx` and edit the **Parameters** sheet:

- **Business Parameters**: Maisons, stores, transactions/Maison, fallback rate
- **Azure OpenAI Pricing**: Update if pricing changes
- **Period Parameters**: Adjust months, volume ratios, and iteration multipliers per phase
- **USD/JPY**: Exchange rate

All function sheets and the Cost Summary sheet recalculate automatically.

### Period Definitions

| Period | Volume | Iteration Multiplier | Purpose |
|--------|--------|---------------------|---------|
| **PoC Development** | 10% of production | 3.0x | Prompt tuning, repeated testing |
| **Client Validation** | 50% of production | 1.5x | Fine-tuning with client data |
| **Production** | 100% | 1.0x | Normal monthly operation |

## Scope

This estimate covers **LLM token costs only** for the AI fallback path. It does not include:

- Azure infrastructure costs (Container Apps, compute)
- Azure AI Search service tier costs (used by RAG Pipeline)
- Data storage costs (OneLake, Azure SQL)
- Network/egress costs
