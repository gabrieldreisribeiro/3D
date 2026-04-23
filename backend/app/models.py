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
    production_days = Column(Integer, nullable=False, default=1)
    allow_colors = Column(Boolean, default=False)
    available_colors = Column(Text, nullable=False, default='')
    allow_secondary_color = Column(Boolean, default=False)
    secondary_color_pairs = Column(Text, nullable=False, default='')
    allow_name_personalization = Column(Boolean, default=False)
    width_mm = Column(Float, nullable=True)
    height_mm = Column(Float, nullable=True)
    depth_mm = Column(Float, nullable=True)
    dimensions_source = Column(String(20), nullable=False, default='manual')

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
    is_draft = Column(Boolean, default=False, index=True)
    generated_by_ai = Column(Boolean, default=False, index=True)
    source_ad_generation_id = Column(Integer, ForeignKey('ads_generation_history.id', ondelete='SET NULL'), nullable=True, index=True)

    category = relationship('Category', back_populates='products')
    reviews = relationship('ProductReview', back_populates='product', cascade='all, delete-orphan')
    events = relationship('UserEvent', back_populates='product')
    promotion_links = relationship('PromotionProduct', back_populates='product', cascade='all, delete-orphan')
    models_3d = relationship('Product3DModel', back_populates='product', cascade='all, delete-orphan')


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


class OrderFlowStage(Base):
    __tablename__ = 'order_flow_stages'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    description = Column(String(260), nullable=True)
    color = Column(String(30), nullable=True)
    icon_name = Column(String(60), nullable=True)
    sort_order = Column(Integer, nullable=False, default=1, index=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    is_visible_to_customer = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    orders = relationship('Order', back_populates='current_stage')
    history_entries = relationship('OrderStageHistory', back_populates='stage')


class Order(Base):
    __tablename__ = 'orders'

    id = Column(Integer, primary_key=True, index=True)
    customer_account_id = Column(Integer, ForeignKey('customer_accounts.id', ondelete='SET NULL'), nullable=True, index=True)
    customer_name = Column(String(120), nullable=True)
    customer_email_snapshot = Column(String(180), nullable=True, index=True)
    customer_phone_snapshot = Column(String(40), nullable=True, index=True)
    shipping_address_snapshot = Column(Text, nullable=True)
    coupon_code = Column(String(60), nullable=True)
    payment_status = Column(String(20), nullable=False, default='pending')
    payment_provider = Column(String(40), nullable=True)
    payment_method = Column(String(30), nullable=True)
    sales_channel = Column(String(30), nullable=False, default='whatsapp')
    order_nsu = Column(String(120), nullable=True, index=True)
    invoice_slug = Column(String(160), nullable=True, index=True)
    transaction_nsu = Column(String(160), nullable=True, index=True)
    receipt_url = Column(String(600), nullable=True)
    checkout_url = Column(String(600), nullable=True)
    capture_method = Column(String(40), nullable=True)
    paid_amount = Column(Float, nullable=True)
    installments = Column(Integer, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    current_stage_id = Column(Integer, ForeignKey('order_flow_stages.id', ondelete='SET NULL'), nullable=True, index=True)
    current_stage_updated_at = Column(DateTime, nullable=True)
    production_status = Column(String(20), nullable=True, index=True)
    production_started_at = Column(DateTime, nullable=True)
    estimated_ready_at = Column(DateTime, nullable=True, index=True)
    ready_at = Column(DateTime, nullable=True)
    payment_metadata_json = Column(Text, nullable=False, default='{}')
    subtotal = Column(Float, nullable=False)
    discount = Column(Float, nullable=False)
    total = Column(Float, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    items = relationship('OrderItem', back_populates='order', cascade='all, delete')
    customer_account = relationship('CustomerAccount', back_populates='orders')
    current_stage = relationship('OrderFlowStage', back_populates='orders')
    stage_history = relationship('OrderStageHistory', back_populates='order', cascade='all, delete-orphan', order_by='OrderStageHistory.created_at')


class OrderStageHistory(Base):
    __tablename__ = 'order_stage_history'

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey('orders.id', ondelete='CASCADE'), nullable=False, index=True)
    stage_id = Column(Integer, ForeignKey('order_flow_stages.id', ondelete='SET NULL'), nullable=True, index=True)
    stage_name_snapshot = Column(String(120), nullable=True)
    stage_description_snapshot = Column(String(260), nullable=True)
    stage_color_snapshot = Column(String(30), nullable=True)
    stage_icon_name_snapshot = Column(String(60), nullable=True)
    stage_sort_order_snapshot = Column(Integer, nullable=True)
    stage_visible_to_customer_snapshot = Column(Boolean, nullable=True)
    moved_by_admin_user_id = Column(Integer, ForeignKey('admin_users.id', ondelete='SET NULL'), nullable=True, index=True)
    note = Column(String(400), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now(), index=True)

    order = relationship('Order', back_populates='stage_history')
    stage = relationship('OrderFlowStage', back_populates='history_entries')
    moved_by_admin = relationship('AdminUser')


class OrderItem(Base):
    __tablename__ = 'order_items'

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey('orders.id', ondelete='CASCADE'))
    product_slug = Column(String(160), nullable=False)
    title = Column(String(160), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    line_total = Column(Float, nullable=False, default=0.0)
    production_days_snapshot = Column(Integer, nullable=False, default=1)
    selected_color = Column(String(20), nullable=True)
    selected_secondary_color = Column(String(20), nullable=True)
    selected_sub_items = Column(Text, nullable=False, default='')
    name_personalizations = Column(Text, nullable=False, default='')
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
    name = Column(String(160), nullable=False, default='Administrador')
    email = Column(String(120), unique=True, nullable=False, index=True)
    password_hash = Column(String(300), nullable=False)
    is_active = Column(Boolean, default=True)
    is_blocked = Column(Boolean, default=False)
    role = Column(String(20), nullable=False, default='super_admin')
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
    query_logs = relationship('DatabaseQueryLog', back_populates='admin')
    ads_generation_history = relationship('AdsGenerationHistory', back_populates='admin')
    system_logs = relationship('SystemLog', back_populates='admin')


class CustomerAccount(Base):
    __tablename__ = 'customer_accounts'

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(180), nullable=False)
    email = Column(String(180), nullable=False, unique=True, index=True)
    phone_number = Column(String(40), nullable=False, index=True)
    password_hash = Column(String(300), nullable=False)
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)
    phone_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
    last_login_at = Column(DateTime, nullable=True)

    orders = relationship('Order', back_populates='customer_account')


