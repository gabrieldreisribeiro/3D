from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship
from app.db.session import Base


class Product(Base):
    __tablename__ = 'products'

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(160), nullable=False)
    slug = Column(String(160), unique=True, nullable=False, index=True)
    short_description = Column(String(260), nullable=False)
    full_description = Column(Text, nullable=False)
    price = Column(Float, nullable=False)
    cover_image = Column(String(320), nullable=False)
    images = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    rating_average = Column(Float, default=5.0)
    rating_count = Column(Integer, default=0)


class Coupon(Base):
    __tablename__ = 'coupons'

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(60), unique=True, nullable=False)
    type = Column(String(30), nullable=False)
    value = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)


class Order(Base):
    __tablename__ = 'orders'

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String(120), nullable=True)
    coupon_code = Column(String(60), nullable=True)
    subtotal = Column(Float, nullable=False)
    discount = Column(Float, nullable=False)
    total = Column(Float, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    items = relationship('OrderItem', back_populates='order', cascade='all, delete')


class OrderItem(Base):
    __tablename__ = 'order_items'

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey('orders.id', ondelete='CASCADE'))
    product_slug = Column(String(160), nullable=False)
    title = Column(String(160), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    order = relationship('Order', back_populates='items')


class AdminUser(Base):
    __tablename__ = 'admin_users'

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(120), unique=True, nullable=False, index=True)
    password_hash = Column(String(300), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
