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
    lead_time_hours = Column(Float, default=0.0)
    allow_colors = Column(Boolean, default=False)
    available_colors = Column(Text, nullable=False, default='')
    allow_secondary_color = Column(Boolean, default=False)
    secondary_color_pairs = Column(Text, nullable=False, default='')

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
    publish_to_instagram = Column(Boolean, default=False)
    instagram_caption = Column(Text, nullable=True)
    instagram_hashtags = Column(Text, nullable=True)
    instagram_post_status = Column(String(30), nullable=False, default='not_published')
    instagram_post_id = Column(String(120), nullable=True)
    instagram_published_at = Column(DateTime, nullable=True)
    instagram_error_message = Column(Text, nullable=True)

    category = relationship('Category', back_populates='products')
    reviews = relationship('ProductReview', back_populates='product', cascade='all, delete-orphan')


class Coupon(Base):
    __tablename__ = 'coupons'

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(60), unique=True, nullable=False)
    type = Column(String(30), nullable=False)
    value = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime, nullable=True)
    max_uses = Column(Integer, nullable=True)
    uses_count = Column(Integer, nullable=False, default=0)
    usages = relationship('CouponUsage', back_populates='coupon', cascade='all, delete')


class CouponUsage(Base):
    __tablename__ = 'coupon_usages'

    id = Column(Integer, primary_key=True, index=True)
    coupon_id = Column(Integer, ForeignKey('coupons.id', ondelete='CASCADE'), nullable=False, index=True)
    client_hash = Column(String(128), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey('orders.id', ondelete='SET NULL'), nullable=True, index=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    coupon = relationship('Coupon', back_populates='usages')


class Order(Base):
    __tablename__ = 'orders'

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String(120), nullable=True)
    coupon_code = Column(String(60), nullable=True)
    payment_status = Column(String(20), nullable=False, default='pending')
    payment_method = Column(String(30), nullable=True)
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
    line_total = Column(Float, nullable=False, default=0.0)
    selected_color = Column(String(20), nullable=True)
    selected_secondary_color = Column(String(20), nullable=True)
    selected_sub_items = Column(Text, nullable=False, default='')
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
    query_logs = relationship('DatabaseQueryLog', back_populates='admin')


class StoreSettings(Base):
    __tablename__ = 'store_settings'

    id = Column(Integer, primary_key=True, index=True, default=1)
    whatsapp_number = Column(String(30), nullable=True)
    pix_key = Column(String(160), nullable=True)
    instagram_enabled = Column(Boolean, default=False)
    instagram_app_id = Column(String(120), nullable=True)
    instagram_app_secret = Column(String(220), nullable=True)
    instagram_access_token = Column(String(600), nullable=True)
    instagram_user_id = Column(String(120), nullable=True)
    instagram_page_id = Column(String(120), nullable=True)
    instagram_default_caption = Column(Text, nullable=True)
    instagram_default_hashtags = Column(Text, nullable=True)
    instagram_auto_publish_default = Column(Boolean, default=False)


class ProductReview(Base):
    __tablename__ = 'product_reviews'

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey('products.id', ondelete='CASCADE'), nullable=False, index=True)
    author_name = Column(String(120), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default='pending', index=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    product = relationship('Product', back_populates='reviews')
    media = relationship('ProductReviewMedia', back_populates='review', cascade='all, delete-orphan')


class ProductReviewMedia(Base):
    __tablename__ = 'product_review_media'

    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey('product_reviews.id', ondelete='CASCADE'), nullable=False, index=True)
    media_type = Column(String(20), nullable=False)
    file_path = Column(String(400), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    review = relationship('ProductReview', back_populates='media')


class DatabaseQueryLog(Base):
    __tablename__ = 'database_query_logs'

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey('admin_users.id', ondelete='SET NULL'), nullable=True, index=True)
    sql_text = Column(Text, nullable=False)
    mode = Column(String(20), nullable=False, default='read')
    query_type = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default='success')
    affected_rows = Column(Integer, nullable=False, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    admin = relationship('AdminUser', back_populates='query_logs')
