from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    is_active: bool

class AdminCategoryBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    slug: str = Field(..., min_length=2, max_length=120)
    is_active: bool = True


class AdminCategoryCreate(AdminCategoryBase):
    pass


class AdminCategoryUpdate(AdminCategoryBase):
    pass


class AdminCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    is_active: bool


class SecondaryColorPair(BaseModel):
    primary: str = Field(..., min_length=4, max_length=7)
    secondary: str = Field(..., min_length=4, max_length=7)


class ProductSubItem(BaseModel):
    id: Optional[str] = Field(default=None, max_length=80)
    title: str = Field(..., min_length=1, max_length=140)
    image_url: Optional[str] = None
    pricing_mode: Literal['manual', 'calculated'] = 'manual'
    width_mm: Optional[float] = Field(default=None, ge=0)
    height_mm: Optional[float] = Field(default=None, ge=0)
    depth_mm: Optional[float] = Field(default=None, ge=0)
    dimensions_source: Literal['manual', 'model'] = 'manual'
    lead_time_hours: float = Field(default=0, ge=0)
    allow_colors: bool = False
    available_colors: List[str] = Field(default_factory=list)
    allow_secondary_color: bool = False
    secondary_color_pairs: List[SecondaryColorPair] = Field(default_factory=list)

    grams_filament: float = Field(default=0, ge=0)
    price_kg_filament: float = Field(default=0, ge=0)
    hours_printing: float = Field(default=0, ge=0)
    avg_power_watts: float = Field(default=0, ge=0)
    price_kwh: float = Field(default=0, ge=0)
    total_hours_labor: float = Field(default=0, ge=0)
    price_hour_labor: float = Field(default=0, ge=0)
    extra_cost: float = Field(default=0, ge=0)
    profit_margin: float = Field(default=0, ge=0, lt=100)
    manual_price: Optional[float] = Field(default=None, ge=0)

    cost_total: float = 0
    calculated_price: float = 0
    estimated_profit: float = 0
    final_price: float = 0


class ProductBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    short_description: str
    full_description: str
    cover_image: str
    images: List[str]
    sub_items: List[ProductSubItem]
    is_active: bool
    rating_average: float
    rating_count: int
    category_id: Optional[int] = None
    lead_time_hours: float
    allow_colors: bool
    available_colors: List[str]
    allow_secondary_color: bool
    secondary_color_pairs: List[SecondaryColorPair]
    allow_name_personalization: bool
    width_mm: Optional[float] = None
    height_mm: Optional[float] = None
    depth_mm: Optional[float] = None
    dimensions_source: Literal['manual', 'model'] = 'manual'

    price: float
    final_price: float
    calculated_price: float
    cost_total: float
    estimated_profit: float
    is_on_sale: bool = False
    original_price: Optional[float] = None
    promotional_price: Optional[float] = None
    promotion_badge: Optional[str] = None

class ProductResponse(ProductBase):
    pass


class BannerBase(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    image_url: str = Field(..., min_length=5)
    target_url: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True
    show_in_carousel: bool = True


class BannerCreate(BannerBase):
    pass


class BannerUpdate(BannerBase):
    pass


class BannerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: Optional[str]
    subtitle: Optional[str]
    image_url: str
    target_url: Optional[str]
    sort_order: int
    is_active: bool
    show_in_carousel: bool
    created_at: Optional[datetime]
    publication_status: Optional[str] = None
    draft_id: Optional[int] = None


class HighlightItemBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=180)
    description: str = Field(..., min_length=1, max_length=1000)
    icon_name: str = Field(..., min_length=2, max_length=60)
    sort_order: int = Field(default=1, ge=1, le=3)
    is_active: bool = True


class HighlightItemCreate(HighlightItemBase):
    pass


class HighlightItemUpdate(HighlightItemBase):
    pass


class HighlightItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    icon_name: str
    sort_order: int
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    publication_status: Optional[str] = None
    draft_id: Optional[int] = None

class AdminProductBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=160)
    slug: str = Field(..., min_length=2, max_length=160)
    short_description: str = Field(..., min_length=2, max_length=260)
    full_description: str = Field(..., min_length=2)
    cover_image: str = Field(..., min_length=5)
    images: List[str] = Field(default_factory=list)
    sub_items: List[ProductSubItem] = Field(default_factory=list)
    is_active: bool = True
    category_id: Optional[int] = Field(default=None)
    lead_time_hours: float = Field(default=0, ge=0)
    allow_colors: bool = False
    available_colors: List[str] = Field(default_factory=list)
    allow_secondary_color: bool = False
    secondary_color_pairs: List[SecondaryColorPair] = Field(default_factory=list)
    allow_name_personalization: bool = False
    width_mm: Optional[float] = Field(default=None, ge=0)
    height_mm: Optional[float] = Field(default=None, ge=0)
    depth_mm: Optional[float] = Field(default=None, ge=0)
    dimensions_source: Literal['manual', 'model'] = 'manual'

    grams_filament: float = Field(default=0, ge=0)
    price_kg_filament: float = Field(default=0, ge=0)
    hours_printing: float = Field(default=0, ge=0)
    avg_power_watts: float = Field(default=0, ge=0)
    price_kwh: float = Field(default=0, ge=0)
    total_hours_labor: float = Field(default=0, ge=0)
    price_hour_labor: float = Field(default=0, ge=0)
    extra_cost: float = Field(default=0, ge=0)
    profit_margin: float = Field(default=0, ge=0, lt=100)
    manual_price: Optional[float] = Field(default=None, ge=0)
    publish_to_instagram: bool = False
    instagram_caption: Optional[str] = None
    instagram_hashtags: Optional[str] = None
    is_draft: Optional[bool] = None
    generated_by_ai: Optional[bool] = None
    source_ad_generation_id: Optional[int] = None


class AdminProductCreate(AdminProductBase):
    pass


class AdminProductUpdate(AdminProductBase):
    pass


class AdminProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    short_description: str
    full_description: str
    cover_image: str
    images: List[str]
    sub_items: List[ProductSubItem]
    is_active: bool
    category_id: Optional[int] = None
    lead_time_hours: float
    allow_colors: bool
    available_colors: List[str]
    allow_secondary_color: bool
    secondary_color_pairs: List[SecondaryColorPair]
    allow_name_personalization: bool
    width_mm: Optional[float] = None
    height_mm: Optional[float] = None
    depth_mm: Optional[float] = None
    dimensions_source: Literal['manual', 'model'] = 'manual'

    grams_filament: float
    price_kg_filament: float
    hours_printing: float
    avg_power_watts: float
    price_kwh: float
    total_hours_labor: float
    price_hour_labor: float
    extra_cost: float
    profit_margin: float
    manual_price: Optional[float] = None

    cost_total: float
    calculated_price: float
    estimated_profit: float
    final_price: float
    price: float
    publish_to_instagram: bool
    instagram_caption: Optional[str] = None
    instagram_hashtags: Optional[str] = None
    instagram_post_status: str
    instagram_post_id: Optional[str] = None
    instagram_published_at: Optional[datetime] = None
    instagram_error_message: Optional[str] = None
    is_draft: bool
    generated_by_ai: bool
    source_ad_generation_id: Optional[int] = None
    publication_status: Optional[str] = None
    draft_id: Optional[int] = None

class CouponRequest(BaseModel):
    code: str


class CouponResponse(BaseModel):
    code: str
    type: str
    value: float
    expires_at: Optional[datetime] = None
    max_uses: Optional[int] = None
    uses_count: int = 0


class AdminCouponBase(BaseModel):
    code: str = Field(..., min_length=2, max_length=60)
    type: Literal['percent', 'fixed']
    value: float = Field(..., gt=0)
    is_active: bool = True
    expires_at: Optional[datetime] = None
    max_uses: Optional[int] = Field(default=None, ge=1)


class AdminCouponCreate(AdminCouponBase):
    pass


class AdminCouponUpdate(AdminCouponBase):
    pass


class AdminCouponResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    type: str
    value: float
    is_active: bool
    expires_at: Optional[datetime] = None
    max_uses: Optional[int] = None
    uses_count: int = 0


class PromotionBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=180)
    description: Optional[str] = None
    discount_type: Literal['percentage', 'fixed']
    discount_value: float = Field(..., gt=0)
    applies_to_all: bool = False
    is_active: bool = True
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    product_ids: List[int] = Field(default_factory=list)


class PromotionCreate(PromotionBase):
    pass


class PromotionUpdate(PromotionBase):
    pass


class PromotionResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    discount_type: str
    discount_value: float
    applies_to_all: bool
    is_active: bool
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    status: Literal['active', 'scheduled', 'ended', 'inactive']
    promotion_badge: str
    product_ids: List[int] = Field(default_factory=list)
    affected_products_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    publication_status: Optional[str] = None
    draft_id: Optional[int] = None


class PublicationPendingItemResponse(BaseModel):
    draft_id: int
    entity_type: str
    entity_id: Optional[int] = None
    action: str
    status: str
    title: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class PublicationActionResponse(BaseModel):
    ok: bool = True
    message: str = ''
    published_count: int = 0
    published_at: Optional[str] = None

