from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship
from app.db.session import Base


class Category(Base):
    __tablename__ = 'categories'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    slug = Column(String(120), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    products = relationship('Product', back_populates='category')


class Product(Base):
    __tablename__ = 'products'

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(160), nullable=False)
    slug = Column(String(160), unique=True, nullable=False, index=True)
    short_description = Column(String(260), nullable=False)
    full_description = Column(Text, nullable=False)
    price = Column(Float, nullable=False, default=0.0)
    cover_image = Column(String(320), nullable=False)
    images = Column(Text, nullable=False)
    sub_items = Column(Text, nullable=False, default='')
    is_active = Column(Boolean, default=True)
    rating_average = Column(Float, default=5.0)
    rating_count = Column(Integer, default=0)
    category_id = Column(Integer, ForeignKey('categories.id'), nullable=True, index=True)

    grams_filament = Column(Float, default=0.0)
    price_kg_filament = Column(Float, default=0.0)
    hours_printing = Column(Float, default=0.0)
    avg_power_watts = Column(Float, default=0.0)
    price_kwh = Column(Float, default=0.0)
    total_hours_labor = Column(Float, default=0.0)
    price_hour_labor = Column(Float, default=0.0)
    extra_cost = Column(Float, default=0.0)
    profit_margin = Column(Float, default=0.0)

    cost_total = Column(Float, default=0.0)
    calculated_price = Column(Float, default=0.0)
    estimated_profit = Column(Float, default=0.0)
    manual_price = Column(Float, nullable=True)
    final_price = Column(Float, default=0.0)

    category = relationship('Category', back_populates='products')


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


class Banner(Base):
    __tablename__ = 'banners'

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(160), nullable=True)
    subtitle = Column(String(260), nullable=True)
    image_url = Column(String(400), nullable=False)
    target_url = Column(String(400), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    show_in_carousel = Column(Boolean, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())


class AdminUser(Base):
    __tablename__ = 'admin_users'

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(120), unique=True, nullable=False, index=True)
    password_hash = Column(String(300), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