class CustomerPasswordResetToken(Base):
    __tablename__ = 'customer_password_reset_tokens'

    id = Column(Integer, primary_key=True, index=True)
    customer_account_id = Column(Integer, ForeignKey('customer_accounts.id', ondelete='CASCADE'), nullable=False, index=True)
    token = Column(String(220), nullable=False, unique=True, index=True)
    is_used = Column(Boolean, default=False, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())


class EmailProviderConfig(Base):
    __tablename__ = 'email_provider_config'

    id = Column(Integer, primary_key=True, index=True, default=1)
    provider_name = Column(String(80), nullable=False, default='smtp')
    smtp_host = Column(String(255), nullable=True)
    smtp_port = Column(Integer, nullable=False, default=587)
    smtp_username = Column(String(255), nullable=True)
    smtp_password = Column(String(500), nullable=True)
    smtp_use_tls = Column(Boolean, nullable=False, default=True)
    smtp_use_ssl = Column(Boolean, nullable=False, default=False)
    from_name = Column(String(180), nullable=True)
    from_email = Column(String(255), nullable=True)
    reply_to_email = Column(String(255), nullable=True)
    is_enabled = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())


class EmailTemplate(Base):
    __tablename__ = 'email_templates'

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(80), unique=True, nullable=False, index=True)
    name = Column(String(180), nullable=False)
    subject_template = Column(String(500), nullable=False)
    body_html_template = Column(Text, nullable=False)
    body_text_template = Column(Text, nullable=True)
    variables_json = Column(Text, nullable=False, default='[]')
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())


class EmailLog(Base):
    __tablename__ = 'email_logs'

    id = Column(Integer, primary_key=True, index=True)
    template_key = Column(String(80), nullable=True, index=True)
    recipient_email = Column(String(255), nullable=False, index=True)
    subject_rendered = Column(String(500), nullable=False)
    body_rendered_preview = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default='pending', index=True)
    error_message = Column(Text, nullable=True)
    related_entity_type = Column(String(80), nullable=True, index=True)
    related_entity_id = Column(String(80), nullable=True, index=True)
    metadata_json = Column(Text, nullable=False, default='{}')
    created_at = Column(DateTime, nullable=False, server_default=func.now(), index=True)
    sent_at = Column(DateTime, nullable=True)