class OrderItemCreate(BaseModel):
    model_config = ConfigDict(extra='ignore')

    slug: str
    quantity: int = Field(..., gt=0)
    unit_price: Optional[float] = Field(default=None, ge=0)
    selected_color: Optional[str] = None
    selected_secondary_color: Optional[str] = None
    selected_sub_items: List[dict] = Field(default_factory=list)
    name_personalizations: List[str] = Field(default_factory=list)


class OrderCreate(BaseModel):
    items: List[OrderItemCreate]
    coupon: Optional[str] = None
    payment_status: Literal['pending', 'pending_payment', 'paid', 'failed', 'canceled', 'awaiting_confirmation'] = 'pending'
    payment_method: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    shipping_address_snapshot: dict = Field(default_factory=dict)


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_slug: str
    title: str
    quantity: int
    unit_price: float
    line_total: float
    selected_color: Optional[str] = None
    selected_secondary_color: Optional[str] = None
    selected_sub_items: List[dict] = Field(default_factory=list)
    name_personalizations: List[str] = Field(default_factory=list)

class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subtotal: float
    discount: float
    total: float
    coupon_code: Optional[str]
    payment_status: str
    payment_provider: Optional[str]
    payment_method: Optional[str]
    sales_channel: Optional[str]
    order_nsu: Optional[str] = None
    invoice_slug: Optional[str] = None
    transaction_nsu: Optional[str] = None
    receipt_url: Optional[str] = None
    checkout_url: Optional[str] = None
    capture_method: Optional[str] = None
    paid_amount: Optional[float] = None
    installments: Optional[int] = None
    paid_at: Optional[datetime] = None
    payment_metadata_json: Optional[str] = None
    customer_account_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_email_snapshot: Optional[str] = None
    customer_phone_snapshot: Optional[str] = None
    shipping_address_snapshot: Optional[str] = None
    items: List[OrderItemResponse]

class AdminLoginRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=6)


class AdminAuthUserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: Literal['admin', 'super_admin']
    is_active: bool
    is_blocked: bool


class AdminLoginResponse(BaseModel):
    token: str
    admin: AdminAuthUserResponse


class AdminUserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: Literal['admin', 'super_admin']
    is_active: bool
    is_blocked: bool
    last_login_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AdminUserCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=160)
    email: str = Field(..., min_length=5, max_length=120)
    password: str = Field(..., min_length=6, max_length=72)
    role: Literal['admin', 'super_admin'] = 'admin'
    is_active: bool = True

    @field_validator('email')
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if '@' not in normalized or normalized.startswith('@') or normalized.endswith('@'):
            raise ValueError('Informe um e-mail valido')
        return normalized


class AdminUserUpdateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=160)
    email: str = Field(..., min_length=5, max_length=120)
    role: Literal['admin', 'super_admin']
    is_active: bool = True

    @field_validator('email')
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if '@' not in normalized or normalized.startswith('@') or normalized.endswith('@'):
            raise ValueError('Informe um e-mail valido')
        return normalized


class AdminUserPasswordUpdateRequest(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=72)


class Product3DModelBase(BaseModel):
    sub_item_id: Optional[str] = Field(default=None, max_length=80)
    name: str = Field(..., min_length=2, max_length=180)
    description: Optional[str] = Field(default=None, max_length=2000)
    original_file_url: Optional[str] = Field(default=None, max_length=500)
    preview_file_url: str = Field(..., min_length=5, max_length=500)
    width_mm: Optional[float] = Field(default=None, ge=0)
    height_mm: Optional[float] = Field(default=None, ge=0)
    depth_mm: Optional[float] = Field(default=None, ge=0)
    dimensions_source: Literal['manual', 'auto'] = 'auto'
    allow_download: bool = False
    sort_order: int = Field(default=1, ge=1, le=999)
    is_active: bool = True


class Product3DModelCreate(Product3DModelBase):
    pass


class Product3DModelUpdate(Product3DModelBase):
    pass


