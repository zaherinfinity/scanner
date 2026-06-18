import os
import io
import re
import base64
import sys
import traceback
from datetime import datetime

import qrcode
from flask import Flask, render_template, redirect, url_for, flash, request, jsonify
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

# Your database models – make sure models.py exists in the same directory
from models import db, User, Product, Order

# ----------------------------------------------------------------------
# 1.  Handle KHQR gracefully – it may not be installable on PyPI
# ----------------------------------------------------------------------
KHQR_AVAILABLE = False
try:
    from bakong_khqr import KHQR
    from bakong_khqr.models import IndividualInfo, CurrencyCode
    KHQR_AVAILABLE = True
except ImportError:
    # The package is not available; we'll disable KHQR features
    pass

load_dotenv()  # Load .env only for local development – ignored on Vercel

# ----------------------------------------------------------------------
# 2.  Database URL cleaning
# ----------------------------------------------------------------------
def _clean_db_url(url: str) -> str:
    """Normalize database URL for SQLAlchemy compatibility."""
    if not url:
        return ''
    # SQLAlchemy 1.4+ requires postgresql:// not postgres://
    if url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql://', 1)
    # Strip pgbouncer=true – not a valid SQLAlchemy param
    url = re.sub(r'[&?]pgbouncer=true', '', url)
    return url

# ----------------------------------------------------------------------
# 3.  Flask app setup
# ----------------------------------------------------------------------
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'change-this-in-production')

# Vercel provides POSTGRES_URL_NON_POOLING (or DATABASE_URL) – always prefer it
_raw_url = (
    os.environ.get('POSTGRES_URL_NON_POOLING') or
    os.environ.get('DATABASE_URL') or
    'sqlite:///store.db'          # fallback – but SQLite is read‑only on Vercel!
)
app.config['SQLALCHEMY_DATABASE_URI'] = _clean_db_url(_raw_url)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Connection pool settings for serverless (avoid exhausted connections)
engine_options = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
}
if 'supabase' in _raw_url:
    engine_options['connect_args'] = {'sslmode': 'require'}
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = engine_options

# Warn if we are using SQLite (won't work on Vercel)
if 'sqlite' in _raw_url:
    app.logger.warning(
        "SQLite database detected. Vercel's filesystem is read‑only; "
        "please set POSTGRES_URL_NON_POOLING or DATABASE_URL in your environment."
    )

db.init_app(app)