class StoreSettings(Base):
    __tablename__ = 'store_settings'

    id = Column(Integer, primary_key=True, index=True, default=1)
    whatsapp_number = Column(String(30), nullable=True)
    pix_key = Column(String(160), nullable=True)
    favicon_url = Column(String(500), nullable=True)
    logs_enabled = Column(Boolean, default=True)
    logs_capture_request_body = Column(Boolean, default=True)
    logs_capture_response_body = Column(Boolean, default=False)
    logs_capture_integrations = Column(Boolean, default=True)
    logs_capture_webhooks = Column(Boolean, default=True)
    logs_min_level = Column(String(20), nullable=False, default='info')
    instagram_enabled = Column(Boolean, default=False)
    instagram_app_id = Column(String(120), nullable=True)
    instagram_app_secret = Column(String(220), nullable=True)
    instagram_access_token = Column(String(600), nullable=True)
    instagram_user_id = Column(String(120), nullable=True)
    instagram_page_id = Column(String(120), nullable=True)
    instagram_default_caption = Column(Text, nullable=True)
    instagram_default_hashtags = Column(Text, nullable=True)
    instagram_auto_publish_default = Column(Boolean, default=False)
    meta_pixel_enabled = Column(Boolean, default=False)
    meta_pixel_pixel_id = Column(String(64), nullable=True)
    meta_pixel_auto_page_view = Column(Boolean, default=True)
    meta_pixel_track_product_events = Column(Boolean, default=True)
    meta_pixel_track_cart_events = Column(Boolean, default=True)
    meta_pixel_track_whatsapp_as_lead = Column(Boolean, default=True)
    meta_pixel_track_order_created = Column(Boolean, default=True)
    meta_pixel_test_event_code = Column(String(120), nullable=True)


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


class UserEvent(Base):
    __tablename__ = 'user_events'

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(40), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey('products.id', ondelete='SET NULL'), nullable=True, index=True)
    category_id = Column(Integer, ForeignKey('categories.id', ondelete='SET NULL'), nullable=True, index=True)
    session_id = Column(String(120), nullable=False, index=True)
    user_identifier = Column(String(160), nullable=True, index=True)
    page_url = Column(String(500), nullable=True)
    source_channel = Column(String(80), nullable=True, index=True)
    referrer = Column(String(500), nullable=True)
    cta_name = Column(String(120), nullable=True, index=True)
    ip_address = Column(String(120), nullable=True, index=True)
    country = Column(String(120), nullable=True, index=True)
    state = Column(String(120), nullable=True, index=True)
    city = Column(String(120), nullable=True, index=True)
    metadata_json = Column(Text, nullable=False, default='{}')
    created_at = Column(DateTime, nullable=False, server_default=func.now(), index=True)

    product = relationship('Product', back_populates='events')


class AdsProviderConfig(Base):
    __tablename__ = 'ads_provider_config'

    id = Column(Integer, primary_key=True, index=True)
    provider_name = Column(String(80), nullable=False, default='nvidia')
    base_url = Column(String(400), nullable=False, default='https://integrate.api.nvidia.com/v1')
    api_key = Column(String(600), nullable=True)
    model_name = Column(String(200), nullable=False, default='qwen/qwen2.5-coder-7b-instruct')
    prompt_complement = Column(Text, nullable=True)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())


class AdsGenerationHistory(Base):
    __tablename__ = 'ads_generation_history'

    id = Column(Integer, primary_key=True, index=True)
    input_data_json = Column(Text, nullable=False, default='{}')
    output_data_json = Column(Text, nullable=False, default='{}')
    model_used = Column(String(200), nullable=False)
    admin_id = Column(Integer, ForeignKey('admin_users.id', ondelete='SET NULL'), nullable=True, index=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now(), index=True)

    admin = relationship('AdminUser', back_populates='ads_generation_history')
    products = relationship('Product')


class UploadedImage(Base):
    __tablename__ = 'uploaded_images'

    id = Column(Integer, primary_key=True, index=True)
    file_url = Column(String(500), unique=True, nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    mime_type = Column(String(120), nullable=True)
    original_url = Column(String(500), nullable=True)
    thumbnail_url = Column(String(500), nullable=True)
    medium_url = Column(String(500), nullable=True)
    large_url = Column(String(500), nullable=True)
    is_animated = Column(Boolean, nullable=False, default=False)
    optimized_format = Column(String(20), nullable=True)
    source = Column(String(60), nullable=False, default='unknown', index=True)
    size_bytes = Column(Integer, nullable=False, default=0)
    base64_data = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())


