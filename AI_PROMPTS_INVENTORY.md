# AI Prompts Inventory - Integrated Deal and Product System (IDPS)

This document catalogs all AI prompts, LLM integrations, and AI-powered features currently used in the system. This will serve as a reference for future ML/AI/LLM enhancements.

---

## 🤖 AI Service Infrastructure

**File:** `backend/app/services/ai_service.py`

### Core AI Functions
- **`gemini_chat(messages)`**: Main chat completion function using Google Gemini
- **`gemini_embed(text)`**: Text embedding generation for RAG (Retrieval-Augmented Generation)
- **`log_conversation_to_rag()`**: Stores conversations in `conversation` table for RAG
- **`search_documents(query)`**: Vector similarity search for document retrieval

**Model Configuration:**
- Chat Model: `GEMINI_CHAT_MODEL` (from environment)
- Embedding Model: `GEMINI_EMBED_MODEL` (from environment)
- API: Google Gemini API (`generativelanguage.googleapis.com`)

---

## 📋 AI Prompts by Service

### 1. CRM Service - Customer Profile Building

**File:** `backend/app/services/crm_service.py`  
**Function:** `build_customer_profile(customer_id, user_id)`

**Purpose:** Generate comprehensive customer profiles with company analysis, strategic fit assessment, and contact recommendations.

**System Prompt:**
```
You are an Industry-Intel Research Assistant and B2B Chemical-Supply Strategist for LeanChem. Your mission is to perform a deep-dive analysis of the target company and all of its construction-relevant subsidiaries operating in Ethiopia, to:

- Identify all business units manufacturing products for the construction sector: cement, dry-mix mortar, concrete admixtures, and paint/coatings.
- Evaluate how LeanChem's chemical portfolio aligns with each unit's product and operational profile.
- Recommend precise engagement strategies tailored by subsector and supply pain points.
- Provide verified decision-maker contacts for B2B outreach.

Primary Deliverables:
1. Company Overview & Recent News (≤500 characters)
2. Construction-Sector Manufacturing Overview (structured list)
3. Strategic-Fit Matrix (0-3 scoring per category)
4. Strategic Insights & Action Plan (≤150 words)
5. Key Contacts for Engagement (up to 10 decision-makers)

Research Inputs:
- LeanChem Offerings (Dry-Mix/Plaster, Concrete Admixtures, Paint/Coatings, Cement Grinding)
- Company websites, annual reports, LinkedIn, news sources

STYLE REQUIREMENTS:
- NO MARKDOWN (no tables, asterisks, code fences, emojis)
- Plain text with simple line breaks
- 4 numbered sections
- JSON block at END with Strategic-Fit Matrix scores
```

**Input Context:**
- Customer name and basic info
- Past interactions (if any)
- Related TDS/product data
- Category list (dynamic based on system configuration)

**Output Format:**
- Plain text profile (4 sections)
- JSON block with strategic fit scores per category

---

### 2. CRM Service - Sales Stage Auto-Fill

**File:** `backend/app/services/crm_service.py`  
**Function:** `analyze_sales_stage(new_interaction, past_context, current_stage)`

**Purpose:** Automatically determine the sales stage (1-7) based on customer interactions using Brian Tracy's 7-stage process.

**System Prompt:**
```
You are "LeanChem 7-Stage Sales Tracker" based on Brian Tracy's sales process.

Analyze the customer interaction and determine which of the 7 stages they are currently in:

1. Prospecting - Customer identified, initial contact made
2. Rapport - Trust built, relationship established
3. Needs Analysis - Customer shares requirements, pain points identified
4. Presenting Solution - Product/service proposal presented
5. Handling Objections - Addressing concerns, negotiating terms
6. Closing - Finalizing deal, contract signed
7. Follow-up & Cross-sell - Post-sale support, upselling opportunities

CURRENT STAGE (if known): {current_stage or "None"}

PAST CONTEXT:
{past_context}

NEW INTERACTION:
{new_interaction}

TASK:
- Analyze the NEW INTERACTION in context of PAST CONTEXT
- Determine the CURRENT stage (1-7) based on evidence
- If CURRENT STAGE is provided, only advance if there's strong new evidence
- Return ONLY the stage number (1, 2, 3, 4, 5, 6, or 7) - nothing else

OUTPUT FORMAT:
Return only a single digit: 1, 2, 3, 4, 5, 6, or 7
```

