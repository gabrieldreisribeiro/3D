from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.schemas import (
    CategoryResponse,
    ProductResponse,
    ProductReviewCreateResponse,
    ProductReviewListResponse,
    ProductReviewResponse,
    ProductReviewSummaryResponse,
)
from app.services.product_service import (
    get_product_by_slug,
    list_categories,
    list_products,
    parse_colors_from_storage,
    parse_secondary_pairs_from_storage,
    parse_sub_items_from_storage,
)
from app.services.promotion_service import apply_promotion_pricing_to_products
from app.services.review_service import (
    create_review,
    get_product_by_id,
    get_public_review_summary,
    list_public_reviews,
)

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _serialize_review(review) -> ProductReviewResponse:
    media = sorted(review.media or [], key=lambda item: (item.sort_order, item.id))
    photos = [item.file_path for item in media if item.media_type == 'image']
    video = next((item.file_path for item in media if item.media_type == 'video'), None)
    return ProductReviewResponse(
        id=review.id,
        product_id=review.product_id,
        author_name=review.author_name,
        rating=review.rating,
        comment=review.comment,
        status=review.status,
        created_at=review.created_at,
        updated_at=review.updated_at,
        media=media,
        photos=photos,
        video=video,
        has_media=bool(media),
    )


@router.get('/categories', response_model=list[CategoryResponse])
def read_categories(db: Session = Depends(get_db)):
    return list_categories(db)


@router.get('/products', response_model=list[ProductResponse])
def read_products(category: str | None = Query(default=None), db: Session = Depends(get_db)):
    products = list_products(db, category_slug=category)
    apply_promotion_pricing_to_products(db, products)
    for product in products:
        product.images = product.images.split(',') if product.images else []
        product.sub_items = parse_sub_items_from_storage(product.sub_items)
        product.available_colors = parse_colors_from_storage(product.available_colors)
        product.secondary_color_pairs = parse_secondary_pairs_from_storage(product.secondary_color_pairs, product.available_colors)
    return products


@router.get('/products/{slug}', response_model=ProductResponse)
def read_product(slug: str, db: Session = Depends(get_db)):
    product = get_product_by_slug(db, slug)
    if not product:
        raise HTTPException(status_code=404, detail='Produto nao encontrado')
    apply_promotion_pricing_to_products(db, [product])
    product.images = product.images.split(',') if product.images else []
    product.sub_items = parse_sub_items_from_storage(product.sub_items)
    product.available_colors = parse_colors_from_storage(product.available_colors)
    product.secondary_color_pairs = parse_secondary_pairs_from_storage(product.secondary_color_pairs, product.available_colors)
    return product


@router.post('/products/{product_id}/reviews', response_model=ProductReviewCreateResponse)
def create_product_review(
    product_id: int,
    author_name: str = Form(...),
    rating: int = Form(...),
    comment: str = Form(...),
    images: list[UploadFile] | None = File(default=None),
    video: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
):
    product = get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail='Produto nao encontrado')

    review = create_review(
        db,
        product,
        author_name=author_name,
        rating=rating,
        comment=comment,
        images=images or [],
        video=video,
    )
    return ProductReviewCreateResponse(
        message='Sua avaliacao foi enviada e ficara visivel apos aprovacao.',
        review=_serialize_review(review),
    )


@router.get('/products/{product_id}/reviews', response_model=ProductReviewListResponse)
def list_product_reviews(
    product_id: int,
    sort: str = Query(default='recent'),
    with_media: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    product = get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail='Produto nao encontrado')

    items, total = list_public_reviews(
        db,
        product_id,
        sort=sort,
        with_media=with_media,
        page=page,
        page_size=page_size,
    )
    return ProductReviewListResponse(
        items=[_serialize_review(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get('/products/{product_id}/reviews/summary', response_model=ProductReviewSummaryResponse)
def get_product_reviews_summary(product_id: int, db: Session = Depends(get_db)):
    product = get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail='Produto nao encontrado')
    return ProductReviewSummaryResponse(**get_public_review_summary(db, product_id))
