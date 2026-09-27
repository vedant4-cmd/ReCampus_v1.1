# ReCampus MVP

A college project marketplace built with:
- HTML/CSS/Bootstrap/JavaScript
- Node.js + Express
- PostgreSQL
- JWT authentication
- REST APIs

## Setup

1. Create PostgreSQL database `recampus`.
2. Run `database.sql` inside the `recampus` database.
3. Copy `.env.example` to `.env` and enter your PostgreSQL password.
4. Run:

```bash
npm install
npm run dev
```

5. Open:

http://localhost:5000

## Current MVP features

- Registration
- Login / JWT authentication
- Logout
- Product marketplace
- Search
- Maximum price filter
- Condition filter
- Category filter
- Sorting
- Product details
- Seller listing form
- Orders
- Reviews API
- Messaging API
- PostgreSQL persistence

## Planned integrations

These are deliberately left as integration points rather than fake implementations:
- Razorpay payment gateway
- Email/SMS provider
- Cloud image storage
- Admin dashboard
- SEO metadata/sitemap
- Production HTTPS hosting
- Automated testing