class Product3DModelResponse(Product3DModelBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: Optional[int] = None
    sub_item_title: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class Product3DModelUploadResponse(BaseModel):
    url: str
    width_mm: Optional[float] = None
    height_mm: Optional[float] = None
    depth_mm: Optional[float] = None
    dimensions_extracted: bool = False


class Admin3DModelResponse(Product3DModelResponse):
    product_title: Optional[str] = None
    product_slug: Optional[str] = None
    original_file_name: Optional[str] = None
    preview_file_name: Optional[str] = None


class Admin3DModelCreateRequest(Product3DModelCreate):
    product_id: Optional[int] = Field(default=None, ge=1)


class Admin3DModelUpdateRequest(Product3DModelUpdate):
    product_id: Optional[int] = Field(default=None, ge=1)


class AdminOrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_slug: str
    title: str
    quantity: int
    unit_price: float
    line_total: float
    selected_color: Optional[str] = None
    selected_secondary_color: Optional[str] = None
    selected_sub_items: List[dict] = Field(default_factory=list)
    name_personalizations: List[str] = Field(default_factory=list)


class AdminOrderResponse(BaseModel):
    id: int
    subtotal: float
    discount: float
    total: float
    coupon_code: Optional[str]
    payment_status: str
    payment_provider: Optional[str]
    payment_method: Optional[str]
    sales_channel: Optional[str]
    order_nsu: Optional[str] = None
    invoice_slug: Optional[str] = None
    transaction_nsu: Optional[str] = None
    receipt_url: Optional[str] = None
    checkout_url: Optional[str] = None
    capture_method: Optional[str] = None
    paid_amount: Optional[float] = None
    installments: Optional[int] = None
    paid_at: Optional[datetime] = None
    payment_metadata_json: Optional[str] = None
    customer_account_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_email_snapshot: Optional[str] = None
    customer_phone_snapshot: Optional[str] = None
    shipping_address_snapshot: Optional[str] = None
    created_at: Optional[datetime]
    items: List[AdminOrderItemResponse]


class CustomerAccountResponse(BaseModel):
    id: int
    full_name: str
    email: str
    phone_number: str
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None


class CustomerRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=180)
    email: str = Field(..., min_length=5, max_length=180)
    phone_number: str = Field(..., min_length=8, max_length=40)
    password: str = Field(..., min_length=6, max_length=72)
    confirm_password: str = Field(..., min_length=6, max_length=72)
    link_legacy_orders: bool = True


class CustomerLoginRequest(BaseModel):
    identifier: str = Field(..., min_length=3, max_length=180)
    password: str = Field(..., min_length=6, max_length=72)
    link_legacy_orders: bool = True


class CustomerAuthResponse(BaseModel):
    token: str
    customer: CustomerAccountResponse
    linked_orders_count: int = 0


class CustomerForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=180)


class CustomerForgotPasswordResponse(BaseModel):
    ok: bool = True
    message: str
    reset_token: Optional[str] = None


class CustomerResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=12, max_length=260)
    new_password: str = Field(..., min_length=6, max_length=72)
    confirm_password: str = Field(..., min_length=6, max_length=72)


class CustomerUpdateProfileRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=180)
    email: str = Field(..., min_length=5, max_length=180)
    phone_number: str = Field(..., min_length=8, max_length=40)


class CustomerChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=6, max_length=72)
    new_password: str = Field(..., min_length=6, max_length=72)
    confirm_password: str = Field(..., min_length=6, max_length=72)


class CustomerOrderListItem(BaseModel):
    id: int
    total: float
    subtotal: float
    discount: float
    payment_status: str
    payment_method: Optional[str] = None
    payment_provider: Optional[str] = None
    sales_channel: Optional[str] = None
    created_at: Optional[datetime] = None
    receipt_url: Optional[str] = None


class CustomerOrderListResponse(BaseModel):
    items: List[CustomerOrderListItem]
    total: int
    page: int
    page_size: int


class CustomerLinkLegacyOrdersResponse(BaseModel):
    linked_orders_count: int = 0
    message: str


class DashboardSeriesPoint(BaseModel):
    label: str
    value: float


class DashboardTopProduct(BaseModel):
    title: str
    quantity: int
    total_value: Optional[float] = None


class DashboardStatusPoint(BaseModel):
    status: str
    value: int


class AdminDashboardSummary(BaseModel):
    total_products: int
    total_orders: int
    total_sold: float
    total_items_sold: int = 0
    conversion_add_to_whatsapp: float = 0
    sales_series: List[DashboardSeriesPoint]
    orders_series: List[DashboardSeriesPoint]
    top_products: List[DashboardTopProduct]
    order_status: List[DashboardStatusPoint]
    funnel: List[DashboardSeriesPoint] = Field(default_factory=list)
    most_viewed_products: List[DashboardTopProduct] = Field(default_factory=list)
    most_added_products: List[DashboardTopProduct] = Field(default_factory=list)
    geolocated_sessions: int = 0
    top_countries: List[DashboardSeriesPoint] = Field(default_factory=list)
    top_states: List[DashboardSeriesPoint] = Field(default_factory=list)
    top_cities: List[DashboardSeriesPoint] = Field(default_factory=list)
    payment_method_counts: List[DashboardSeriesPoint] = Field(default_factory=list)
    payment_method_values: List[DashboardSeriesPoint] = Field(default_factory=list)
    payment_method_share: List[DashboardSeriesPoint] = Field(default_factory=list)
    whatsapp_orders: int = 0
    pix_orders: int = 0
    credit_card_orders: int = 0
    whatsapp_total: float = 0
    pix_total: float = 0
    credit_card_total: float = 0


