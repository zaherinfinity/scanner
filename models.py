from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime

db = SQLAlchemy()


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    shop_name = db.Column(db.String(100), nullable=False)
    bakong_account = db.Column(db.String(100), nullable=False)  # e.g. yourname@bakong
    phone = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    products = db.relationship('Product', backref='seller', lazy=True)
    orders_received = db.relationship(
        'Order', backref='seller', lazy=True, foreign_keys='Order.seller_id'
    )


class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    price_usd = db.Column(db.Float, nullable=False)
    stock = db.Column(db.Integer, default=0)
    image_url = db.Column(db.String(300), default='')
    seller_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    active = db.Column(db.Boolean, default=True)


class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    buyer_name = db.Column(db.String(100), nullable=False)
    buyer_phone = db.Column(db.String(20))
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    seller_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    quantity = db.Column(db.Integer, default=1)
    total_usd = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, paid, shipped, done
    khqr_data = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    product = db.relationship('Product', backref='orders')