class Product3DModel(Base):
    __tablename__ = 'product_3d_models'

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey('products.id', ondelete='CASCADE'), nullable=True, index=True)
    sub_item_id = Column(String(80), nullable=True, index=True)
    name = Column(String(180), nullable=False)
    description = Column(Text, nullable=True)
    original_file_url = Column(String(500), nullable=True)
    preview_file_url = Column(String(500), nullable=False)
    width_mm = Column(Float, nullable=True)
    height_mm = Column(Float, nullable=True)
    depth_mm = Column(Float, nullable=True)
    dimensions_source = Column(String(20), nullable=False, default='auto')
    allow_download = Column(Boolean, default=False)
    show_to_customer = Column(Boolean, nullable=False, default=False, index=True)
    sort_order = Column(Integer, nullable=False, default=1, index=True)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    product = relationship('Product', back_populates='models_3d')


class HighlightItem(Base):
    __tablename__ = 'highlight_items'

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(180), nullable=False)
    description = Column(Text, nullable=False)
    icon_name = Column(String(60), nullable=False)
    sort_order = Column(Integer, nullable=False, default=1, index=True)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())


class PublicationDraft(Base):
    __tablename__ = 'publication_drafts'

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(40), nullable=False, index=True)
    entity_id = Column(Integer, nullable=True, index=True)
    action = Column(String(20), nullable=False, default='update')
    payload_json = Column(Text, nullable=False, default='{}')
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())


class Promotion(Base):
    __tablename__ = 'promotions'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(180), nullable=False)
    description = Column(Text, nullable=True)
    discount_type = Column(String(20), nullable=False)
    discount_value = Column(Float, nullable=False, default=0.0)
    applies_to_all = Column(Boolean, default=False, index=True)
    is_active = Column(Boolean, default=True, index=True)
    start_at = Column(DateTime, nullable=True, index=True)
    end_at = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
    product_links = relationship('PromotionProduct', back_populates='promotion', cascade='all, delete-orphan')


class PromotionProduct(Base):
    __tablename__ = 'promotion_products'

    id = Column(Integer, primary_key=True, index=True)
    promotion_id = Column(Integer, ForeignKey('promotions.id', ondelete='CASCADE'), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey('products.id', ondelete='CASCADE'), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    promotion = relationship('Promotion', back_populates='product_links')
    product = relationship('Product', back_populates='promotion_links')


class PaymentProviderInfinitePayConfig(Base):
    __tablename__ = 'payment_provider_infinitepay_config'

    id = Column(Integer, primary_key=True, index=True, default=1)
    is_enabled = Column(Boolean, nullable=False, default=False)
    handle = Column(String(120), nullable=True)
    redirect_url = Column(String(500), nullable=True)
    webhook_url = Column(String(500), nullable=True)
    default_currency = Column(String(10), nullable=False, default='BRL')
    success_page_url = Column(String(500), nullable=True)
    cancel_page_url = Column(String(500), nullable=True)
    test_mode = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())


class SystemLog(Base):
    __tablename__ = 'system_logs'

    id = Column(Integer, primary_key=True, index=True)
    level = Column(String(20), nullable=False, default='info', index=True)
    category = Column(String(40), nullable=False, default='http', index=True)
    action_name = Column(String(160), nullable=True, index=True)
    request_method = Column(String(10), nullable=True, index=True)
    request_path = Column(String(500), nullable=True, index=True)
    request_query = Column(Text, nullable=True)
    request_headers_json = Column(Text, nullable=False, default='{}')
    request_body_json = Column(Text, nullable=True)
    response_status = Column(Integer, nullable=True, index=True)
    response_headers_json = Column(Text, nullable=False, default='{}')
    response_body_json = Column(Text, nullable=True)
    duration_ms = Column(Float, nullable=True)
    response_size_bytes = Column(Integer, nullable=True)
    admin_user_id = Column(Integer, ForeignKey('admin_users.id', ondelete='SET NULL'), nullable=True, index=True)
    session_id = Column(String(160), nullable=True, index=True)
    ip_address = Column(String(120), nullable=True, index=True)
    user_agent = Column(String(600), nullable=True)
    entity_type = Column(String(80), nullable=True, index=True)
    entity_id = Column(String(80), nullable=True, index=True)
    source_system = Column(String(80), nullable=True, index=True)
    error_message = Column(Text, nullable=True)
    stack_trace = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=False, default='{}')
    created_at = Column(DateTime, nullable=False, server_default=func.now(), index=True)

    admin = relationship('AdminUser', back_populates='system_logs')
