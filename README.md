# Outrank n8n community node

Automate SEO content creation, keyword research, article generation, and Search Console monitoring with Outrank

Generated from OpenAPI 0.1.0 with template 1.1.0. Generated files are platform-managed and will be overwritten during regeneration.

## Authentication

Configure the generated bearer token credential in n8n before using the node.

## Supported operations

- `POST /articles/bulk-replace` - Bulk Replace Articles
  - Retry Contract: none
  - Pagination Contract: none
- `POST /articles/generate` - Generate Article
  - Retry Contract: none
  - Pagination Contract: none
- `GET /articles/{id}` - Get Article
  - Retry Contract: none
  - Pagination Contract: none
- `GET /articles/{id}/content` - Get Article Content
  - Retry Contract: none
  - Pagination Contract: none
- `GET /articles` - Get Many Articles
  - Retry Contract: none
  - Pagination Contract: none
- `POST /articles/precreate` - Precreate Article
  - Retry Contract: none
  - Pagination Contract: none
- `POST /articles/{id}/replace` - Replace Article
  - Retry Contract: none
  - Pagination Contract: none
- `POST /articles/{id}/retry-publish` - Retry Publish Article
  - Retry Contract: none
  - Pagination Contract: none
- `GET /auth/whoami` - Verify the API key
  - Retry Contract: none
  - Pagination Contract: none
- `GET /billing/portal-url` - Get Billing Portal URL
  - Retry Contract: none
  - Pagination Contract: none
- `GET /subscription/status` - Get Subscription Status
  - Retry Contract: none
  - Pagination Contract: none
- `GET /usage/stats` - Get Usage Stats
  - Retry Contract: none
  - Pagination Contract: none
- `POST /billing/purchase-products` - Quote or purchase additional products
  - Retry Contract: none
  - Pagination Contract: none
- `POST /keywords/bulk-delete` - Bulk delete keywords
  - Retry Contract: none
  - Pagination Contract: none
- `POST /keywords/bulk-process` - Bulk process keywords
  - Retry Contract: none
  - Pagination Contract: none
- `POST /keywords/bulk-reschedule` - Bulk reschedule keywords
  - Retry Contract: none
  - Pagination Contract: none
- `GET /keywords/export` - Export keywords
  - Retry Contract: none
  - Pagination Contract: none
- `POST /keywords/generate` - Generate Keywords
  - Retry Contract: none
  - Pagination Contract: none
- `GET /keywords` - Get Many Keywords
  - Retry Contract: none
  - Pagination Contract: none
- `POST /keywords/suggest` - Suggest Keywords
  - Retry Contract: none
  - Pagination Contract: none
- `POST /products` - Create Product
  - Retry Contract: none
  - Pagination Contract: none
- `GET /products/{id}` - Get Product
  - Retry Contract: none
  - Pagination Contract: none
- `GET /products` - Get Many Products
  - Retry Contract: none
  - Pagination Contract: none
- `POST /products/{id}/pause` - Pause Product
  - Retry Contract: none
  - Pagination Contract: none
- `POST /products/{id}/resume` - Resume a product
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /products/{id}` - Update Product
  - Retry Contract: none
  - Pagination Contract: none
- `POST /products/{id}/gsc/connect` - Connect Search Console
  - Retry Contract: none
  - Pagination Contract: none
- `GET /products/{id}/gsc/cannibalization` - Get Keyword Cannibalization
  - Retry Contract: none
  - Pagination Contract: none
- `GET /products/{id}/gsc` - Get Search Console Connection
  - Retry Contract: none
  - Pagination Contract: none
- `GET /products/{id}/gsc/performance` - Get Search Console Performance
  - Retry Contract: none
  - Pagination Contract: none
- `POST /products/{id}/gsc/url-inspection` - Inspect Search Console URL
  - Retry Contract: none
  - Pagination Contract: none

## Usage

1. Install this community-node package in n8n.
2. Add the **Outrank** node to a workflow.
3. Select a resource and operation, configure its parameters, and execute the workflow.

## Example workflow

Connect **Manual Trigger** -> **Outrank** -> a destination node, select an operation, then run the workflow and inspect the returned items.

## Development

```sh
npm install
npm run build
npm run lint
npm run dev
```

`npm run dev` starts a local n8n development instance. Find the integration by its **Outrank** display name.
