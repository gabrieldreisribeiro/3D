import re
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.config import REVIEW_IMAGE_UPLOADS_DIR, REVIEW_VIDEO_UPLOADS_DIR, UPLOADS_DIR
from app.models import Product, ProductReview, ProductReviewMedia

MAX_REVIEW_IMAGES = 5
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
MAX_VIDEO_SIZE_BYTES = 30 * 1024 * 1024

ALLOWED_IMAGE_CONTENT_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
}

ALLOWED_VIDEO_CONTENT_TYPES = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
}

REVIEW_STATUS = {'pending', 'approved', 'rejected'}
REVIEW_SORT = {'recent', 'best'}
TAG_RE = re.compile(r'<[^>]+>')


def _clean_text(value: str, *, max_len: int) -> str:
    raw = str(value or '').strip()
    raw = TAG_RE.sub('', raw)
    raw = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]+', ' ', raw).strip()
    if len(raw) > max_len:
        raw = raw[:max_len].strip()
    return raw


def _write_upload(file: UploadFile, destination: Path, max_size: int) -> None:
    total = 0
    with destination.open('wb') as output:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > max_size:
                output.close()
                destination.unlink(missing_ok=True)
                raise HTTPException(status_code=400, detail='Arquivo excede o tamanho permitido.')
            output.write(chunk)
    try:
        file.file.seek(0)
    except Exception:  # noqa: BLE001
        pass


def _save_review_image(file: UploadFile) -> str:
    if file.content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail='Formato de imagem invalido. Use jpg, png ou webp.')
    extension = ALLOWED_IMAGE_CONTENT_TYPES[file.content_type]
    filename = f'review-image-{uuid4().hex}.{extension}'
    destination = REVIEW_IMAGE_UPLOADS_DIR / filename
    _write_upload(file, destination, MAX_IMAGE_SIZE_BYTES)
    return f'/uploads/reviews/images/{filename}'


def _save_review_video(file: UploadFile) -> str:
    if file.content_type not in ALLOWED_VIDEO_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail='Formato de video invalido. Use mp4 ou webm.')
    extension = ALLOWED_VIDEO_CONTENT_TYPES[file.content_type]
    filename = f'review-video-{uuid4().hex}.{extension}'
    destination = REVIEW_VIDEO_UPLOADS_DIR / filename
    _write_upload(file, destination, MAX_VIDEO_SIZE_BYTES)
    return f'/uploads/reviews/videos/{filename}'


def get_product_by_id(db: Session, product_id: int) -> Product | None:
    return db.query(Product).filter(Product.id == product_id, Product.is_active == True).first()  # noqa: E712


def _review_query(db: Session):
    return db.query(ProductReview).options(joinedload(ProductReview.media), joinedload(ProductReview.product))


def recalculate_product_review_metrics(db: Session, product_id: int) -> None:
    average_rating, total_reviews = (
        db.query(func.avg(ProductReview.rating), func.count(ProductReview.id))
        .filter(ProductReview.product_id == product_id, ProductReview.status == 'approved')
        .first()
    )
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return
    product.rating_average = float(average_rating or 0)
    product.rating_count = int(total_reviews or 0)
    db.add(product)
    db.commit()


def create_review(
    db: Session,
    product: Product,
    *,
    author_name: str,
    rating: int,
    comment: str,
    images: list[UploadFile] | None = None,
    video: UploadFile | None = None,
) -> ProductReview:
    author = _clean_text(author_name, max_len=120)
    review_comment = _clean_text(comment, max_len=3000)

    if not author:
        raise HTTPException(status_code=400, detail='Nome do autor e obrigatorio.')
    if not review_comment:
        raise HTTPException(status_code=400, detail='Comentario e obrigatorio.')
    if int(rating) < 1 or int(rating) > 5:
        raise HTTPException(status_code=400, detail='Nota invalida. Use um valor entre 1 e 5.')

    image_files = [item for item in (images or []) if item is not None and item.filename]
    if len(image_files) > MAX_REVIEW_IMAGES:
        raise HTTPException(status_code=400, detail=f'Maximo de {MAX_REVIEW_IMAGES} imagens por avaliacao.')

    review = ProductReview(
        product_id=product.id,
        author_name=author,
        rating=int(rating),
        comment=review_comment,
        status='pending',
    )
    db.add(review)
    db.flush()

    for index, image in enumerate(image_files):
        path = _save_review_image(image)
        db.add(
            ProductReviewMedia(
                review_id=review.id,
                media_type='image',
                file_path=path,
                sort_order=index,
            )
        )

    if video and video.filename:
        path = _save_review_video(video)
        db.add(
            ProductReviewMedia(
                review_id=review.id,
                media_type='video',
                file_path=path,
                sort_order=0,
            )
        )

    db.commit()
    return _review_query(db).filter(ProductReview.id == review.id).first()


