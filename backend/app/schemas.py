from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class ProductBase(BaseModel):
    id: int
    title: str
    slug: str
    short_description: str
    full_description: str
    price: float
    cover_image: str
    images: List[str]
    is_active: bool
    rating_average: float
    rating_count: int

    class Config:
        orm_mode = True


class ProductResponse(ProductBase):
    pass


class AdminProductBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=160)
    slug: str = Field(..., min_length=2, max_length=160)
    short_description: str = Field(..., min_length=2, max_length=260)
    full_description: str = Field(..., min_length=2)
    price: float = Field(..., gt=0)
    cover_image: str = Field(..., min_length=5)
    images: List[str] = Field(default_factory=list)
    is_active: bool = True


class AdminProductCreate(AdminProductBase):
    pass


class AdminProductUpdate(AdminProductBase):
    pass


class AdminProductResponse(BaseModel):
    id: int
    title: str
    slug: str
    short_description: str
    full_description: str
    price: float
    cover_image: str
    images: List[str]
    is_active: bool

    class Config:
        orm_mode = True


class CouponRequest(BaseModel):
    code: str


class CouponResponse(BaseModel):
    code: str
    type: str
    value: float


class OrderItemCreate(BaseModel):
    slug: str
    quantity: int


class OrderCreate(BaseModel):
    items: List[OrderItemCreate]
    coupon: Optional[str] = None


class OrderItemResponse(BaseModel):
    product_slug: str
    title: str
    quantity: int
    unit_price: float

    class Config:
        orm_mode = True


class OrderResponse(BaseModel):
    id: int
    subtotal: float
    discount: float
    total: float
    coupon_code: Optional[str]
    items: List[OrderItemResponse]

    class Config:
        orm_mode = True


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)


class AdminLoginResponse(BaseModel):
    token: str
    email: EmailStr


class AdminOrderItemResponse(BaseModel):
    id: int
    product_slug: str
    title: str
    quantity: int
    unit_price: float


class AdminOrderResponse(BaseModel):
    id: int
    subtotal: float
    discount: float
    total: float
    coupon_code: Optional[str]
    created_at: Optional[datetime]
    items: List[AdminOrderItemResponse]


class AdminDashboardSummary(BaseModel):
    total_products: int
    total_orders: int
    total_sold: float