**Input:**
- New interaction text
- Past context (customer history)
- Current stage (if already set)

**Output:**
- Single digit (1-7) representing the sales stage

**Usage:**
- Automatically triggered when a customer is created
- Can be manually triggered via API
- Updates customer's `sales_stage` field

---

### 3. CRM Service - Customer Chat Assistant

**File:** `backend/app/services/crm_service.py`  
**Function:** `chat_with_customer(customer_id, input_text, user_id, file_content)`

**Purpose:** AI-powered chat assistant that answers questions about specific customers using their interaction history and stored memories.

**System Prompt:**
```
You are a helpful AI assistant specialized in chemical trading and CRM.
If the user asks about a specific customer, use the customer's most relevant past interactions below.
Also use the provided memories and any relevant conversations from the database.
If you don't find relevant information, say so and reason transparently.

Customer context:
{customer_context}

User Memories:
{memories_str}
```

**Input:**
- Customer ID
- User's question/input text
- Optional file attachment content
- Customer interaction history
- Stored memories (from RAG/conversation table)

**Output:**
- Natural language response about the customer
- Response stored in `interactions` table

**Features:**
- RAG-based retrieval of past conversations
- Memory integration
- File content analysis support

---

### 4. Sales Pipeline Service - Pipeline Stage Detection

**File:** `backend/app/services/sales_pipeline_service.py`  
**Function:** `analyze_interaction_for_pipeline_stage(interaction_text, context)`

**Purpose:** Analyze customer interactions to automatically detect which of the 11 pipeline stages the interaction indicates.

**System Prompt:**
```
You are analyzing a B2B chemical sales interaction to determine the appropriate sales pipeline stage.

Available pipeline stages:
1. Lead - Initial contact, customer inquiry
2. Product Identified - Customer has shown interest in a specific product
3. Quote Sent - A price quote has been sent to the customer
4. Sample Requested - Customer has requested a sample
5. Sample Delivered - Sample has been delivered to the customer
6. Agreement in Review - Contract or agreement is being reviewed
7. PO Received - Purchase order has been received
8. Invoiced - Invoice has been sent
9. Delivered - Product has been delivered
10. Closed Won - Deal completed successfully
11. Closed Lost - Deal lost (requires a reason)

Context:
{context}

Customer Interaction Text:
"{interaction_text}"

Analyze this interaction and determine:
1. What pipeline stage does this interaction indicate?
2. What is your confidence level (high/medium/low)?
3. Why did you choose this stage? (brief explanation)
4. If the stage is "Closed Lost", what is the reason?
5. Extract any relevant information: deal value, expected dates, product mentions, etc.

Respond in JSON format:
{
    "detected_stage": "one of the 11 stages above",
    "confidence": "high|medium|low",
    "reason": "brief explanation",
    "close_reason": "reason if Closed Lost, null otherwise",
    "metadata": {
        "amount": null or number,
        "currency": null or "ETB"|"KES"|"USD"|"EUR",
        "expected_close_date": null or "YYYY-MM-DD",
        "product_mentioned": null or product name,
        "notes": "any additional relevant information"
    }
}

Only respond with valid JSON, no additional text.
```

**Input:**
- Interaction text
- Context (customer info, product info, previous pipeline stages)

**Output:**
- JSON with detected stage, confidence, reason, and extracted metadata

**Usage:**
- Automatically called when interactions are created
- Used to auto-update pipeline stage
- Extracts deal value, dates, and product mentions

---

### 5. Sales Pipeline Service - Lead Information Extraction

**File:** `backend/app/services/sales_pipeline_service.py`  
**Function:** `extract_lead_info_from_interactions(customer_id)`

**Purpose:** Extract lead source and contact person information from customer interactions.

**System Prompt:**
```
You are analyzing customer interactions to extract lead information.
Extract the following information if mentioned:
1. Lead Source: Where/how did this lead come from? (e.g., "Website", "Referral", "Trade Show", "LinkedIn", "Cold Call", etc.)
2. Contact Person: Name or title of the contact person for this lead (e.g., "John Doe", "Procurement Manager", "CEO", etc.)

Return ONLY a JSON object with these two fields. If information is not found, use null.
Format: {"lead_source": "value or null", "contact_per_lead": "value or null"}
```

**Input:**
- Customer ID (fetches all interactions for that customer)

**Output:**
- JSON with `lead_source` and `contact_per_lead` fields

