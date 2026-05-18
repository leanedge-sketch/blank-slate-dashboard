# LeanChem Connect - User Blueprint

## 📋 Table of Contents
1. [Welcome to LeanChem Connect](#welcome-to-leanchem-connect)
2. [Getting Started](#getting-started)
3. [User Roles & Access](#user-roles--access)
4. [System Overview](#system-overview)
5. [CRM Module - User Guide](#crm-module---user-guide)
6. [PMS Module - User Guide](#pms-module---user-guide)
7. [Sales Pipeline - User Guide](#sales-pipeline---user-guide)
8. [Stock Management - User Guide](#stock-management---user-guide)
9. [Common Tasks & Workflows](#common-tasks--workflows)
10. [Tips & Best Practices](#tips--best-practices)
11. [Troubleshooting](#troubleshooting)

---

## Welcome to LeanChem Connect

**LeanChem Connect** is your unified workspace for managing customers, products, sales opportunities, and inventory. Everything you need to run your chemical product business is in one place, powered by AI to make your work easier and smarter.

### What You Can Do

- **Manage Customers**: Track all customer interactions, generate AI-powered profiles, and maintain relationship history
- **Handle Products**: Manage chemical products, TDS (Technical Data Sheets), vendors, and pricing
- **Track Sales**: Monitor deals through the sales pipeline, generate quotations, and forecast revenue
- **Control Inventory**: Track stock levels across multiple warehouses and locations
- **Get AI Help**: Use AI assistance for customer insights, product recommendations, and decision-making

---

## Getting Started

### First-Time Login

1. **Access the System**
   - Navigate to the LeanChem Connect URL provided by your administrator
   - You'll see the login page

2. **Login Process**
   - Enter your company email address
   - Click "Send Magic Link"
   - Check your email for the login link
   - Click the link in the email (it will open the system automatically)
   - If it's your first time, you may be asked to set a password

3. **Employee Verification**
   - Your email must be registered in the system's employee database
   - If you can't log in, contact your administrator to add your email

4. **Welcome Screen**
   - After logging in, you'll see the Home page with four main workspaces:
     - **CRM Workspace** (blue) - Customer management
     - **PMS Workspace** (green) - Product management
     - **Sales Pipeline** (purple) - Deal tracking
     - **Stock Management** (amber) - Inventory control

### Navigation Basics

- **Top Navigation Bar**: Always visible, shows your current location
- **Home Button**: Click "Home" or the logo to return to the main dashboard
- **Module Cards**: Click any workspace card to enter that module
- **Sign Out**: Click your name/email in the top right, then "Sign Out"

---

## User Roles & Access

### Available Roles

**Employee** (Default)
- Access to all standard features
- Can view and manage data within assigned modules
- Can create, edit, and delete records

**Manager**
- All Employee permissions
- Additional access to management dashboards
- Can view team performance metrics

**CEO/Admin**
- Full system access
- Executive dashboard (coming soon)
- System configuration access

### Module Access

All employees have access to:
- CRM (Customer Relationship Management)
- PMS (Product Management System)
- Sales Pipeline
- Stock Management

Some specialized features may require additional permissions (contact your administrator).

---

## System Overview

### Main Workspaces

#### 1. CRM Workspace
**Purpose**: Manage customer relationships and interactions

**Key Features**:
- Customer list and profiles
- AI-powered customer insights
- Interaction history
- Customer chat with AI assistant
- CRM dashboard and reports

#### 2. PMS Workspace
**Purpose**: Manage products, TDS, vendors, and pricing

**Key Features**:
- Chemical master data
- TDS (Technical Data Sheets) management
- Partner/vendor management
- Product catalog
- Pricing and costing data

#### 3. Sales Pipeline
**Purpose**: Track sales opportunities and deals

**Key Features**:
- Pipeline organized by company (folder view)
- Deal tracking through 8 stages
- Quotation generation
- Sales forecasting
- Deal value and currency management

#### 4. Stock Management
**Purpose**: Track inventory across multiple locations

**Key Features**:
- Product inventory tracking
- Multi-location stock management
- Stock movements and transactions
- Stock availability reports
- Product label management

---

## CRM Module - User Guide

### Overview

The CRM module helps you manage customer relationships, track interactions, and get AI-powered insights about your customers.

### Main Pages

#### 1. CRM Home (`/crm`)
- **Purpose**: Central hub for all CRM activities
- **What You See**: Cards linking to different CRM features
- **Quick Actions**: 
  - Add Customer
  - View Customer List
  - Access Dashboard
  - View Reports

#### 2. Customer List (`/crm/customers`)
- **Purpose**: View and search all customers
- **Features**:
  - Search by customer name
  - Filter by various criteria
  - Click customer name to view details
  - See customer count and statistics

**How to Use**:
1. Navigate to CRM → "Customer List" or click "ICP Workspace"
2. Use search bar to find specific customers
3. Click on any customer card to view full details
4. Use filters to narrow down the list

#### 3. Add Customer (`/crm/customers/new`)
- **Purpose**: Create new customer records

**Step-by-Step**:
1. Go to CRM Home → Click "Add Customer"
2. Fill in required information:
   - **Customer Name** (required) - Company name
   - **Display ID** (optional) - Internal reference
   - **Website URL** (optional) - Company website
   - **LinkedIn URL** (optional) - LinkedIn company page
   - **Primary Contact** (optional) - Name, email, phone
3. Click "Create Customer"
4. System will automatically generate AI-powered profile (may take a few moments)

**Tips**:
- Provide website and LinkedIn URLs for better AI profile generation
- The system will search the web and generate a detailed profile automatically
- You can edit the profile later if needed

#### 4. Customer Detail Page (`/crm/customers/:id`)
- **Purpose**: View comprehensive customer information

**What You See**:
- Customer basic information
- AI-generated profile
- Product alignment scores (Strategic-Fit Matrix)
- Interaction history
- Related sales pipelines
- Quick actions (Edit, View Profile, Chat)

**Actions Available**:
- **Edit Customer**: Update customer information
- **View Profile**: See full AI-generated profile
- **Chat with AI**: Ask questions about this customer
- **View Interactions**: See all past interactions
- **View Pipelines**: See related sales opportunities

#### 5. Customer Profile Page (`/crm/customers/:id/profile`)
- **Purpose**: View and manage AI-generated customer profile

**Features**:
- Full customer profile text (AI-generated)
- Product alignment scores (0-3 scale per product category)
- Profile feedback system
- Download profile as PDF
- Edit profile text
- Rate profile quality (1-5 stars)

**How to Use**:
1. Navigate to customer detail page
2. Click "View Profile" button
3. Review the AI-generated profile
4. Provide feedback if profile needs improvement:
   - Rate the profile (1-5 stars)
   - Add comments about what to improve
   - Click "Submit Feedback"
5. Edit profile text directly if needed
6. Download profile for offline use

#### 6. Manage Customers (`/crm/customers/manage`)
- **Purpose**: View and manage customer interactions

**Features**:
- List of all customers with interaction counts
- Add new interactions
- Edit/delete existing interactions
- Filter and search interactions
- View interaction details

**Adding an Interaction**:
1. Go to "Customer Interactions & History"
2. Select a customer from the list
3. Click "Add Interaction"
4. Fill in:
   - **Input Text**: What the customer said/asked
   - **AI Response**: AI-generated response (optional)
   - **File Upload**: Attach documents if needed
   - **Link to Product**: Select TDS/product if relevant
5. Click "Save"

#### 7. Customer Chat (`/crm/customers/:id`)
- **Purpose**: AI-powered chat assistant for customer-related questions

**How to Use**:
1. Open a customer detail page
2. Scroll to "AI Chat" section
3. Type your question about the customer
4. AI will respond with context-aware answers
5. Chat history is saved automatically

**Example Questions**:
- "What products are best for this customer?"
- "What was discussed in the last interaction?"
- "What is the customer's business model?"
- "What are the customer's main pain points?"

#### 8. CRM Dashboard (`/crm/dashboard`)
- **Purpose**: High-level view of CRM metrics and AI-powered questions

**Features**:
- Total customers count
- Total interactions count
- Customers with interactions
- Sales stage distribution
- AI question interface

**Using AI Questions**:
1. Go to CRM Dashboard
2. Type a natural language question in the AI question box
3. Examples:
   - "How many customers do we have?"
   - "Which customers have the most interactions?"
   - "What products are most discussed?"
4. AI will search through your interactions and provide answers

#### 9. CRM Reports (`/crm/reports`)
- **Purpose**: Generate and export CRM reports

**Features**:
- Filter customers by various criteria
- Export to CSV or PDF
- Summary statistics
- Date range filtering

---

## PMS Module - User Guide

### Overview

The PMS (Product Management System) module manages all product-related data: chemicals, TDS, vendors, partners, and pricing.

### Main Pages

#### 1. PMS Home (`/pms`)
- **Purpose**: Central hub for product management
- **Available Features**:
  - Chemical Master Data
  - TDS Management
  - Partner Master Data
  - Pricing & Costing
  - Products
  - Market Data

#### 2. Chemical Master Data (`/pms/chemicals`)
- **Purpose**: Manage chemical types and categories

**Features**:
- View all chemical types
- Add new chemical types
- Edit chemical information
- Link to TDS records
- View applications and specifications

**Adding a Chemical Type**:
1. Go to PMS → "Chemical Master Data"
2. Click "Add New Chemical Type"
3. Fill in:
   - **Name**: Chemical name (e.g., "RDP", "HPMC")
   - **Category**: Product category
   - **HS Code**: Harmonized System code
   - **Applications**: List of applications
4. Click "Save"

#### 3. TDS Management (`/pms/tds`)
- **Purpose**: Manage Technical Data Sheets (TDS) for products

**Features**:
- View all TDS records
- Upload TDS PDFs (AI extraction)
- Add TDS manually
- Edit TDS information
- Link TDS to chemical types
- Search and filter TDS

**Uploading a TDS (AI Extraction)**:
1. Go to PMS → "TDS Management"
2. Click "Upload TDS"
3. Select PDF file
4. System will automatically extract:
   - Brand
   - Grade
   - Specifications
   - Other relevant data
5. Review extracted data
6. Link to chemical type if needed
7. Click "Save"

**Adding TDS Manually**:
1. Click "Add New TDS"
2. Fill in:
   - **Chemical Type**: Select from dropdown
   - **Brand**: Product brand name
   - **Grade**: Product grade
   - **Owner**: TDS owner
   - **Source**: Source of TDS
   - **Specs**: Technical specifications (JSON format)
3. Click "Save"

#### 4. Partner Master Data (`/pms/partners`)
- **Purpose**: Manage partner/supplier information

**Features**:
- View all partners
- Add new partners
- Edit partner details
- Partner country information
- Metadata storage

**Adding a Partner**:
1. Go to PMS → "Partner Master Data"
2. Click "Add Partner"
3. Fill in:
   - **Partner Name**: Company name
   - **Partner Country**: Country location
   - **Metadata**: Additional information (optional)
4. Click "Save"

#### 5. Partner Chemicals (`/pms/partner-chemicals`)
- **Purpose**: Manage vendor-product relationships

**Features**:
- View vendors and their products
- Add vendor-product links
- Vendor filtering by product
- Country information

**Key Use Case**:
- When creating a sales pipeline, vendors are filtered based on the selected product
- This ensures you only see vendors that supply the selected product

**Adding Partner Chemical**:
1. Go to PMS → "Partner Chemicals"
2. Click "Add New"
3. Fill in:
   - **Vendor**: Vendor name (from partner_chemicals table)
   - **Country**: Vendor country
   - **Metadata**: Additional information
4. Click "Save"

#### 6. Pricing & Costing (`/pms/pricing`)
- **Purpose**: Manage product pricing and costing data

**Features**:
- View pricing by partner and product
- Add pricing records
- Edit pricing information
- Cost analysis

#### 7. Products (`/pms/products`)
- **Purpose**: View and manage product catalog

**Features**:
- Product list with full details
- Product-vendor relationships
- Product specifications
- Link to TDS

#### 8. Market Data (`/pms/market`)
- **Purpose**: Track market opportunities and trends

**Features**:
- Market opportunity records
- Trend analysis
- Competitive intelligence

---

## Sales Pipeline - User Guide

### Overview

The Sales Pipeline module tracks sales opportunities from initial lead to closed deal. Pipelines are organized by company (customer) in folder view.

### Main Features

#### 1. Pipeline List View (`/sales/pipeline`)
- **Purpose**: View all sales pipelines organized by company

**Folder View**:
- Pipelines are grouped by customer/company
- Each company appears as a folder
- Click folder to expand and see all pipelines for that company
- Folder shows: Company name and pipeline count

**Pipeline Cards** (inside folders):
- Customer name
- Product name
- Current stage
- Deal amount and currency
- Expected close date
- Quick actions: Create Quotation, Edit, Delete, View Details

**Actions Available**:
- **Create New Pipeline**: Click "Create New Pipeline" button
- **Expand/Collapse Folders**: Click folder row to toggle
- **View Pipeline Details**: Click pipeline card
- **Edit Pipeline**: Click edit icon on card
- **Create Quotation**: Click quotation icon on card
- **Delete Pipeline**: Click delete icon on card

#### 2. Creating a New Pipeline

**Step-by-Step**:
1. Go to Sales Pipeline page
2. Click "Create New Pipeline" button
3. Fill in the form:
   - **Customer** (required): Select from dropdown
   - **Product Name** (required): Select from chemical_full_data
   - **Vendor** (required): Select from dropdown (filtered by selected product)
   - **Stage**: Automatically set to "Lead ID" (cannot be changed for new pipelines)
   - **Amount**: Deal value (optional)
   - **Currency**: Select currency (ETB, KES, USD, EUR)
   - **Expected Close Date**: When deal is expected to close
   - **Lead Source**: Where the lead came from
   - **Contact per Lead**: Contact person
   - **Business Model**: Business model type
   - **Unit**: Unit of measurement
   - **Unit Price**: Price per unit
   - **Forex**: Who handles forex (LeanChems or Client)
   - **Business Unit**: Select business unit (Hayat, Alhadi, Bet-chem, Barracoda, Nyumb-Chem)
   - **Incoterm**: Select incoterm (Import of Record, Agency, Direct Import, Stock – Addis Ababa)
4. Click "Save"

**Important Notes**:
- New pipelines can ONLY be created in "Lead ID" stage
- Vendor dropdown is automatically filtered based on selected product
- Only vendors that supply the selected product will appear

#### 3. Pipeline Stages

Pipelines progress through 8 stages:

1. **Lead ID** - Initial lead identified
2. **Discovery** - Learning about customer needs
3. **Sample** - Sample requested or delivered
4. **Validation** - Product validation in progress
5. **Proposal** - Proposal/quotation sent
6. **Confirmation** - Deal confirmed, awaiting PO
7. **Closed** - Deal won (successful)
8. **Lost** - Deal lost (requires close reason)

#### 4. Editing a Pipeline

**Step-by-Step**:
1. Click edit icon on pipeline card OR navigate to `/sales/pipeline/:id/edit`
2. Form will be pre-filled with current data
3. Make changes:
   - **Stage Changes**: If changing stage, you must provide "Reason for Stage Change"
   - **Amount Changes**: If changing amount, you must provide "Reason for Amount Change"
4. Click "Save"

**Version History**:
- System automatically creates version history when stage or amount changes
- Previous versions are preserved
- You can view version history from pipeline detail page

#### 5. Pipeline Detail Page (`/sales/pipeline/:id`)
- **Purpose**: View comprehensive pipeline information

**What You See**:
- All pipeline information
- Stage progression
- Version history
- Related interactions
- Deal timeline
- Quick actions

#### 6. Creating Quotations

**From Pipeline Card**:
1. Click quotation icon (📄) on pipeline card
2. Quotation form opens with pre-filled data:
   - Customer (from pipeline)
   - Product (from pipeline)
   - Vendor (from pipeline)
   - Unit Price (from pipeline)
   - Quantity (editable)
3. Review and edit as needed
4. Click "Generate Quotation"
5. Excel file downloads automatically

**From Pipeline Detail Page**:
1. Open pipeline detail page
2. Click "Create Quotation" button
3. Follow same steps as above

**Quotation Features**:
- Auto-fills from pipeline data
- Multiple business unit templates (Bet-chem, Nyumb-Chem, Barracoda)
- Editable customer, product, vendor, prices, quantities
- Excel format ready for sending

#### 7. Pipeline Filters

**Available Filters**:
- **Customer**: Filter by customer
- **Product**: Filter by product/chemical type
- **Stage**: Filter by pipeline stage
- **Search**: Text search across pipelines

**How to Use**:
1. Use filter dropdowns at top of pipeline list
2. Select filter criteria
3. Results update automatically
4. Clear filters to see all pipelines

---

## Stock Management - User Guide

### Overview

The Stock Management module tracks inventory across three locations: Addis Ababa, SEZ Kenya, and Nairobi Partner.

### Main Pages

#### 1. Stock Availability (`/stock`)
- **Purpose**: View stock availability summary

**Features**:
- Stock levels by location
- Product availability
- Low stock alerts
- Stock summary

#### 2. General Stock Availability (`/stock/general-availability`)
- **Purpose**: General overview of all stock

**Features**:
- All products stock levels
- Location-wise breakdown
- Search and filter products
- Export capabilities

#### 3. Product Label Stock (`/stock/product-label`)
- **Purpose**: Manage stock by product labels

**Features**:
- Create stock entries by product
- Link to TDS/products
- Vendor selection (filtered by product)
- Supplier selection (from partner_chemicals)
- Stock movement tracking

**Creating Stock Entry**:
1. Go to Stock Management → "Product Label Stock"
2. Click "Add Stock" or "Create New Stock"
3. Fill in the form:
   - **Product Name** (required): Select from chemical_full_data
   - **Vendor** (required): Select from dropdown (filtered by product)
   - **Supplier (Partner)** (required): Select from partner_chemicals
   - **Location**: Select location (Addis Ababa, SEZ Kenya, Nairobi Partner)
   - **Transaction Type**: Select type
   - **Date**: Transaction date
   - **Quantities**: Enter quantities
   - **Unit**: Select unit (kg, ton, etc.)
   - **Reference**: Reference number
   - **Remarks**: Additional notes
4. Click "Save"

**Important Notes**:
- Vendor dropdown is filtered by selected product (only vendors for that product appear)
- Supplier comes from partner_chemicals table
- "Select Vendor" and "Select TDS" fields have been removed from the form

#### 4. Product Detail Page (`/stock/products/:id`)
- **Purpose**: View detailed product stock information

**Features**:
- Product information
- Stock levels by location
- Stock movement history
- Transaction details

### Stock Locations

**Addis Ababa**:
- Full stock management
- All transaction types allowed:
  - Sales
  - Purchase
  - Inter-company transfer
  - Sample
  - Damage

**SEZ Kenya**:
- Limited operations
- Only allowed:
  - Purchase
  - Inter-company transfer
- Cannot have: Sales, Sample, Damage transactions

**Nairobi Partner**:
- Stock availability tracking only
- Transaction type: "Stock Availability" only
- Used for tracking partner supplier stock

### Transaction Types

1. **Sales**: Product sold to customer
2. **Purchase**: Product purchased from supplier
3. **Inter-company Transfer**: Transfer between locations
4. **Sample**: Sample given to customer
5. **Damage**: Damaged/lost stock
6. **Stock Availability**: Available stock (Nairobi Partner only)

---

## Common Tasks & Workflows

### Workflow 1: Onboarding a New Customer

**Steps**:
1. **Add Customer** (`/crm/customers/new`)
   - Enter customer name and basic info
   - Add website and LinkedIn URLs (for better AI profile)
   - Click "Create Customer"

2. **Review AI Profile** (`/crm/customers/:id/profile`)
   - System generates profile automatically
   - Review product alignment scores
   - Provide feedback if needed

3. **Add Initial Interaction** (`/crm/customers/manage`)
   - Record first conversation
   - Link to relevant products if discussed

4. **Create Sales Pipeline** (`/sales/pipeline`)
   - Create pipeline in "Lead ID" stage
   - Select customer and product
   - Vendor auto-filters based on product

### Workflow 2: Processing a TDS

**Steps**:
1. **Upload TDS** (`/pms/tds`)
   - Click "Upload TDS"
   - Select PDF file
   - System extracts data automatically

2. **Review Extracted Data**
   - Check brand, grade, specs
   - Edit if needed

3. **Link to Chemical Type**
   - Select appropriate chemical type
   - Save TDS

4. **Use in Sales Pipeline**
   - TDS now available when creating pipelines
   - Can be linked to customer interactions

### Workflow 3: Moving a Deal Through Pipeline

**Steps**:
1. **Create Pipeline** (`/sales/pipeline`)
   - Start in "Lead ID" stage
   - Enter all relevant information

2. **Update Stage** (`/sales/pipeline/:id/edit`)
   - Change stage as deal progresses
   - Provide reason for stage change (required)
   - System tracks version history

3. **Generate Quotation** (when in Proposal stage)
   - Click quotation icon on pipeline card
   - Review auto-filled data
   - Generate and download Excel

4. **Close Deal** (when won or lost)
   - Update to "Closed" or "Lost" stage
   - If lost, provide close reason (required)
   - System records final state

### Workflow 4: Managing Stock

**Steps**:
1. **View Stock Availability** (`/stock`)
   - Check current stock levels
   - Identify low stock items

2. **Record Stock Movement** (`/stock/product-label`)
   - Create new stock entry
   - Select product and vendor (filtered)
   - Enter transaction details
   - Select location and transaction type

3. **Monitor Stock Levels**
   - View product detail pages
   - Check stock by location
   - Set up alerts for low stock

### Workflow 5: Using AI Chat

**Steps**:
1. **Navigate to Customer** (`/crm/customers/:id`)
   - Open customer detail page

2. **Access AI Chat**
   - Scroll to "AI Chat" section
   - Type your question

3. **Get AI Response**
   - AI searches customer history
   - Provides context-aware answers
   - Saves chat history automatically

**Example Questions**:
- "What products should I recommend to this customer?"
- "What was discussed in our last meeting?"
- "What is the customer's current stage in the pipeline?"

---

## Tips & Best Practices

### General Tips

1. **Keep Data Updated**
   - Update customer information regularly
   - Record interactions promptly
   - Keep pipeline stages current

2. **Use AI Features**
   - Leverage AI chat for quick insights
   - Review AI-generated profiles
   - Provide feedback to improve AI accuracy

3. **Organize by Company**
   - Sales pipelines are grouped by company
   - Use folder view to see all deals for a customer

4. **Link Related Data**
   - Link interactions to products/TDS
   - Link pipelines to customers
   - Connect stock movements to products

### CRM Best Practices

1. **Customer Profiles**
   - Always add website and LinkedIn URLs
   - Review AI-generated profiles
   - Provide feedback to improve accuracy
   - Update profiles when customer information changes

2. **Interactions**
   - Record interactions immediately after meetings
   - Link to relevant products when discussed
   - Use clear, descriptive input text
   - Attach relevant documents

3. **AI Chat**
   - Ask specific questions for better answers
   - Use customer context in questions
   - Review chat history for patterns

### Sales Pipeline Best Practices

1. **Pipeline Creation**
   - Always start in "Lead ID" stage
   - Fill in all relevant information
   - Select correct product and vendor

2. **Stage Management**
   - Update stages promptly as deals progress
   - Always provide reasons for stage changes
   - Keep expected close dates updated

3. **Quotations**
   - Generate quotations from pipeline data
   - Review auto-filled information
   - Customize as needed before sending

### Stock Management Best Practices

1. **Stock Entries**
   - Record movements immediately
   - Use correct transaction types
   - Select appropriate location
   - Double-check quantities

2. **Location Rules**
   - Remember location-specific rules:
     - Addis Ababa: All transaction types
     - SEZ Kenya: Purchase and transfer only
     - Nairobi Partner: Stock availability only

3. **Product-Vendor Linking**
   - Vendor dropdown filters by product
   - Only select vendors that supply the product
   - Use supplier field for partner information

### PMS Best Practices

1. **TDS Management**
   - Upload TDS PDFs for automatic extraction
   - Review extracted data for accuracy
   - Link TDS to correct chemical types

2. **Vendor Management**
   - Keep vendor information updated
   - Add vendors to partner_chemicals table
   - Link vendors to products correctly

---

## Troubleshooting

### Common Issues

#### 1. Can't Log In
**Problem**: Login link not working or access denied

**Solutions**:
- Check email for login link (check spam folder)
- Ensure your email is registered in employee database
- Contact administrator to verify access
- Try requesting new magic link

#### 2. No Vendors in Dropdown
**Problem**: Vendor dropdown is empty when creating pipeline/stock

**Solutions**:
- Ensure product is selected first (vendor filters by product)
- Check if vendors exist in partner_chemicals table
- Verify vendor is linked to selected product
- Contact administrator to add vendor-product links

#### 3. AI Profile Not Generated
**Problem**: Customer profile not appearing after creation

**Solutions**:
- Wait a few moments (AI generation takes time)
- Refresh the page
- Check if website/LinkedIn URLs were provided
- Try editing customer and adding URLs
- Contact administrator if issue persists

#### 4. Can't Change Pipeline Stage
**Problem**: Stage dropdown disabled or can't save stage change

**Solutions**:
- New pipelines must start in "Lead ID" stage
- For existing pipelines, ensure you're in edit mode
- Provide reason for stage change (required)
- Check if you have edit permissions

#### 5. Quotation Not Downloading
**Problem**: Quotation Excel file not downloading

**Solutions**:
- Check browser download settings
- Ensure pop-up blocker is disabled
- Try different browser
- Verify pipeline has all required data
- Contact administrator if issue persists

#### 6. Stock Entry Not Saving
**Problem**: Can't save stock movement

**Solutions**:
- Verify all required fields are filled
- Check transaction type matches location rules
- Ensure quantities are valid numbers
- Verify product and vendor are selected
- Check location-specific transaction rules

### Getting Help

1. **Check This Guide**: Review relevant section
2. **Contact Administrator**: For access or technical issues
3. **Review System Messages**: Error messages often provide clues
4. **Check Data**: Verify data exists (customers, products, vendors)

### System Requirements

- **Browser**: Modern browser (Chrome, Firefox, Edge, Safari)
- **Internet**: Stable internet connection required
- **Email**: Valid company email for login
- **Permissions**: Appropriate role and access level

---

## Quick Reference

### Keyboard Shortcuts
- None currently implemented (coming soon)

### Important URLs
- Home: `/`
- CRM Home: `/crm`
- PMS Home: `/pms`
- Sales Pipeline: `/sales/pipeline`
- Stock Management: `/stock`

### Key Concepts

**Strategic-Fit Matrix**: Product alignment scores (0-3) showing how well products fit each customer

**Pipeline Stages**: 8 stages from Lead ID to Closed/Lost

**Stock Locations**: Addis Ababa, SEZ Kenya, Nairobi Partner

**Transaction Types**: Sales, Purchase, Inter-company transfer, Sample, Damage, Stock Availability

**Vendor Filtering**: Vendors automatically filter based on selected product

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-27  
**For**: All LeanChem Connect Users