def list_public_reviews(
    db: Session,
    product_id: int,
    *,
    sort: str = 'recent',
    with_media: bool = False,
    page: int = 1,
    page_size: int = 10,
) -> tuple[list[ProductReview], int]:
    safe_sort = sort if sort in REVIEW_SORT else 'recent'
    query = _review_query(db).filter(ProductReview.product_id == product_id, ProductReview.status == 'approved')
    if with_media:
        query = query.join(ProductReview.media).distinct()
    total = query.count()
    if safe_sort == 'best':
        query = query.order_by(ProductReview.rating.desc(), ProductReview.created_at.desc())
    else:
        query = query.order_by(ProductReview.created_at.desc())

    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def get_public_review_summary(db: Session, product_id: int) -> dict:
    base_counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    rows = (
        db.query(ProductReview.rating, func.count(ProductReview.id))
        .filter(ProductReview.product_id == product_id, ProductReview.status == 'approved')
        .group_by(ProductReview.rating)
        .all()
    )
    for rating, count in rows:
        if int(rating) in base_counts:
            base_counts[int(rating)] = int(count)

    total_reviews = sum(base_counts.values())
    average_rating = (
        sum(star * count for star, count in base_counts.items()) / total_reviews if total_reviews > 0 else 0
    )
    return {
        'average_rating': round(float(average_rating), 2),
        'total_reviews': total_reviews,
        'count_5': base_counts[5],
        'count_4': base_counts[4],
        'count_3': base_counts[3],
        'count_2': base_counts[2],
        'count_1': base_counts[1],
    }


def list_admin_reviews(
    db: Session,
    *,
    product_id: int | None = None,
    status: str | None = None,
    rating: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[ProductReview], int]:
    query = _review_query(db)

    if product_id is not None:
        query = query.filter(ProductReview.product_id == product_id)
    if status and status in REVIEW_STATUS:
        query = query.filter(ProductReview.status == status)
    if rating is not None:
        query = query.filter(ProductReview.rating == int(rating))
    if date_from is not None:
        query = query.filter(ProductReview.created_at >= date_from)
    if date_to is not None:
        query = query.filter(ProductReview.created_at <= date_to)

    total = query.count()
    items = (
        query.order_by(ProductReview.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def get_review_by_id(db: Session, review_id: int) -> ProductReview | None:
    return _review_query(db).filter(ProductReview.id == review_id).first()


def set_review_status(db: Session, review: ProductReview, status: str) -> ProductReview:
    if status not in REVIEW_STATUS:
        raise HTTPException(status_code=400, detail='Status invalido.')
    review.status = status
    db.add(review)
    db.commit()
    db.refresh(review)
    recalculate_product_review_metrics(db, review.product_id)
    return _review_query(db).filter(ProductReview.id == review.id).first()


def delete_review(db: Session, review: ProductReview) -> None:
    product_id = review.product_id
    for media in review.media or []:
        try:
            if media.file_path:
                relative = media.file_path.replace('/uploads/', '').strip('/')
                target = UPLOADS_DIR / relative
                target.unlink(missing_ok=True)
        except Exception:  # noqa: BLE001
            continue
    db.delete(review)
    db.commit()
    recalculate_product_review_metrics(db, product_id)