**Usage:**
- Auto-populates lead information when creating pipeline records
- Helps track lead sources for analytics

---

### 6. Sales Pipeline Service - Pipeline Insights & Analytics

**File:** `backend/app/services/sales_pipeline_service.py`  
**Function:** `_generate_ai_insights_summary(metrics)`

**Purpose:** Generate actionable insights from sales pipeline metrics and KPIs.

**System Prompt:**
```
You are a sales analytics expert. Provide concise, actionable insights from pipeline metrics.

Analyze these sales pipeline metrics and provide a brief, actionable insights summary (2-3 sentences):

Total Pipeline Value: ${total_pipeline_value:,.2f}
Forecast Value (Committed): ${forecast_value:,.2f}
Stage Distribution: {stage_counts}
Churn Risk (stuck >14 days): {churn_risk_count} pipelines
Sample Effectiveness: {sample_effectiveness:.1f}%

Provide actionable insights and recommendations.
```

**Input:**
- Total pipeline value
- Forecast value
- Stage distribution counts
- Churn risk count
- Sample effectiveness percentage

**Output:**
- 2-3 sentence summary with actionable insights

**Usage:**
- Dashboard analytics
- Pipeline health monitoring
- Performance reporting

---

### 7. Sales Pipeline Service - Pipeline Advice & Strategy

**File:** `backend/app/services/sales_pipeline_service.py`  
**Function:** `get_pipeline_advice(pipeline_id, input_text)`

**Purpose:** Provide AI-powered sales advice and next steps for specific pipeline opportunities.

**System Prompt:**
```
You are an expert B2B chemical sales advisor for LeanChem, specializing in pipeline management and deal strategy.

Your role is to provide actionable sales advice specific to this pipeline opportunity. You have access to:
- Customer information and history
- Product/TDS specifications
- Pipeline stage and deal details
- Related pipeline records
- Product-specific customer interactions

{pipeline_context}
{product_context}
{pipeline_history}
{interaction_context}

Guidelines:
- Provide specific, actionable advice based on the current pipeline stage
- Suggest next steps appropriate for the stage
- Consider deal value and expected close date in your recommendations
- Reference product specifications when relevant
- Use customer interaction history to understand context
- Be concise but thorough
- Focus on helping the sales team move the deal forward
```

**Input:**
- Pipeline ID
- User's question/input
- Pipeline context (customer, product, stage, deal value)
- Product context (TDS data, specifications)
- Pipeline history (related pipelines)
- Interaction context (customer interactions)

**Output:**
- Natural language advice and recommendations
- Stored in pipeline's `ai_interactions` JSON column

**Usage:**
- Interactive sales coaching
- Deal strategy recommendations
- Next steps suggestions

---

### 8. PMS Service - TDS Information Extraction

**File:** `backend/app/services/pms_service.py`  
**Function:** `extract_tds_info_with_ai(text_content)`

**Purpose:** Extract structured data from Technical Data Sheet (TDS) documents using AI.

**System Prompt:**
```
You are a helpful assistant that extracts structured data from Technical Data Sheets. Always return valid JSON only.

Extract the following information from this Technical Data Sheet (TDS) text. 
Return the information in a structured JSON format. If any information is not found, use empty string.

Text content:
{text_content[:10000]}  # Limited to 10,000 chars

Please extract and return ONLY a JSON object with these exact keys:
{
    "generic_product_name": "[extract generic product name]",
    "trade_name": "[extract trade name or model name]",
    "supplier_name": "[extract supplier or manufacturer name]",
    "packaging_size_type": "[extract packaging information]",
    "net_weight": "[extract net weight]",
    "hs_code": "[extract HS code]",
    "technical_specification": "[extract key technical specifications]"
}

Return ONLY valid JSON, no other text.
```

**Input:**
- TDS text content (PDF/text file content, max 10,000 chars)

**Output:**
- JSON object with extracted TDS fields:
  - `generic_product_name`
  - `trade_name`
  - `supplier_name`
  - `packaging_size_type`
  - `net_weight`
  - `hs_code`
  - `technical_specification`

**Usage:**
- Auto-populate TDS form fields when uploading documents
- Reduces manual data entry
- Improves data consistency

---

## 🔄 RAG (Retrieval-Augmented Generation) System

**File:** `backend/app/services/ai_service.py`