class LogoResponse(BaseModel):
    url: Optional[str]


class StoreSettingsBase(BaseModel):
    whatsapp_number: Optional[str] = None
    pix_key: Optional[str] = None


class StoreSettingsUpdate(StoreSettingsBase):
    pass


class StoreSettingsResponse(StoreSettingsBase):
    favicon_url: Optional[str] = None


class InfinitePayConfigBase(BaseModel):
    enabled: bool = False
    handle: Optional[str] = None
    redirect_url: Optional[str] = None
    webhook_url: Optional[str] = None
    default_currency: str = 'BRL'
    success_page_url: Optional[str] = None
    cancel_page_url: Optional[str] = None
    test_mode: bool = False


class InfinitePayConfigUpdate(InfinitePayConfigBase):
    pass


class InfinitePayConfigResponse(InfinitePayConfigBase):
    id: int = 1
    is_ready: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class InfinitePayConnectionTestResponse(BaseModel):
    ok: bool
    message: str


class EmailProviderConfigBase(BaseModel):
    provider_name: str = 'smtp'
    smtp_host: Optional[str] = None
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False
    from_name: Optional[str] = None
    from_email: Optional[str] = None
    reply_to_email: Optional[str] = None
    is_enabled: bool = False


class EmailProviderConfigUpdate(EmailProviderConfigBase):
    pass


class EmailProviderConfigResponse(BaseModel):
    id: int = 1
    provider_name: str = 'smtp'
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_username: Optional[str] = None
    has_smtp_password: bool = False
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False
    from_name: Optional[str] = None
    from_email: Optional[str] = None
    reply_to_email: Optional[str] = None
    is_enabled: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class EmailSendTestRequest(BaseModel):
    recipient_email: str = Field(..., min_length=5, max_length=255)


class EmailSendTestResponse(BaseModel):
    ok: bool
    message: str


class EmailTemplateBase(BaseModel):
    key: str = Field(..., min_length=2, max_length=80)
    name: str = Field(..., min_length=2, max_length=180)
    subject_template: str = Field(..., min_length=2, max_length=500)
    body_html_template: str = Field(..., min_length=2)
    body_text_template: Optional[str] = None
    variables: List[str] = Field(default_factory=list)
    is_active: bool = True


class EmailTemplateUpdateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=180)
    subject_template: str = Field(..., min_length=2, max_length=500)
    body_html_template: str = Field(..., min_length=2)
    body_text_template: Optional[str] = None
    variables: List[str] = Field(default_factory=list)
    is_active: bool = True


