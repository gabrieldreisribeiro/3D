from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    is_active: bool


class SecondaryColorPair(BaseModel):
    primary: str = Field(..., min_length=4, max_length=7)
    secondary: str = Field(..., min_length=4, max_length=7)


class ProductSubItem(BaseModel):
    title: str = Field(..., min_length=1, max_length=140)
    image_url: Optional[str] = None
    pricing_mode: Literal['manual', 'calculated'] = 'manual'
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
    category_id: Optional[int]
    lead_time_hours: float
    allow_colors: bool
    available_colors: List[str]
    allow_secondary_color: bool
    secondary_color_pairs: List[SecondaryColorPair]

    price: float
    final_price: float
    calculated_price: float
    cost_total: float
    estimated_profit: float

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
    category_id: Optional[int]
    lead_time_hours: float
    allow_colors: bool
    available_colors: List[str]
    allow_secondary_color: bool
    secondary_color_pairs: List[SecondaryColorPair]

    grams_filament: float
    price_kg_filament: float
    hours_printing: float
    avg_power_watts: float
    price_kwh: float
    total_hours_labor: float
    price_hour_labor: float
    extra_cost: float
    profit_margin: float
    manual_price: Optional[float]

    cost_total: float
    calculated_price: float
    estimated_profit: float
    final_price: float
    price: float

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

class OrderItemCreate(BaseModel):
    model_config = ConfigDict(extra='ignore')

    slug: str
    quantity: int = Field(..., gt=0)
    unit_price: Optional[float] = Field(default=None, ge=0)
    selected_color: Optional[str] = None
    selected_secondary_color: Optional[str] = None
    selected_sub_items: List[dict] = Field(default_factory=list)


class OrderCreate(BaseModel):
    items: List[OrderItemCreate]
    coupon: Optional[str] = None
    payment_status: Literal['pending', 'paid'] = 'pending'
    payment_method: Optional[str] = None


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

class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subtotal: float
    discount: float
    total: float
    coupon_code: Optional[str]
    payment_status: str
    payment_method: Optional[str]
    items: List[OrderItemResponse]

class AdminLoginRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=6)


class AdminLoginResponse(BaseModel):
    token: str
    email: str


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


class AdminOrderResponse(BaseModel):
    id: int
    subtotal: float
    discount: float
    total: float
    coupon_code: Optional[str]
    payment_status: str
    payment_method: Optional[str]
    created_at: Optional[datetime]
    items: List[AdminOrderItemResponse]


class DashboardSeriesPoint(BaseModel):
    label: str
    value: float


class DashboardTopProduct(BaseModel):
    title: str
    quantity: int


class DashboardStatusPoint(BaseModel):
    status: str
    value: int


class AdminDashboardSummary(BaseModel):
    total_products: int
    total_orders: int
    total_sold: float
    sales_series: List[DashboardSeriesPoint]
    orders_series: List[DashboardSeriesPoint]
    top_products: List[DashboardTopProduct]
    order_status: List[DashboardStatusPoint]


class LogoResponse(BaseModel):
    url: Optional[str]


class StoreSettingsBase(BaseModel):
    whatsapp_number: Optional[str] = None
    pix_key: Optional[str] = None


class StoreSettingsUpdate(StoreSettingsBase):
    pass


class StoreSettingsResponse(StoreSettingsBase):
    pass