### Functions:
1. **`log_conversation_to_rag()`**: Stores conversations with embeddings
2. **`search_documents()`**: Vector similarity search using embeddings

### Database Table:
- **`conversation`**: Stores conversation snippets with:
  - `content`: Human-readable text
  - `embedding`: Vector embedding (768-dim from Gemini)
  - `metadata`: JSON with customer_id, user_id, tds_id, source, etc.

### RPC Function (Supabase):
- **`match_conversation`**: Vector similarity search function
  - Parameters: `query_embedding`, `match_count`, `match_threshold`, `filter`
  - Returns: Similar conversation snippets sorted by similarity

### Usage:
- Customer chat assistant retrieves relevant past conversations
- Context-aware responses based on historical interactions
- Memory integration for personalized assistance

---

## 📊 AI Features Summary

### Current AI Capabilities:
1. ✅ **Customer Profile Generation** - Deep company analysis and strategic fit
2. ✅ **Sales Stage Auto-Detection** - 7-stage Brian Tracy process
3. ✅ **Pipeline Stage Detection** - 11-stage pipeline automation
4. ✅ **Lead Information Extraction** - Auto-extract lead source and contacts
5. ✅ **TDS Data Extraction** - Structured data extraction from documents
6. ✅ **Customer Chat Assistant** - RAG-powered Q&A about customers
7. ✅ **Pipeline Advice** - AI sales coaching and strategy recommendations
8. ✅ **Analytics Insights** - Automated insights from pipeline metrics

### AI Models Used:
- **Google Gemini** (Chat & Embeddings)
  - Chat: `GEMINI_CHAT_MODEL` (configurable)
  - Embeddings: `GEMINI_EMBED_MODEL` (configurable)

### Data Flow:
1. User action → API endpoint
2. Service function → AI prompt construction
3. `gemini_chat()` or `gemini_embed()` → Gemini API
4. Response processing → Database storage
5. Frontend display → User interface

---

## 🚀 Future ML/AI Enhancement Opportunities

### 1. **Advanced Customer Segmentation**
- Clustering customers by behavior, industry, purchase patterns
- Predictive customer lifetime value (CLV)
- Churn prediction models

### 2. **Predictive Sales Forecasting**
- Time series forecasting for pipeline value
- Win probability scoring
- Deal velocity prediction

### 3. **Product Recommendation Engine**
- Collaborative filtering based on customer profiles
- Content-based recommendations from TDS data
- Cross-sell/upsell suggestions

### 4. **Sentiment Analysis**
- Analyze customer interaction sentiment
- Early warning for at-risk deals
- Customer satisfaction scoring

### 5. **Document Intelligence**
- Advanced OCR for TDS documents
- Multi-language support
- Image/table extraction from PDFs

### 6. **Conversational AI Enhancement**
- Multi-turn conversation handling
- Context window optimization
- Fine-tuned models for chemical industry

### 7. **Anomaly Detection**
- Unusual deal patterns
- Price deviation alerts
- Inventory anomaly detection

### 8. **Automated Email Generation**
- Personalized outreach emails
- Follow-up email suggestions
- Proposal generation

### 9. **Competitive Intelligence**
- Market analysis from web scraping
- Competitor pricing insights
- Industry trend analysis

### 10. **Advanced RAG Improvements**
- Hybrid search (vector + keyword)
- Multi-modal RAG (text + images)
- Real-time knowledge base updates

---

## 📝 Notes

- All prompts are currently using **Google Gemini** API
- System is designed to be **provider-agnostic** (can swap to OpenAI, Anthropic, etc.)
- **RAG system** is in place but could be enhanced with better vector search
- **No fine-tuning** currently - all prompts are zero-shot/few-shot
- **Embeddings** are stored in Supabase `conversation` table
- **Error handling** includes fallbacks to default values (e.g., stage "1" on error)

---

## 🔧 Configuration

**Environment Variables:**
- `GEMINI_API_KEY`: Google Gemini API key
- `GEMINI_CHAT_MODEL`: Chat model name (e.g., "gemini-pro")
- `GEMINI_EMBED_MODEL`: Embedding model name (e.g., "models/embedding-001")

**Database Requirements:**
- `conversation` table with `embedding` column (vector type)
- `match_conversation` RPC function for vector search
- Proper indexes on vector columns

---

*Last Updated: 2025-01-15*
*Total AI Prompts: 8*
*AI Functions: 10+*












