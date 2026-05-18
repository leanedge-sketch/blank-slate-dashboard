# LeanChem Connect - Technical Blueprint

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Database Schema](#database-schema)
5. [API Structure](#api-structure)
6. [Frontend Structure](#frontend-structure)
7. [Key Features & Workflows](#key-features--workflows)
8. [Authentication & Security](#authentication--security)
9. [AI Integration](#ai-integration)
10. [Deployment](#deployment)
11. [Next Steps](#next-steps)

---

## System Overview

**LeanChem Connect** is an integrated CRM-PMS (Customer Relationship Management - Product Management System) designed for chemical product sales and inventory management. The system combines customer relationship tracking, product management, sales pipeline tracking, and stock management in a unified platform.

### Core Modules
- **CRM (Customer Relationship Management)**: Customer profiles, interactions, AI-powered chat, customer insights
- **PMS (Product Management System)**: Chemical products, TDS (Technical Data Sheets), vendors, pricing
- **Sales Pipeline**: Opportunity tracking through 8 stages (Lead ID → Closed Won/Lost)
- **Stock Management**: Multi-location inventory tracking (Addis Ababa, SEZ Kenya, Nairobi Partner)

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │   CRM    │  │   PMS    │  │  Sales   │  │  Stock   │     │
│  │  Pages   │  │  Pages   │  │ Pipeline │  │  Pages   │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP/REST API
                        │ (Axios)
┌───────────────────────▼─────────────────────────────────────┐
│              Backend (FastAPI)                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │   CRM    │  │   PMS    │  │  Sales   │  │  Stock   │    │
│  │  API     │  │  API     │  │ Pipeline │  │   API    │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Service Layer                            │  │
│  │  - CRM Service    - PMS Service                      │  │
│  │  - AI Service     - Quotation Service                │  │
│  │  - Stock Service  - File Service                     │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │ Supabase Client
                        │ (PostgreSQL + Storage)
┌───────────────────────▼─────────────────────────────────────┐
│              Supabase (PostgreSQL Database)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  CRM     │  │  PMS     │  │  Sales   │  │  Stock   │    │
│  │  Tables  │  │  Tables  │  │ Pipeline │  │  Tables  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Architecture Patterns
- **Frontend**: Component-based React SPA with React Router
- **Backend**: RESTful API with FastAPI
- **Database**: PostgreSQL (Supabase) with Row Level Security (RLS)
- **Authentication**: Supabase Auth (JWT-based)
- **File Storage**: Supabase Storage buckets
- **AI Integration**: Google Gemini API for chat and document extraction

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI Framework |
| TypeScript | 5.6.3 | Type Safety |
| Vite | 5.2.0 | Build Tool & Dev Server |
| React Router | 6.28.0 | Client-side Routing |
| Axios | 1.7.7 | HTTP Client |
| Tailwind CSS | 4.1.18 | Styling |
| Lucide React | 0.562.0 | Icons |
| XLSX | 0.18.5 | Excel File Processing |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.x | Programming Language |
| FastAPI | 0.104.1+ | Web Framework |
| Uvicorn | 0.24.0+ | ASGI Server |
| Pydantic | 2.5.0+ | Data Validation |
| Supabase | 2.3.5+ | Database Client |
| psycopg2-binary | 2.9.9+ | PostgreSQL Driver |
| Google Generative AI | 0.3.0+ | AI Chat & Extraction |
| PyPDF2 | 3.0.1+ | PDF Processing |
| pandas | 2.2.3+ | Data Processing |
| openpyxl | 3.1.0+ | Excel Processing |

### Database & Infrastructure
| Technology | Purpose |
|------------|---------|
| Supabase (PostgreSQL) | Primary Database |
| Supabase Auth | Authentication |
| Supabase Storage | File Storage |
| pgvector | Vector Embeddings (RAG) |

---

## Database Schema

### Core Tables

#### CRM Tables

**`customers`**
- `customer_id` (UUID, PK)
- `customer_name` (TEXT, UNIQUE)
- `display_id` (TEXT)
- `product_alignment_scores` (JSONB) - Strategic-Fit Matrix
- `sales_stage` (TEXT)
- `website_url`, `linkedin_company_url` (TEXT)
- `primary_contact_name`, `primary_contact_email`, `primary_contact_phone` (TEXT)
- `latest_profile_text` (TEXT)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**`interactions`**
- `id` (UUID, PK)
- `customer_id` (UUID, FK → customers)
- `user_id` (UUID)
- `input_text`, `ai_response` (TEXT)
- `file_url`, `file_type` (TEXT)
- `tds_id` (UUID, FK → tds_data) - **KEY LINK to PMS**
- `pipeline_id` (UUID, FK → sales_pipeline)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**`customer_profile_feedback`**
- `id` (UUID, PK)
- `customer_id` (UUID, FK → customers)
- `rating` (INTEGER, 1-5)
- `comment` (TEXT)
- `user_id` (UUID)
- `created_at` (TIMESTAMPTZ)

#### PMS Tables

**`chemical_types`**
- `id` (UUID, PK)
- `name` (TEXT)
- `category` (TEXT)
- `hs_code` (TEXT)
- `applications` (TEXT[])
- `spec_template` (JSONB)
- `metadata` (JSONB)
- `created_at` (TIMESTAMPTZ)

**`tds_data`** (Technical Data Sheets)
- `id` (UUID, PK)
- `chemical_id` (UUID, FK → chemical_types)
- `brand` (TEXT)
- `grade` (TEXT)
- `owner` (TEXT)
- `source` (TEXT)
- `specs` (JSONB)
- `metadata` (JSONB)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**`partner_chemicals`**
- `id` (UUID, PK)
- `vendor` (TEXT, NOT NULL)
- `country` (TEXT)
- `metadata` (JSONB)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**`chemical_full_data`**
- `id` (INTEGER, PK)
- `uuid_id` (UUID, UNIQUE) - **KEY LINK to sales_pipeline**
- `product_name` (TEXT)
- `vendor` (TEXT)
- `partner_id` (UUID, FK → partner_chemicals)
- `metadata` (JSONB)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**`partner_data`**
- `id` (UUID, PK)
- `partner` (TEXT)
- `partner_country` (TEXT)
- `metadata` (JSONB)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**`costing_pricing_data`**
- `id` (UUID, PK)
- `partner_id` (UUID, FK → partner_data)
- `tds_id` (UUID, FK → tds_data)
- `rows` (JSONB)
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### Sales Pipeline Tables

**`sales_pipeline`**
- `id` (UUID, PK)
- `customer_id` (UUID, FK → customers)
- `tds_id` (UUID, FK → tds_data)
- `chemical_type_id` (UUID, FK → chemical_full_data.uuid_id)
- `stage` (TEXT) - One of: "Lead ID", "Discovery", "Sample", "Validation", "Proposal", "Confirmation", "Closed", "Lost"
- `amount` (NUMERIC)
- `currency` (TEXT) - "ETB", "KES", "USD", "EUR"
- `expected_close_date` (DATE)
- `close_reason` (TEXT)
- `lead_source` (TEXT)
- `contact_per_lead` (TEXT)
- `business_model` (TEXT)
- `unit` (TEXT)
- `unit_price` (NUMERIC)
- `forex` (TEXT) - "LeanChems" or "Client"
- `business_unit` (TEXT) - "Hayat", "Alhadi", "Bet-chem", "Barracoda", "Nyumb-Chem"
- `incoterm` (TEXT) - "Import of Record", "Agency", "Direct Import", "Stock – Addis Ababa"
- `metadata` (JSONB)
- `parent_pipeline_id` (UUID, FK → sales_pipeline) - For versioning
- `version_number` (INTEGER)
- `reason_for_stage_change` (TEXT)
- `reason_for_amount_change` (TEXT)
- `is_current_version` (BOOLEAN)
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### Stock Management Tables

**`products`**
- `id` (UUID, PK)
- `chemical` (TEXT)
- `chemical_type` (TEXT)
- `brand` (TEXT)
- `packaging` (TEXT)
- `kg_per_unit` (FLOAT)
- `use_case` (TEXT) - "sales" or "internal"
- `tds_id` (UUID, FK → tds_data)
- `tds_link` (TEXT)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**`stock_movements`**
- `id` (UUID, PK)
- `product_id` (UUID, FK → products)
- `tds_id` (UUID, FK → tds_data)
- `date` (DATE)
- `location` (TEXT) - "addis_ababa", "sez_kenya", "nairobi_partner"
- `transaction_type` (TEXT) - "Sales", "Purchase", "Inter-company transfer", "Sample", "Damage", "Stock Availability"
- `unit` (TEXT) - "kg", "ton", "g", "lb", "oz", "piece", "unit"
- `beginning_balance`, `purchase_kg`, `sold_kg`, `purchase_direct_shipment_kg`, `sold_direct_shipment_kg`, `sample_or_damage_kg`, `inter_company_transfer_kg`, `balance_kg` (FLOAT)
- `supplier_id` (UUID, FK → partner_data)
- `supplier_name` (TEXT)
- `customer_id` (UUID, FK → customers)
- `customer_name` (TEXT)
- `business_model` (TEXT) - "Stock" or "Direct Delivery"
- `reference`, `remark`, `warehouse` (TEXT)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**`nairobi_partner_stock`**
- `id` (UUID, PK)
- `supplier_id` (UUID, FK → partner_data)
- `supplier_name` (TEXT)
- `product_id` (UUID, FK → products)
- `product_name` (TEXT)
- `quantity_kg` (FLOAT)
- `date` (DATE)
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### Supporting Tables

**`employees`**
- `id` (UUID, PK)
- `email` (TEXT, UNIQUE)
- `name` (TEXT)
- `role` (TEXT)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**`documents`** (RAG Knowledge Base)
- `id` (UUID, PK)
- `content` (TEXT)
- `embedding` (vector(768))
- `metadata` (JSONB)
- `user_id` (UUID)
- `created_at` (TIMESTAMPTZ)

**`conversation`** (AI Conversation Archive)
- `id` (UUID, PK)
- `content` (TEXT)
- `embedding` (vector(768))
- `metadata` (JSONB)
- `created_at` (TIMESTAMPTZ)

### Key Relationships

```
customers (1) ──→ (N) interactions
interactions (N) ──→ (1) tds_data
interactions (N) ──→ (1) sales_pipeline

customers (1) ──→ (N) sales_pipeline
sales_pipeline (N) ──→ (1) chemical_full_data (via chemical_type_id → uuid_id)
sales_pipeline (N) ──→ (1) tds_data

tds_data (N) ──→ (1) chemical_types
tds_data (1) ──→ (N) stock_movements
tds_data (1) ──→ (N) products

partner_chemicals (1) ──→ (N) chemical_full_data (via partner_id)
partner_data (1) ──→ (N) stock_movements (via supplier_id)
partner_data (1) ──→ (N) costing_pricing_data

products (1) ──→ (N) stock_movements
customers (1) ──→ (N) stock_movements
```

---

## API Structure

### Base URL
- Development: `http://localhost:8000/api/v1`
- Production: Configured via `VITE_API_URL` environment variable

### API Endpoints

#### CRM Endpoints (`/api/v1/crm`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/customers` | List customers (with pagination, filters) |
| POST | `/customers` | Create new customer |
| GET | `/customers/{customer_id}` | Get customer details |
| PUT | `/customers/{customer_id}` | Update customer |
| DELETE | `/customers/{customer_id}` | Delete customer |
| GET | `/customers/{customer_id}/interactions` | Get customer interactions |
| POST | `/customers/{customer_id}/chat` | AI chat with customer context |
| GET | `/customers/{customer_id}/profile` | Get customer profile (AI-generated) |
| PUT | `/customers/{customer_id}/profile` | Update customer profile |
| POST | `/customers/{customer_id}/profile/feedback` | Submit profile feedback |
| GET | `/dashboard` | CRM dashboard metrics |
| POST | `/quotes/draft` | Generate quote draft |

#### PMS Endpoints (`/api/v1/pms`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/chemical-types` | List chemical types |
| POST | `/chemical-types` | Create chemical type |
| GET | `/tds` | List TDS records (with filters) |
| POST | `/tds` | Create TDS record |
| GET | `/tds/{tds_id}` | Get TDS details |
| PUT | `/tds/{tds_id}` | Update TDS |
| DELETE | `/tds/{tds_id}` | Delete TDS |
| POST | `/tds/upload` | Upload TDS PDF (AI extraction) |
| GET | `/partners` | List partners |
| POST | `/partners` | Create partner |
| GET | `/partner-chemicals` | List partner chemicals |
| POST | `/partner-chemicals` | Create partner chemical |
| GET | `/chemical-full-data` | List chemical full data |
| POST | `/chemical-full-data` | Create chemical full data |
| GET | `/pricing` | List pricing data |
| POST | `/pricing` | Create pricing record |

#### Sales Pipeline Endpoints (`/api/v1`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sales/pipeline` | List pipelines (with filters, pagination) |
| POST | `/sales/pipeline` | Create new pipeline |
| GET | `/sales/pipeline/{pipeline_id}` | Get pipeline details |
| PUT | `/sales/pipeline/{pipeline_id}` | Update pipeline |
| DELETE | `/sales/pipeline/{pipeline_id}` | Delete pipeline |
| GET | `/sales/pipeline/{pipeline_id}/history` | Get pipeline version history |
| GET | `/sales/pipeline/forecast` | Get sales forecast |
| GET | `/sales/pipeline/insights` | Get pipeline insights |

#### Stock Management Endpoints (`/api/v1`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stock/products` | List products |
| POST | `/stock/products` | Create product |
| GET | `/stock/products/{product_id}` | Get product details |
| PUT | `/stock/products/{product_id}` | Update product |
| DELETE | `/stock/products/{product_id}` | Delete product |
| GET | `/stock/movements` | List stock movements (with filters) |
| POST | `/stock/movements` | Create stock movement |
| GET | `/stock/movements/{movement_id}` | Get movement details |
| PUT | `/stock/movements/{movement_id}` | Update movement |
| DELETE | `/stock/movements/{movement_id}` | Delete movement |
| GET | `/stock/availability` | Get stock availability summary |
| GET | `/stock/availability/{product_id}` | Get product availability |

#### Authentication Endpoints (`/api/v1`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login (Supabase Auth) |
| POST | `/auth/logout` | Logout |
| GET | `/auth/me` | Get current user |
| POST | `/auth/verify` | Verify employee status |

---

## Frontend Structure

### Directory Structure

```
frontend/src/
├── components/          # Reusable components
│   ├── ProtectedRoute.tsx
│   └── QuotationForm.tsx
├── contexts/            # React contexts
│   └── AuthContext.tsx
├── hooks/               # Custom hooks
│   └── useAuth.ts
├── lib/                 # Utilities & config
│   └── supabase.ts
├── pages/               # Page components
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   ├── AuthCallbackPage.tsx
│   │   └── SetPasswordPage.tsx
│   ├── crm/
│   │   ├── CRMHomePage.tsx
│   │   ├── CustomerListPage.tsx
│   │   ├── CustomerDetailPage.tsx
│   │   ├── CustomerProfilePage.tsx
│   │   ├── ManageCustomersPage.tsx
│   │   ├── AddCustomerPage.tsx
│   │   ├── CreateQuotePage.tsx
│   │   ├── CRMDashboardPage.tsx
│   │   └── CRMReportsPage.tsx
│   ├── pms/
│   │   ├── PMSHomePage.tsx
│   │   ├── ChemicalsPage.tsx
│   │   ├── TDSPage.tsx
│   │   ├── PartnersPage.tsx
│   │   ├── PartnerChemicalsPage.tsx
│   │   ├── PricingPage.tsx
│   │   ├── ProductsPage.tsx
│   │   └── MarketPage.tsx
│   ├── sales/
│   │   ├── SalesPipelinePage.tsx
│   │   └── PipelineDetailPage.tsx
│   ├── stock/
│   │   ├── StockAvailabilityPage.tsx
│   │   ├── GeneralStockAvailabilityPage.tsx
│   │   ├── ProductDetailPage.tsx
│   │   └── ProductLabelStockPage.tsx
│   └── HomePage.tsx
├── services/           # API services
│   └── api.ts
├── utils/              # Helper functions
│   ├── dateUtils.ts
│   └── formatUtils.ts
├── App.tsx             # Main app component & routing
├── main.tsx            # Entry point
└── styles.css          # Global styles
```

### Routing Structure

```
/                          → HomePage
/login                     → LoginPage
/auth/callback             → AuthCallbackPage
/auth/set-password         → SetPasswordPage

/crm                      → CRMHomePage
/crm/customers             → CustomerListPage
/crm/customers/manage      → ManageCustomersPage
/crm/customers/new         → AddCustomerPage
/crm/customers/:id         → CustomerDetailPage
/crm/customers/:id/profile → CustomerProfilePage
/crm/quotes/new            → CreateQuotePage
/crm/dashboard             → CRMDashboardPage
/crm/reports               → CRMReportsPage

/pms                      → PMSHomePage
/pms/chemicals             → ChemicalsPage
/pms/tds                   → TDSPage
/pms/partners              → PartnersPage
/pms/partner-chemicals     → PartnerChemicalsPage
/pms/pricing               → PricingPage
/pms/products              → ProductsPage
/pms/market                → MarketPage

/sales/pipeline            → SalesPipelinePage
/sales/pipeline/:id        → PipelineDetailPage
/sales/pipeline/:id/edit   → SalesPipelinePage (edit mode)

/stock                     → StockAvailabilityPage
/stock/general-availability → GeneralStockAvailabilityPage
/stock/products/:id        → ProductDetailPage
/stock/product-label        → ProductLabelStockPage
```

### Key Frontend Patterns

1. **Protected Routes**: All routes except `/login` and `/auth/callback` are protected by `ProtectedRoute` component
2. **State Management**: React hooks (`useState`, `useEffect`) + Context API (`AuthContext`)
3. **API Communication**: Centralized `api.ts` service with Axios
4. **Form Handling**: Controlled components with React state
5. **Styling**: Tailwind CSS utility classes
6. **Icons**: Lucide React icon library

---

## Key Features & Workflows

### 1. Customer Management (CRM)

**Workflow:**
1. User creates customer via `/crm/customers/new`
2. System generates customer profile using AI (web search, LinkedIn scraping)
3. User can view/edit customer details, add interactions
4. AI chat interface allows contextual conversations about customer
5. Customer profile shows product alignment scores (Strategic-Fit Matrix)

**Key Features:**
- AI-powered customer profile generation
- Product alignment scoring (0-3 scale per product category)
- Interaction history tracking
- File uploads (PDFs, images) with AI extraction
- Quote generation from pipeline

### 2. Sales Pipeline Management

**Workflow:**
1. User creates pipeline from "Lead ID" stage only
2. Pipeline linked to customer and product (from `chemical_full_data`)
3. Vendor dropdown filtered by selected product (from `partner_chemicals`)
4. Pipeline progresses through 8 stages with reason tracking
5. Version history maintained for stage/amount changes
6. Pipelines grouped by company (customer) in folder view

**Key Features:**
- Stage-based workflow (Lead ID → Closed Won/Lost)
- Reason tracking for stage/amount changes
- Version history
- Company-based folder organization
- Quotation generation from pipeline
- Forecast and insights

**Pipeline Stages:**
1. Lead ID
2. Discovery
3. Sample
4. Validation
5. Proposal
6. Confirmation
7. Closed (Won)
8. Lost

### 3. Product Management (PMS)

**Workflow:**
1. User creates/manages chemical types
2. TDS records created with AI extraction from PDFs
3. Partner chemicals linked to vendors from `partner_chemicals` table
4. Chemical full data links products to vendors and partners
5. Pricing data tracked per partner/product

**Key Features:**
- TDS PDF upload with AI extraction
- Vendor management via `partner_chemicals`
- Product-vendor relationships
- Pricing tracking
- Market opportunities tracking

### 4. Stock Management

**Workflow:**
1. Products created with TDS links
2. Stock movements recorded per location (Addis Ababa, SEZ Kenya, Nairobi Partner)
3. Transaction types: Sales, Purchase, Inter-company transfer, Sample, Damage, Stock Availability
4. Stock availability calculated from movements
5. Vendor selection filtered by product (from `partner_chemicals`)

**Key Features:**
- Multi-location inventory (3 locations)
- Transaction type validation
- Location-specific business rules
- Real-time stock balance calculation
- Product-vendor filtering

**Location Rules:**
- **Addis Ababa**: Full stock management (all transaction types)
- **SEZ Kenya**: Purchase and Inter-company transfer only
- **Nairobi Partner**: Stock Availability only

### 5. Quotation Generation

**Workflow:**
1. User selects pipeline from list
2. Quotation form auto-fills: product, vendor, unit price, quantity
3. User can edit customer, product, vendor, prices, quantities
4. Excel quotation generated and downloaded
5. Quotation linked to pipeline

**Key Features:**
- Auto-fill from pipeline data
- Excel template generation
- Multiple business unit templates (Bet-chem, Nyumb-Chem, Barracoda)
- Vendor from `partner_chemicals`

---

## Authentication & Security

### Authentication Flow

1. **Login**: User enters email → Supabase Auth sends magic link
2. **Email Verification**: User clicks link → Redirected to `/auth/callback`
3. **Employee Verification**: Backend checks if email exists in `employees` table
4. **Session**: JWT token stored in Supabase client, used for API calls
5. **Protected Routes**: `ProtectedRoute` component checks auth state

### Security Features

1. **Row Level Security (RLS)**: Supabase RLS policies enforce data access
2. **JWT Tokens**: All API requests include JWT in Authorization header
3. **Employee Verification**: Only employees in `employees` table can access
4. **Service Key**: Backend uses service key for admin operations (employee checks)
5. **CORS**: Configured for specific origins (development + production)

### Environment Variables

**Frontend (`.env`):**
- `VITE_API_URL`: Backend API URL
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key

**Backend (`.env`):**
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_KEY`: Supabase service role key (admin)
- `GEMINI_API_KEY`: Google Gemini API key
- `CORS_ORIGINS`: Allowed CORS origins (comma-separated)
- `ENABLE_PROFILE_WORKER`: Enable background profile update worker

---

## AI Integration

### AI Services

1. **Customer Profile Generation** (`ai_service.py`)
   - Web search (Google PSE, SerpAPI)
   - LinkedIn company scraping
   - Profile text generation (Gemini)
   - Product alignment scoring

2. **TDS Extraction** (`file_service.py`)
   - PDF upload and parsing
   - AI extraction of specs, brand, grade
   - Structured data storage

3. **Customer Chat** (`crm_service.py`)
   - Context-aware chat with customer history
   - RAG (Retrieval Augmented Generation) from documents
   - Product recommendations

4. **ICP Context Service** (`icp_context_service.py`)
   - Ideal Customer Profile matching
   - Product alignment analysis
   - Strategic-fit matrix calculation

### AI Models

- **Primary**: Google Gemini 2.5 Flash (`gemini-2.5-flash`)
- **Embeddings**: Google `text-embedding-004`
- **Fallback**: Groq, OpenAI (if configured)

---

## Deployment

### Development Setup

**Frontend:**
```bash
cd frontend
npm install
npm run dev  # Runs on http://localhost:5173
```

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload  # Runs on http://localhost:8000
```

### Production Deployment

**Frontend:**
- Deploy to Vercel/Netlify
- Set environment variables in platform
- Build command: `npm run build`
- Output directory: `dist`

**Backend:**
- Deploy to Render/Railway/Fly.io
- Set environment variables
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Database Migrations

1. Run SQL scripts in Supabase SQL Editor:
   - `create_all_tables.sql`
   - `create_sales_pipeline_table.sql`
   - `create_stock_tables.sql`
   - `create_partner_chemicals_table.sql`
   - `add_uuid_to_chemical_full_data.sql`
   - Other migration scripts as needed

2. Enable Row Level Security (RLS) policies
3. Set up Supabase Storage buckets for file uploads

### Environment Configuration

**Required Environment Variables:**

**Frontend:**
- `VITE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Backend:**
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_SERVICE_KEY`
- `GEMINI_API_KEY`
- `CORS_ORIGINS`

---

## Additional Notes

### Data Import

- CSV import scripts in `backend/scripts/`
- Excel import for chemical full data
- TDS PDF upload with AI extraction

### Background Workers

- Profile update worker (optional, controlled by `ENABLE_PROFILE_WORKER`)
- Updates customer profiles periodically
- Runs in background thread

### File Storage

- Supabase Storage bucket: `documents`
- TDS PDFs stored with metadata
- Customer documents linked to interactions

### Version Control

- Sales pipeline versioning via `parent_pipeline_id`
- Version history tracking
- Current version flag (`is_current_version`)

---

## Next Steps

### Priority Development Tasks

The following items are the immediate next priorities for development:

#### 1. Dashboard Development
**Status**: Planned  
**Priority**: High

**Objectives:**
- Build comprehensive dashboard pages for each module (CRM, PMS, Sales, Stock)
- Implement data visualization components (charts, graphs, metrics)
- Create real-time data updates
- Design intuitive UI/UX for data presentation

**Components to Build:**
- CRM Dashboard (already exists at `/crm/dashboard` - needs enhancement)
- PMS Dashboard (new)
- Sales Pipeline Dashboard (new)
- Stock Management Dashboard (new)
- Module-specific metrics and KPIs

**Technical Requirements:**
- Chart library integration (e.g., Recharts, Chart.js, or similar)
- Real-time data fetching with polling or WebSocket
- Responsive design for mobile and desktop
- Export functionality (PDF, Excel)

#### 2. Ideal Customer Profile (ICP) Prompt Enhancement
**Status**: Planned  
**Priority**: High

**Objectives:**
- Refine the AI prompt used for generating customer profiles
- Improve accuracy of product alignment scores
- Enhance strategic-fit matrix calculations
- Better integration with business requirements

**Areas to Improve:**
- Update prompt in `icp_context_service.py`
- Refine product alignment scoring algorithm
- Enhance web search and data extraction logic
- Improve LinkedIn company profile scraping
- Better context understanding for customer categorization

**Files to Modify:**
- `backend/app/services/icp_context_service.py`
- `backend/app/services/ai_service.py`
- `backend/app/services/crm_service.py`

**Expected Outcomes:**
- More accurate customer profiles
- Better product alignment recommendations
- Improved strategic-fit matrix scores
- Enhanced AI-generated insights

#### 3. General Executive Dashboard (CEO Dashboard)
**Status**: Planned  
**Priority**: High

**Objectives:**
- Create a unified executive dashboard connecting all modules
- Provide high-level overview of business metrics
- Enable CEO-level insights and decision-making
- Aggregate data from CRM, PMS, Sales Pipeline, and Stock Management

**Key Metrics to Display:**
- **Sales Performance**
  - Total pipeline value
  - Conversion rates by stage
  - Revenue forecast
  - Top customers by value
  - Sales velocity metrics

- **Customer Insights**
  - Total customers
  - New customers (time period)
  - Customer engagement metrics
  - Product alignment trends
  - Customer satisfaction scores

- **Product & Inventory**
  - Stock levels by location
  - Low stock alerts
  - Product performance metrics
  - Vendor performance
  - TDS coverage statistics

- **Operational Metrics**
  - Active pipelines by stage
  - Quote generation statistics
  - Interaction volume
  - System usage metrics

**Technical Implementation:**
- New route: `/dashboard` or `/executive-dashboard`
- New component: `ExecutiveDashboardPage.tsx`
- New API endpoint: `/api/v1/dashboard/executive`
- New service: `executive_dashboard_service.py`
- Aggregate queries across all modules
- Real-time data updates
- Export capabilities (PDF reports, Excel)

**Design Considerations:**
- Clean, executive-friendly UI
- Key metrics prominently displayed
- Drill-down capabilities to detailed views
- Customizable date ranges
- Comparison views (month-over-month, year-over-year)
- Mobile-responsive design

**Data Sources:**
- `sales_pipeline` table - Pipeline metrics
- `customers` table - Customer metrics
- `interactions` table - Engagement metrics
- `stock_movements` table - Inventory metrics
- `tds_data` table - Product metrics
- `partner_chemicals` table - Vendor metrics

---

## Future Enhancements

1. **Real-time Updates**: WebSocket integration for live data
2. **Advanced Analytics**: Enhanced dashboard with charts and insights
3. **Mobile App**: React Native mobile application
4. **Email Integration**: Email tracking and automation
5. **Document Management**: Enhanced document storage and search
6. **Multi-tenant Support**: Support for multiple organizations
7. **API Rate Limiting**: Protect against abuse
8. **Caching Layer**: Redis for frequently accessed data

---

**Document Version**: 1.1  
**Last Updated**: 2025-01-27  
**Maintained By**: Development Team