class EmailTemplateResponse(EmailTemplateBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class EmailTemplatePreviewRequest(BaseModel):
    variables: dict = Field(default_factory=dict)


class EmailTemplatePreviewResponse(BaseModel):
    template_key: str
    subject_rendered: str
    body_html_rendered: str
    body_text_rendered: str
    missing_variables: List[str] = Field(default_factory=list)


class EmailLogResponse(BaseModel):
    id: int
    template_key: Optional[str] = None
    recipient_email: str
    subject_rendered: str
    body_rendered_preview: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[str] = None
    metadata_json: dict = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None


class EmailLogListResponse(BaseModel):
    items: List[EmailLogResponse]
    total: int
    page: int
    page_size: int


class InstagramSettingsBase(BaseModel):
    instagram_enabled: bool = False
    instagram_app_id: Optional[str] = None
    instagram_app_secret: Optional[str] = None
    instagram_access_token: Optional[str] = None
    instagram_user_id: Optional[str] = None
    instagram_page_id: Optional[str] = None
    instagram_default_caption: Optional[str] = None
    instagram_default_hashtags: Optional[str] = None
    instagram_auto_publish_default: bool = False


class InstagramSettingsUpdate(InstagramSettingsBase):
    pass


class InstagramSettingsResponse(InstagramSettingsBase):
    pass


class InstagramConnectionTestResponse(BaseModel):
    ok: bool
    message: str
    account_id: Optional[str] = None
    account_name: Optional[str] = None


class MetaPixelConfigBase(BaseModel):
    enabled: bool = False
    pixel_id: Optional[str] = None
    auto_page_view: bool = True
    track_product_events: bool = True
    track_cart_events: bool = True
    track_whatsapp_as_lead: bool = True
    track_order_created: bool = True
    test_event_code: Optional[str] = None


class MetaPixelAdminConfigUpdate(MetaPixelConfigBase):
    pass


class MetaPixelAdminConfigResponse(MetaPixelConfigBase):
    is_valid: bool = False


class MetaPixelPublicConfigResponse(BaseModel):
    enabled: bool = False
    pixel_id: Optional[str] = None
    auto_page_view: bool = True
    track_product_events: bool = True
    track_cart_events: bool = True
    track_whatsapp_as_lead: bool = True
    track_order_created: bool = True


class MetaPixelValidationResponse(BaseModel):
    ok: bool
    message: str


class ProductReviewMediaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    media_type: str
    file_path: str
    sort_order: int
    created_at: Optional[datetime] = None


class ProductReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    author_name: str
    rating: int
    comment: str
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    media: List[ProductReviewMediaResponse] = Field(default_factory=list)
    photos: List[str] = Field(default_factory=list)
    video: Optional[str] = None
    has_media: bool = False


class ProductReviewListResponse(BaseModel):
    items: List[ProductReviewResponse]
    total: int
    page: int
    page_size: int


class ProductReviewSummaryResponse(BaseModel):
    average_rating: float = 0
    total_reviews: int = 0
    count_5: int = 0
    count_4: int = 0
    count_3: int = 0
    count_2: int = 0
    count_1: int = 0


class ProductReviewCreateResponse(BaseModel):
    message: str
    review: ProductReviewResponse


class AdminReviewResponse(ProductReviewResponse):
    product_title: Optional[str] = None
    product_slug: Optional[str] = None


class AdminReviewListResponse(BaseModel):
    items: List[AdminReviewResponse]
    total: int
    page: int
    page_size: int


class DatabaseTableInfo(BaseModel):
    name: str
    row_count: int
    updated_at: Optional[datetime] = None


class DatabaseTablesResponse(BaseModel):
    tables: List[DatabaseTableInfo]


class DatabaseQueryRequest(BaseModel):
    sql: str = Field(..., min_length=1, max_length=20000)
    mode: Literal['read', 'maintenance'] = 'read'
    confirm_mutation: bool = False


class DatabaseQueryResponse(BaseModel):
    ok: bool
    mode: str
    query_type: str
    columns: List[str] = Field(default_factory=list)
    rows: List[dict] = Field(default_factory=list)
    row_count: int = 0
    message: Optional[str] = None


class DatabaseQueryLogResponse(BaseModel):
    id: int
    admin_id: Optional[int] = None
    admin_email: Optional[str] = None
    sql_text: str
    mode: str
    query_type: str
    status: str
    affected_rows: int
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None


class DatabaseQueryLogsResponse(BaseModel):
    items: List[DatabaseQueryLogResponse]
    total: int
    page: int
    page_size: int


class LogSettingsResponse(BaseModel):
    logs_enabled: bool = True
    logs_capture_request_body: bool = True
    logs_capture_response_body: bool = False
    logs_capture_integrations: bool = True
    logs_capture_webhooks: bool = True
    logs_min_level: Literal['debug', 'info', 'warning', 'error', 'critical'] = 'info'


class LogSettingsUpdate(LogSettingsResponse):
    pass


class SystemLogResponse(BaseModel):
    id: int
    level: str
    category: str
    action_name: Optional[str] = None
    request_method: Optional[str] = None
    request_path: Optional[str] = None
    request_query: Optional[str] = None
    request_headers_json: dict = Field(default_factory=dict)
    request_body_json: Optional[str] = None
    response_status: Optional[int] = None
    response_headers_json: dict = Field(default_factory=dict)
    response_body_json: Optional[str] = None
    duration_ms: Optional[float] = None
    response_size_bytes: Optional[int] = None
    admin_user_id: Optional[int] = None
    admin_email: Optional[str] = None
    session_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    source_system: Optional[str] = None
    error_message: Optional[str] = None
    stack_trace: Optional[str] = None
    metadata_json: dict = Field(default_factory=dict)
    created_at: Optional[datetime] = None


class SystemLogsListResponse(BaseModel):
    items: List[SystemLogResponse]
    total: int
    page: int
    page_size: int


class UserEventCreate(BaseModel):
    event_type: Literal[
        'page_view',
        'product_view',
        'product_click',
        'update_cart_quantity',
        'whatsapp_click',
        'order_created',
        'category_click',
        'banner_click',
        'cta_click',
        'search',
        'filter_apply',
        # legacy aliases
        'view_product',
        'click_product',
        'add_to_cart',
        'remove_from_cart',
        'update_cart',
        'start_checkout',
        'send_whatsapp',
    ]
    product_id: Optional[int] = None
    category_id: Optional[int] = None
    session_id: str = Field(..., min_length=8, max_length=120)
    user_identifier: Optional[str] = Field(default=None, max_length=160)
    page_url: Optional[str] = Field(default=None, max_length=500)
    source_channel: Optional[str] = Field(default=None, max_length=80)
    referrer: Optional[str] = Field(default=None, max_length=500)
    cta_name: Optional[str] = Field(default=None, max_length=120)
    metadata_json: dict = Field(default_factory=dict)


class UserEventResponse(BaseModel):
    id: int
    event_type: str
    product_id: Optional[int] = None
    category_id: Optional[int] = None
    session_id: str
    user_identifier: Optional[str] = None
    page_url: Optional[str] = None
    source_channel: Optional[str] = None
    referrer: Optional[str] = None
    cta_name: Optional[str] = None
    ip_address: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    metadata_json: dict = Field(default_factory=dict)
    created_at: Optional[datetime] = None


class LeadsConversionFilters(BaseModel):
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    category_id: Optional[int] = None
    product_id: Optional[int] = None
    source_channel: Optional[str] = None
    lead_level: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None


class LeadsConversionSummaryResponse(BaseModel):
    sessions: int
    leads_cold: int
    leads_warm: int
    leads_hot: int
    product_views: int
    product_clicks: int
    add_to_cart: int
    checkout_starts: int
    whatsapp_clicks: int
    orders_created: int
    conversion_to_whatsapp: float
    conversion_add_to_whatsapp: float
    estimated_ticket: float
    estimated_whatsapp_value: float


class LeadsConversionFunnelStep(BaseModel):
    key: str
    label: str
    value: int
    step_conversion: float
    dropoff: int


class LeadsConversionFunnelResponse(BaseModel):
    steps: List[LeadsConversionFunnelStep]


class LeadsConversionProductItem(BaseModel):
    product_id: Optional[int] = None
    product_title: str
    product_label: str = ''
    views: int = 0
    clicks: int = 0
    add_to_cart: int = 0
    whatsapp_click: int = 0
    orders: int = 0
    abandoned_sessions: int = 0
    conversion_rate: float = 0
    estimated_value: float = 0


class LeadsConversionProductsResponse(BaseModel):
    most_viewed: List[LeadsConversionProductItem]
    most_clicked: List[LeadsConversionProductItem]
    most_added: List[LeadsConversionProductItem]
    most_whatsapp: List[LeadsConversionProductItem]
    most_purchased: List[LeadsConversionProductItem]
    most_abandoned: List[LeadsConversionProductItem]
    best_conversion: List[LeadsConversionProductItem]
    highest_estimated_value: List[LeadsConversionProductItem]


class LeadsConversionCtaItem(BaseModel):
    cta_name: str
    clicks: int
    ctr: float = 0


class LeadsConversionCtasResponse(BaseModel):
    total_cta_clicks: int
    top_cta: Optional[str] = None
    items: List[LeadsConversionCtaItem]


class LeadSessionItem(BaseModel):
    session_id: str
    lead_level: str
    score: int
    last_activity: Optional[datetime] = None
    viewed_products: int = 0
    clicked_products: int = 0
    add_to_cart: int = 0
    checkout_started: bool = False
    whatsapp_clicked: bool = False
    estimated_interest_value: float = 0
    source_channel: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None


class LeadsConversionLeadsResponse(BaseModel):
    items: List[LeadSessionItem]
    total: int
    page: int
    page_size: int


class LeadsConversionSourceItem(BaseModel):
    source_channel: str
    sessions: int
    leads: int
    whatsapp_clicks: int
    conversion_to_whatsapp: float


class LeadsConversionSourcesResponse(BaseModel):
    items: List[LeadsConversionSourceItem]


class LeadsConversionLocationItem(BaseModel):
    country: str
    state: str
    city: str
    sessions: int
    leads: int
    whatsapp_clicks: int


class LeadsConversionLocationsResponse(BaseModel):
    items: List[LeadsConversionLocationItem]


class LeadsConversionAbandonmentResponse(BaseModel):
    abandoned_sessions: int
    high_intent_without_whatsapp: int
    high_intent_without_order: int
    abandoned_products: List[LeadsConversionProductItem]


class AnalyticsSummaryResponse(BaseModel):
    total_orders: int
    total_items_sold: int
    estimated_total_value: float
    conversion_add_to_whatsapp: float


class AnalyticsFunnelPoint(BaseModel):
    step: str
    value: int


class AnalyticsFunnelResponse(BaseModel):
    points: List[AnalyticsFunnelPoint]


class AnalyticsProductPoint(BaseModel):
    product_id: Optional[int] = None
    product_title: str
    value: int
    total_value: Optional[float] = None


class AnalyticsProductsResponse(BaseModel):
    most_viewed: List[AnalyticsProductPoint]
    most_added: List[AnalyticsProductPoint]
    most_sold: List[AnalyticsProductPoint]


class ReportSalesResponse(BaseModel):
    total_value: float
    order_count: int
    avg_ticket: float
    by_payment_method: List[DashboardSeriesPoint] = Field(default_factory=list)
    avg_ticket_by_method: List[DashboardSeriesPoint] = Field(default_factory=list)


class ReportTopProductsResponse(BaseModel):
    items: List[AnalyticsProductPoint]


class LeadPoint(BaseModel):
    session_id: str
    created_at: Optional[datetime] = None
    event_type: str
    product_id: Optional[int] = None
    product_title: Optional[str] = None


class ReportLeadsResponse(BaseModel):
    total_leads: int
    items: List[LeadPoint]
    top_products: List[AnalyticsProductPoint]


class InfinitePayCheckoutRequest(BaseModel):
    order_id: int = Field(..., ge=1)
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_document: Optional[str] = None
    address: dict = Field(default_factory=dict)


class InfinitePayCheckoutResponse(BaseModel):
    ok: bool
    order_id: int
    order_nsu: str
    checkout_url: str
    payment_status: str


class InfinitePayStatusCheckRequest(BaseModel):
    order_id: Optional[int] = Field(default=None, ge=1)
    order_nsu: Optional[str] = None
    slug: Optional[str] = None
    transaction_nsu: Optional[str] = None


class InfinitePayStatusCheckResponse(BaseModel):
    ok: bool
    payment_status: str
    payment_method: Optional[str] = None
    paid: Optional[bool] = None
    amount: Optional[float] = None
    paid_amount: Optional[float] = None
    installments: Optional[int] = None
    capture_method: Optional[str] = None
    receipt_url: Optional[str] = None
    raw: dict = Field(default_factory=dict)


class PublicPaymentReturnResponse(BaseModel):
    order_id: Optional[int] = None
    order_nsu: Optional[str] = None
    payment_status: str
    payment_method: Optional[str] = None
    receipt_url: Optional[str] = None
    total: float = 0
    paid_amount: Optional[float] = None


class AdsProviderConfigUpdate(BaseModel):
    provider_name: str = Field(default='nvidia', min_length=2, max_length=80)
    base_url: str = Field(..., min_length=8, max_length=400)
    api_key: Optional[str] = Field(default=None, max_length=600)
    model_name: str = Field(..., min_length=3, max_length=200)
    prompt_complement: Optional[str] = Field(default=None, max_length=4000)
    is_active: bool = False


class AdsProviderConfigResponse(BaseModel):
    id: int
    provider_name: str
    base_url: str
    model_name: str
    prompt_complement: Optional[str] = None
    default_prompt_md: str = ''
    is_active: bool
    has_api_key: bool
    created_at: Optional[datetime] = None


class AdsConnectionTestResponse(BaseModel):
    ok: bool
    message: str
    model: Optional[str] = None


class AdsGenerateRequest(BaseModel):
    ads_count: int = Field(default=3, ge=1, le=8)
    extra_context: Optional[str] = Field(default=None, max_length=10000)


class GeneratedAdItem(BaseModel):
    headline: str
    primary_text: str
    description: str
    cta: str
    target_audience: str
    creative_idea: str
    product_draft: dict = Field(default_factory=dict)
    existing_product_id: Optional[int] = None
    existing_product_title: Optional[str] = None


class AdsGenerateResponse(BaseModel):
    history_id: int
    model_used: str
    input_data_json: dict = Field(default_factory=dict)
    ads: List[GeneratedAdItem]
    created_at: Optional[datetime] = None


class AdsGenerationHistoryItem(BaseModel):
    id: int
    model_used: str
    input_data_json: dict = Field(default_factory=dict)
    output_data_json: dict = Field(default_factory=dict)
    created_at: Optional[datetime] = None


class AdsGenerationHistoryResponse(BaseModel):
    items: List[AdsGenerationHistoryItem]
    total: int
    page: int
    page_size: int


class CreateProductFromAdRequest(BaseModel):
    ad_generation_id: int = Field(..., ge=1)
    ad_index: int = Field(default=0, ge=0)


class CreateProductFromAdResponse(BaseModel):
    product_id: int
    edit_url: str
