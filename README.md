# KhmerShop — Flask + Bakong KHQR Store

A Python e-commerce store with seller accounts and Bakong KHQR payment integration.

## Features
- Seller registration & login
- Product listings with image support
- Bakong KHQR dynamic QR code per order
- Order management dashboard
- Works with ABA, ACLEDA, Wing, and all Bakong-linked banks

## Setup

```bash
cd store
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open http://localhost:5000

## Bakong Account ID
Your Bakong account ID looks like `yourname@bakong`.  
Find it in your ABA / ACLEDA / Wing app under Bakong settings.

## Production Tips
- Set `SECRET_KEY` in a `.env` file
- Swap SQLite for PostgreSQL: set `DATABASE_URL=postgresql://...` in `.env`
- Run behind gunicorn + nginx