# ----------------------------------------------------------------------
# 4.  Login manager
# ----------------------------------------------------------------------
login_manager = LoginManager(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access this page.'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# ----------------------------------------------------------------------
# 5.  KHQR generator (disabled if package missing)
# ----------------------------------------------------------------------
def generate_khqr(bakong_account, merchant_name, amount, bill_number):
    """Generate a KHQR string and return a base64 PNG data URI."""
    if not KHQR_AVAILABLE:
        return None, 'bakong-khqr not installed'
    try:
        info = IndividualInfo(
            bakong_account_id=bakong_account,
            merchant_name=merchant_name,
            merchant_city='Phnom Penh',
            amount=round(amount, 2),
            currency=CurrencyCode.USD,
            store_label=merchant_name[:25],
            bill_number=bill_number,
            terminal_label='WEB',
        )
        khqr = KHQR()
        result = khqr.generate_individual_khqr(info)
        qr_string = result.data if hasattr(result, 'data') else str(result)

        qr_img = qrcode.QRCode(version=1, box_size=8, border=4)
        qr_img.add_data(qr_string)
        qr_img.make(fit=True)
        img = qr_img.make_image(fill_color='black', back_color='white')
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        data_uri = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
        return data_uri, qr_string
    except Exception as e:
        return None, str(e)

# ----------------------------------------------------------------------
# 6.  Public routes
# ----------------------------------------------------------------------
@app.route('/')
def index():
    products = Product.query.filter_by(active=True).order_by(Product.created_at.desc()).all()
    return render_template('index.html', products=products)

@app.route('/product/<int:product_id>')
def product_detail(product_id):
    product = Product.query.get_or_404(product_id)
    return render_template('product_detail.html', product=product)

@app.route('/checkout/<int:product_id>', methods=['GET', 'POST'])
def checkout(product_id):
    product = Product.query.get_or_404(product_id)

    if request.method == 'POST':
        buyer_name = request.form.get('buyer_name', '').strip()
        buyer_phone = request.form.get('buyer_phone', '').strip()
        try:
            quantity = int(request.form.get('quantity', 1))
        except ValueError:
            quantity = 0

        if not buyer_name:
            flash('Please enter your name.', 'error')
        elif quantity < 1 or quantity > product.stock:
            flash('Invalid quantity.', 'error')
        else:
            total = round(product.price_usd * quantity, 2)
            order = Order(
                buyer_name=buyer_name,
                buyer_phone=buyer_phone,
                product_id=product.id,
                seller_id=product.seller_id,
                quantity=quantity,
                total_usd=total,
                status='pending',
            )
            db.session.add(order)
            db.session.flush()

            bill_ref = f'ORD{order.id:06d}'
            qr_image, qr_data = generate_khqr(
                bakong_account=product.seller.bakong_account,
                merchant_name=product.seller.shop_name,
                amount=total,
                bill_number=bill_ref,
            )
            order.khqr_data = qr_data
            db.session.commit()

            return render_template(
                'checkout.html',
                product=product,
                order=order,
                qr_image=qr_image,
                total=total,
            )

    return render_template('checkout.html', product=product, order=None, qr_image=None)

@app.route('/order/<int:order_id>/confirm', methods=['POST'])
def confirm_payment(order_id):
    order = Order.query.get_or_404(order_id)
    order.status = 'paid'
    db.session.commit()
    flash('Payment confirmed! The seller has been notified.', 'success')
    return redirect(url_for('index'))

# ----------------------------------------------------------------------
# 7.  Authentication
# ----------------------------------------------------------------------
@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        username      = request.form.get('username', '').strip()
        email         = request.form.get('email', '').strip().lower()
        password      = request.form.get('password', '')
        shop_name     = request.form.get('shop_name', '').strip()
        bakong_account = request.form.get('bakong_account', '').strip()
        phone         = request.form.get('phone', '').strip()

        errors = []
        if len(username) < 3:
            errors.append('Username must be at least 3 characters.')
        if '@' not in email:
            errors.append('Enter a valid email.')
        if len(password) < 6:
            errors.append('Password must be at least 6 characters.')
        if not shop_name:
            errors.append('Shop name is required.')
        if '@bakong' not in bakong_account:
            errors.append('Enter a valid Bakong account (e.g. yourname@bakong).')
        if User.query.filter_by(username=username).first():
            errors.append('Username already taken.')
        if User.query.filter_by(email=email).first():
            errors.append('Email already registered.')

        if errors:
            for e in errors:
                flash(e, 'error')
        else:
            user = User(
                username=username,
                email=email,
                password_hash=generate_password_hash(password),
                shop_name=shop_name,
                bakong_account=bakong_account,
                phone=phone,
            )
            db.session.add(user)
            db.session.commit()
            login_user(user)
            flash('Account created! Welcome to your dashboard.', 'success')
            return redirect(url_for('dashboard'))

    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        email    = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        user     = User.query.filter_by(email=email).first()

        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            return redirect(request.args.get('next') or url_for('dashboard'))
        flash('Incorrect email or password.', 'error')

    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

# ----------------------------------------------------------------------
# 8.  Seller dashboard
# ----------------------------------------------------------------------
@app.route('/dashboard')
@login_required
def dashboard():
    products = (Product.query
                .filter_by(seller_id=current_user.id)
                .order_by(Product.created_at.desc())
                .all())
    orders = (Order.query
              .filter_by(seller_id=current_user.id)
              .order_by(Order.created_at.desc())
              .limit(20).all())
    total_revenue = sum(
        o.total_usd for o in
        Order.query.filter_by(seller_id=current_user.id, status='paid').all()
    )
    return render_template('dashboard.html',
                           products=products,
                           orders=orders,
                           total_revenue=total_revenue)

@app.route('/product/add', methods=['GET', 'POST'])
@login_required
def add_product():
    if request.method == 'POST':
        name      = request.form.get('name', '').strip()
        desc      = request.form.get('description', '').strip()
        image_url = request.form.get('image_url', '').strip()

        errors = []
        if not name:
            errors.append('Product name is required.')
        try:
            price = float(request.form.get('price_usd', 0))
            if price <= 0:
                errors.append('Price must be greater than 0.')
        except ValueError:
            errors.append('Invalid price.')
            price = 0
        try:
            stock = int(request.form.get('stock', 0))
            if stock < 0:
                errors.append('Stock cannot be negative.')
        except ValueError:
            errors.append('Invalid stock.')
            stock = 0

        if errors:
            for e in errors:
                flash(e, 'error')
        else:
            db.session.add(Product(
                name=name, description=desc,
                price_usd=price, stock=stock,
                image_url=image_url, seller_id=current_user.id,
            ))
            db.session.commit()
            flash(f'"{name}" added to your store!', 'success')
            return redirect(url_for('dashboard'))

    return render_template('add_product.html')

@app.route('/product/<int:product_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_product(product_id):
    product = Product.query.get_or_404(product_id)
    if product.seller_id != current_user.id:
        flash('Access denied.', 'error')
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        product.name        = request.form.get('name', product.name).strip()
        product.description = request.form.get('description', '').strip()
        product.price_usd   = float(request.form.get('price_usd', product.price_usd))
        product.stock       = int(request.form.get('stock', product.stock))
        product.image_url   = request.form.get('image_url', '').strip()
        product.active      = 'active' in request.form
        db.session.commit()
        flash('Product updated.', 'success')
        return redirect(url_for('dashboard'))

    return render_template('add_product.html', product=product)

@app.route('/product/<int:product_id>/delete', methods=['POST'])
@login_required
def delete_product(product_id):
    product = Product.query.get_or_404(product_id)
    if product.seller_id != current_user.id:
        flash('Access denied.', 'error')
        return redirect(url_for('dashboard'))
    product.active = False
    db.session.commit()
    flash('Product removed from store.', 'success')
    return redirect(url_for('dashboard'))

@app.route('/order/<int:order_id>/status', methods=['POST'])
@login_required
def update_order_status(order_id):
    order = Order.query.get_or_404(order_id)
    if order.seller_id != current_user.id:
        return jsonify({'error': 'Access denied'}), 403
    new_status = request.form.get('status')
    if new_status in ('pending', 'paid', 'shipped', 'done'):
        order.status = new_status
        db.session.commit()
    return redirect(url_for('dashboard'))

# ----------------------------------------------------------------------
# 9.  Global error handler – shows traceback for debugging (remove later)
# ----------------------------------------------------------------------
@app.errorhandler(Exception)
def handle_exception(e):
    app.logger.error('Unhandled exception', exc_info=True)
    # Return the full stack trace (only for debugging – disable in production!)
    return traceback.format_exc(), 500

# ----------------------------------------------------------------------
# 10. Table creation – run this ONCE manually, not inside the request
#     Uncomment and run locally, or use a separate script.
# ----------------------------------------------------------------------
# with app.app_context():
#     db.create_all()
#     print("✅ Tables created (or already exist)")

# ----------------------------------------------------------------------
# 11. Vercel entry point – must expose `application`
# ----------------------------------------------------------------------
application = app  # Vercel looks for 'application' by default

# ----------------------------------------------------------------------
# 12. Local development server
# ----------------------------------------------------------------------
if __name__ == '__main__':
    app.run(debug=True)
