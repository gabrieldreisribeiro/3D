import json
from datetime import datetime
from types import SimpleNamespace

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models import Banner, Category, HighlightItem, Product, Promotion, PublicationDraft
from app.schemas import AdminProductCreate, AdminProductUpdate, BannerCreate, BannerUpdate, HighlightItemCreate, HighlightItemUpdate, PromotionCreate, PromotionUpdate
from app.services.banner_service import create_banner, get_banner, update_banner
from app.services.highlight_service import create_highlight_item, get_highlight_item_by_id, update_highlight_item
from app.services.order_service import list_most_ordered_products
from app.services.product_pricing_service import calculate_product_pricing
from app.services.product_3d_model_service import get_primary_model_dimensions_map, get_sub_item_dimensions_map
from app.services.product_service import (
    admin_create_product,
    admin_get_product_by_id,
    admin_list_products,
    admin_slug_exists,
    admin_update_product,
    parse_colors_from_storage,
    parse_secondary_pairs_from_storage,
    parse_sub_items_from_storage,
    prepare_colors_for_storage,
    prepare_secondary_pairs_for_storage,
    prepare_sub_items_for_storage,
)
from app.services.promotion_service import (
    create_promotion,
    get_promotion_by_id,
    list_promotions,
    promotion_badge,
    promotion_status,
    serialize_promotion,
    update_promotion,
)

DRAFT_ENTITY_TYPES = {'product', 'banner', 'highlight', 'promotion'}


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def _safe_json_load(value: str | None) -> dict:
    if not value:
        return {}
    try:
        data = json.loads(value)
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def _set_payload(draft: PublicationDraft, payload: dict) -> None:
    draft.payload_json = json.dumps(payload, ensure_ascii=False)


def _get_payload(draft: PublicationDraft) -> dict:
    return _safe_json_load(draft.payload_json)


def _validate_entity_type(entity_type: str) -> str:
    normalized = str(entity_type or '').strip().lower()
    if normalized not in DRAFT_ENTITY_TYPES:
        raise HTTPException(status_code=400, detail='Tipo de entidade invalido para publicacao.')
    return normalized


def list_publication_drafts(db: Session) -> list[PublicationDraft]:
    return (
        db.query(PublicationDraft)
        .order_by(PublicationDraft.updated_at.desc(), PublicationDraft.id.desc())
        .all()
    )


def find_draft_by_id(db: Session, draft_id: int) -> PublicationDraft | None:
    return db.query(PublicationDraft).filter(PublicationDraft.id == int(draft_id)).first()


def get_entity_draft(db: Session, entity_type: str, entity_id: int) -> PublicationDraft | None:
    return (
        db.query(PublicationDraft)
        .filter(
            PublicationDraft.entity_type == entity_type,
            PublicationDraft.entity_id == int(entity_id),
            PublicationDraft.action.in_(['update', 'delete']),
        )
        .order_by(PublicationDraft.updated_at.desc(), PublicationDraft.id.desc())
        .first()
    )


def list_entity_create_drafts(db: Session, entity_type: str) -> list[PublicationDraft]:
    return (
        db.query(PublicationDraft)
        .filter(
            PublicationDraft.entity_type == entity_type,
            PublicationDraft.action == 'create',
            PublicationDraft.entity_id.is_(None),
        )
        .order_by(PublicationDraft.updated_at.desc(), PublicationDraft.id.desc())
        .all()
    )


def save_draft(
    db: Session,
    *,
    entity_type: str,
    payload: dict,
    entity_id: int | None = None,
    action: str = 'update',
) -> PublicationDraft:
    normalized_type = _validate_entity_type(entity_type)
    normalized_action = str(action or 'update').strip().lower()
    if normalized_action not in {'create', 'update', 'delete'}:
        raise HTTPException(status_code=400, detail='Acao de publicacao invalida.')

    draft: PublicationDraft | None = None
    if normalized_action != 'create' and entity_id is not None:
        draft = get_entity_draft(db, normalized_type, int(entity_id))

    if not draft:
        draft = PublicationDraft(
            entity_type=normalized_type,
            entity_id=int(entity_id) if entity_id is not None else None,
            action=normalized_action,
            payload_json='{}',
        )

    _set_payload(draft, payload)
    draft.action = normalized_action
    draft.entity_id = int(entity_id) if entity_id is not None else None
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return draft


def discard_draft(db: Session, draft: PublicationDraft) -> None:
    db.delete(draft)
    db.commit()


def _serialize_product_admin(product: Product) -> dict:
    images = product.images.split(',') if product.images else []
    sub_items = parse_sub_items_from_storage(product.sub_items)
    available_colors = parse_colors_from_storage(product.available_colors)
    secondary_pairs = parse_secondary_pairs_from_storage(product.secondary_color_pairs, available_colors)
    return {
        'id': product.id,
        'title': product.title,
        'slug': product.slug,
        'short_description': product.short_description,
        'full_description': product.full_description,
        'cover_image': product.cover_image,
        'images': images,
        'sub_items': sub_items,
        'is_active': bool(product.is_active),
        'category_id': product.category_id,
        'lead_time_hours': float(product.lead_time_hours or 0),
        'allow_colors': bool(product.allow_colors),
        'available_colors': available_colors,
        'allow_secondary_color': bool(product.allow_secondary_color),
        'secondary_color_pairs': secondary_pairs,
        'allow_name_personalization': bool(product.allow_name_personalization),
        'width_mm': product.width_mm,
        'height_mm': product.height_mm,
        'depth_mm': product.depth_mm,
        'dimensions_source': product.dimensions_source or 'manual',
        'grams_filament': float(product.grams_filament or 0),
        'price_kg_filament': float(product.price_kg_filament or 0),
        'hours_printing': float(product.hours_printing or 0),
        'avg_power_watts': float(product.avg_power_watts or 0),
        'price_kwh': float(product.price_kwh or 0),
        'total_hours_labor': float(product.total_hours_labor or 0),
        'price_hour_labor': float(product.price_hour_labor or 0),
        'extra_cost': float(product.extra_cost or 0),
        'profit_margin': float(product.profit_margin or 0),
        'manual_price': product.manual_price,
        'cost_total': float(product.cost_total or 0),
        'calculated_price': float(product.calculated_price or 0),
        'estimated_profit': float(product.estimated_profit or 0),
        'final_price': float(product.final_price or 0),
        'price': float(product.price or product.final_price or 0),
        'publish_to_instagram': bool(product.publish_to_instagram),
        'instagram_caption': product.instagram_caption,
        'instagram_hashtags': product.instagram_hashtags,
        'instagram_post_status': product.instagram_post_status or 'not_published',
        'instagram_post_id': product.instagram_post_id,
        'instagram_published_at': product.instagram_published_at,
        'instagram_error_message': product.instagram_error_message,
        'is_draft': bool(product.is_draft),
        'generated_by_ai': bool(product.generated_by_ai),
        'source_ad_generation_id': product.source_ad_generation_id,
        'rating_average': float(product.rating_average or 0),
        'rating_count': int(product.rating_count or 0),
    }


def get_draft_payload(draft: PublicationDraft) -> dict:
    return _get_payload(draft)


def serialize_product_payload_for_draft(product: Product) -> dict:
    serialized = _serialize_product_admin(product)
    return {
        'title': serialized['title'],
        'slug': serialized['slug'],
        'short_description': serialized['short_description'],
        'full_description': serialized['full_description'],
        'cover_image': serialized['cover_image'],
        'images': serialized['images'],
        'sub_items': serialized['sub_items'],
        'is_active': serialized['is_active'],
        'category_id': serialized['category_id'],
        'lead_time_hours': serialized['lead_time_hours'],
        'allow_colors': serialized['allow_colors'],
        'available_colors': serialized['available_colors'],
        'allow_secondary_color': serialized['allow_secondary_color'],
        'secondary_color_pairs': serialized['secondary_color_pairs'],
        'allow_name_personalization': serialized['allow_name_personalization'],
        'width_mm': serialized['width_mm'],
        'height_mm': serialized['height_mm'],
        'depth_mm': serialized['depth_mm'],
        'dimensions_source': serialized['dimensions_source'],
        'grams_filament': serialized['grams_filament'],
        'price_kg_filament': serialized['price_kg_filament'],
        'hours_printing': serialized['hours_printing'],
        'avg_power_watts': serialized['avg_power_watts'],
        'price_kwh': serialized['price_kwh'],
        'total_hours_labor': serialized['total_hours_labor'],
        'price_hour_labor': serialized['price_hour_labor'],
        'extra_cost': serialized['extra_cost'],
        'profit_margin': serialized['profit_margin'],
        'manual_price': serialized['manual_price'],
        'publish_to_instagram': serialized['publish_to_instagram'],
        'instagram_caption': serialized['instagram_caption'],
        'instagram_hashtags': serialized['instagram_hashtags'],
        'is_draft': True,
        'generated_by_ai': serialized['generated_by_ai'],
        'source_ad_generation_id': serialized['source_ad_generation_id'],
    }


def _pricing_from_payload(payload: dict) -> dict:
    required = {
        'grams_filament': float(payload.get('grams_filament') or 0),
        'price_kg_filament': float(payload.get('price_kg_filament') or 0),
        'hours_printing': float(payload.get('hours_printing') or 0),
        'avg_power_watts': float(payload.get('avg_power_watts') or 0),
        'price_kwh': float(payload.get('price_kwh') or 0),
        'total_hours_labor': float(payload.get('total_hours_labor') or 0),
        'price_hour_labor': float(payload.get('price_hour_labor') or 0),
        'extra_cost': float(payload.get('extra_cost') or 0),
        'profit_margin': float(payload.get('profit_margin') or 0),
        'manual_price': payload.get('manual_price'),
    }
    return calculate_product_pricing(SimpleNamespace(**required))


def _project_product_from_payload(
    payload: dict,
    *,
    base: dict | None = None,
    projection_id: int,
    publication_status: str,
    draft_id: int,
) -> dict:
    merged = dict(base or {})
    merged.update(payload)
    pricing = _pricing_from_payload(merged)
    merged['cost_total'] = pricing['cost_total']
    merged['calculated_price'] = pricing['calculated_price']
    merged['estimated_profit'] = pricing['estimated_profit']
    merged['final_price'] = pricing['final_price']
    merged['price'] = pricing['final_price']
    merged['images'] = list(merged.get('images') or [])
    merged['sub_items'] = list(merged.get('sub_items') or [])
    merged['available_colors'] = list(merged.get('available_colors') or [])
    merged['secondary_color_pairs'] = list(merged.get('secondary_color_pairs') or [])
    merged['dimensions_source'] = merged.get('dimensions_source') or 'manual'
    merged['id'] = int(projection_id)
    merged['publication_status'] = publication_status
    merged['draft_id'] = int(draft_id)
    merged['is_draft'] = True
    merged['instagram_post_status'] = merged.get('instagram_post_status') or 'not_published'
    merged['rating_average'] = float(merged.get('rating_average') or 0)
    merged['rating_count'] = int(merged.get('rating_count') or 0)
    merged['generated_by_ai'] = bool(merged.get('generated_by_ai') or False)
    return merged


def list_admin_products_with_drafts(db: Session) -> list[dict]:
    published = [_serialize_product_admin(product) for product in admin_list_products(db)]
    by_id = {int(item['id']): item for item in published}

    drafts = (
        db.query(PublicationDraft)
        .filter(PublicationDraft.entity_type == 'product')
        .order_by(PublicationDraft.updated_at.desc(), PublicationDraft.id.desc())
        .all()
    )

    virtual_creates: list[dict] = []
    for draft in drafts:
        payload = _get_payload(draft)
        if draft.action == 'create':
            virtual_creates.append(
                _project_product_from_payload(
                    payload,
                    projection_id=-int(draft.id),
                    publication_status='draft_new',
                    draft_id=draft.id,
                )
            )
            continue

        if not draft.entity_id:
            continue

        if draft.action == 'delete':
            if int(draft.entity_id) in by_id:
                by_id[int(draft.entity_id)]['publication_status'] = 'deletion_pending'
                by_id[int(draft.entity_id)]['draft_id'] = int(draft.id)
            continue

        base = by_id.get(int(draft.entity_id))
        if not base:
            continue
        by_id[int(draft.entity_id)] = _project_product_from_payload(
            payload,
            base=base,
            projection_id=int(draft.entity_id),
            publication_status='draft_update',
            draft_id=draft.id,
        )

    merged = list(by_id.values()) + virtual_creates
    positive_ids = [int(item.get('id') or 0) for item in merged if int(item.get('id') or 0) > 0]
    primary_dims = get_primary_model_dimensions_map(db, positive_ids)
    sub_item_dims = get_sub_item_dimensions_map(db, positive_ids)
    for item in merged:
        pid = int(item.get('id') or 0)
        has_manual = all(item.get(key) is not None for key in ['width_mm', 'height_mm', 'depth_mm'])
        source = str(item.get('dimensions_source') or 'manual')
        should_use_model = source == 'model' or not has_manual
        if pid > 0 and should_use_model and pid in primary_dims:
            width, height, depth = primary_dims[pid]
            item['width_mm'] = width
            item['height_mm'] = height
            item['depth_mm'] = depth
            item['dimensions_source'] = 'model'
        for sub_item in item.get('sub_items') or []:
            sub_item_id = str(sub_item.get('id') or '').strip()
            sub_has_manual = all(sub_item.get(key) is not None for key in ['width_mm', 'height_mm', 'depth_mm'])
            sub_source = str(sub_item.get('dimensions_source') or 'manual')
            should_use_model_sub = sub_source == 'model' or not sub_has_manual
            if pid > 0 and sub_item_id and should_use_model_sub and (pid, sub_item_id) in sub_item_dims:
                width, height, depth = sub_item_dims[(pid, sub_item_id)]
                sub_item['width_mm'] = width
                sub_item['height_mm'] = height
                sub_item['depth_mm'] = depth
                sub_item['dimensions_source'] = 'model'
    merged.sort(key=lambda item: int(item.get('id', 0)), reverse=True)
    return merged


def _serialize_banner(banner: Banner) -> dict:
    return {
        'id': int(banner.id),
        'title': banner.title,
        'subtitle': banner.subtitle,
        'image_url': banner.image_url,
        'target_url': banner.target_url,
        'sort_order': int(banner.sort_order or 0),
        'is_active': bool(banner.is_active),
        'show_in_carousel': bool(banner.show_in_carousel),
        'created_at': banner.created_at,
    }


def list_admin_banners_with_drafts(db: Session) -> list[dict]:
    rows = db.query(Banner).order_by(Banner.sort_order.asc(), Banner.id.desc()).all()
    published = [_serialize_banner(item) for item in rows]
    by_id = {int(item['id']): item for item in published}
    drafts = (
        db.query(PublicationDraft)
        .filter(PublicationDraft.entity_type == 'banner')
        .order_by(PublicationDraft.updated_at.desc(), PublicationDraft.id.desc())
        .all()
    )

    create_rows = []
    for draft in drafts:
        payload = _get_payload(draft)
        if draft.action == 'create':
            create_rows.append({
                'id': -int(draft.id),
                'title': payload.get('title'),
                'subtitle': payload.get('subtitle'),
                'image_url': payload.get('image_url') or '',
                'target_url': payload.get('target_url'),
                'sort_order': int(payload.get('sort_order') or 0),
                'is_active': bool(payload.get('is_active', True)),
                'show_in_carousel': bool(payload.get('show_in_carousel', True)),
                'created_at': None,
                'publication_status': 'draft_new',
                'draft_id': int(draft.id),
            })
            continue

        if not draft.entity_id or int(draft.entity_id) not in by_id:
            continue
        if draft.action == 'delete':
            by_id[int(draft.entity_id)]['publication_status'] = 'deletion_pending'
            by_id[int(draft.entity_id)]['draft_id'] = int(draft.id)
            continue

        updated = dict(by_id[int(draft.entity_id)])
        updated.update(payload)
        updated['publication_status'] = 'draft_update'
        updated['draft_id'] = int(draft.id)
        by_id[int(draft.entity_id)] = updated

    result = list(by_id.values()) + create_rows
    result.sort(key=lambda item: (int(item.get('sort_order') or 0), -abs(int(item.get('id') or 0))))
    return result


def _serialize_highlight(item: HighlightItem) -> dict:
    return {
        'id': int(item.id),
        'title': item.title,
        'description': item.description,
        'icon_name': item.icon_name,
        'sort_order': int(item.sort_order or 1),
        'is_active': bool(item.is_active),
        'created_at': item.created_at,
        'updated_at': item.updated_at,
    }


def list_admin_highlights_with_drafts(db: Session) -> list[dict]:
    rows = db.query(HighlightItem).order_by(HighlightItem.sort_order.asc(), HighlightItem.id.asc()).all()
    by_id = {int(item.id): _serialize_highlight(item) for item in rows}
    drafts = (
        db.query(PublicationDraft)
        .filter(PublicationDraft.entity_type == 'highlight')
        .order_by(PublicationDraft.updated_at.desc(), PublicationDraft.id.desc())
        .all()
    )
    create_rows = []
    for draft in drafts:
        payload = _get_payload(draft)
        if draft.action == 'create':
            create_rows.append({
                'id': -int(draft.id),
                'title': payload.get('title') or '',
                'description': payload.get('description') or '',
                'icon_name': payload.get('icon_name') or 'star',
                'sort_order': int(payload.get('sort_order') or 1),
                'is_active': bool(payload.get('is_active', True)),
                'created_at': None,
                'updated_at': None,
                'publication_status': 'draft_new',
                'draft_id': int(draft.id),
            })
            continue
        if not draft.entity_id or int(draft.entity_id) not in by_id:
            continue
        if draft.action == 'delete':
            by_id[int(draft.entity_id)]['publication_status'] = 'deletion_pending'
            by_id[int(draft.entity_id)]['draft_id'] = int(draft.id)
            continue
        updated = dict(by_id[int(draft.entity_id)])
        updated.update(payload)
        updated['publication_status'] = 'draft_update'
        updated['draft_id'] = int(draft.id)
        by_id[int(draft.entity_id)] = updated
    result = list(by_id.values()) + create_rows
    result.sort(key=lambda item: (int(item.get('sort_order') or 1), abs(int(item.get('id') or 0))))
    return result


def list_admin_promotions_with_drafts(db: Session) -> list[dict]:
    published = [serialize_promotion(db, item) for item in list_promotions(db)]
    by_id = {int(item['id']): item for item in published}
    drafts = (
        db.query(PublicationDraft)
        .filter(PublicationDraft.entity_type == 'promotion')
        .order_by(PublicationDraft.updated_at.desc(), PublicationDraft.id.desc())
        .all()
    )
    create_rows = []
    for draft in drafts:
        payload = _get_payload(draft)
        discount_type = payload.get('discount_type') or 'percentage'
        discount_value = float(payload.get('discount_value') or 0)
        row = {
            'id': -int(draft.id),
            'name': payload.get('name') or '',
            'description': payload.get('description'),
            'discount_type': discount_type,
            'discount_value': discount_value,
            'applies_to_all': bool(payload.get('applies_to_all')),
            'is_active': bool(payload.get('is_active', True)),
            'start_at': payload.get('start_at'),
            'end_at': payload.get('end_at'),
            'status': 'inactive',
            'promotion_badge': promotion_badge(discount_type, discount_value),
            'product_ids': list(payload.get('product_ids') or []),
            'affected_products_count': len(payload.get('product_ids') or []),
            'created_at': None,
            'updated_at': None,
            'draft_id': int(draft.id),
            'publication_status': 'draft_new',
        }
        if draft.action == 'create':
            create_rows.append(row)
            continue
        if not draft.entity_id or int(draft.entity_id) not in by_id:
            continue
        if draft.action == 'delete':
            by_id[int(draft.entity_id)]['publication_status'] = 'deletion_pending'
            by_id[int(draft.entity_id)]['draft_id'] = int(draft.id)
            continue

        updated = dict(by_id[int(draft.entity_id)])
        updated.update({k: row[k] for k in ['name', 'description', 'discount_type', 'discount_value', 'applies_to_all', 'is_active', 'start_at', 'end_at', 'product_ids', 'affected_products_count', 'promotion_badge']})
        updated['draft_id'] = int(draft.id)
        updated['publication_status'] = 'draft_update'
        updated['status'] = promotion_status(SimpleNamespace(**{
            'is_active': updated['is_active'],
            'start_at': datetime.fromisoformat(updated['start_at']) if isinstance(updated['start_at'], str) and updated['start_at'] else updated['start_at'],
            'end_at': datetime.fromisoformat(updated['end_at']) if isinstance(updated['end_at'], str) and updated['end_at'] else updated['end_at'],
        }))
        by_id[int(draft.entity_id)] = updated

    result = list(by_id.values()) + create_rows
    result.sort(key=lambda item: int(item.get('id') or 0), reverse=True)
    return result


def get_pending_publication_items(db: Session) -> list[dict]:
    items = []
    for draft in list_publication_drafts(db):
        payload = _get_payload(draft)
        title = payload.get('title') or payload.get('name') or payload.get('slug') or f'Item {draft.id}'
        if draft.entity_type == 'promotion':
            title = payload.get('name') or title
        action = draft.action
        if action == 'create':
            state_label = 'Rascunho novo'
        elif action == 'update':
            state_label = 'Edicao pendente'
        else:
            state_label = 'Exclusao pendente'
        items.append({
            'draft_id': draft.id,
            'entity_type': draft.entity_type,
            'entity_id': draft.entity_id,
            'action': draft.action,
            'status': state_label,
            'title': str(title),
            'updated_at': draft.updated_at,
            'created_at': draft.created_at,
        })
    return items


def _publish_product_draft(db: Session, draft: PublicationDraft) -> None:
    payload = _get_payload(draft)
    if draft.action == 'create':
        create_payload = AdminProductCreate.model_validate(payload)
        if admin_slug_exists(db, create_payload.slug):
            raise HTTPException(status_code=400, detail='Slug ja esta em uso por produto publicado.')
        admin_create_product(db, create_payload)
        return

    if not draft.entity_id:
        raise HTTPException(status_code=400, detail='Draft de produto invalido.')

    product = admin_get_product_by_id(db, int(draft.entity_id))
    if not product:
        raise HTTPException(status_code=404, detail='Produto publicado nao encontrado.')

    if draft.action == 'delete':
        db.delete(product)
        db.commit()
        return

    update_payload = AdminProductUpdate.model_validate(payload)
    if admin_slug_exists(db, update_payload.slug, ignore_id=product.id):
        raise HTTPException(status_code=400, detail='Slug ja esta em uso por outro produto.')
    admin_update_product(db, product, update_payload)


def _publish_banner_draft(db: Session, draft: PublicationDraft) -> None:
    payload = _get_payload(draft)
    if draft.action == 'create':
        create_banner(db, BannerCreate.model_validate(payload))
        return

    if not draft.entity_id:
        raise HTTPException(status_code=400, detail='Draft de banner invalido.')

    banner = get_banner(db, int(draft.entity_id))
    if not banner:
        raise HTTPException(status_code=404, detail='Banner publicado nao encontrado.')

    if draft.action == 'delete':
        db.delete(banner)
        db.commit()
        return

    update_banner(db, banner, BannerUpdate.model_validate(payload))


def _publish_highlight_draft(db: Session, draft: PublicationDraft) -> None:
    payload = _get_payload(draft)
    if draft.action == 'create':
        create_highlight_item(db, HighlightItemCreate.model_validate(payload))
        return

    if not draft.entity_id:
        raise HTTPException(status_code=400, detail='Draft de highlight invalido.')

    highlight = get_highlight_item_by_id(db, int(draft.entity_id))
    if not highlight:
        raise HTTPException(status_code=404, detail='Highlight publicado nao encontrado.')

    if draft.action == 'delete':
        db.delete(highlight)
        db.commit()
        return

    update_highlight_item(db, highlight, HighlightItemUpdate.model_validate(payload))


def _publish_promotion_draft(db: Session, draft: PublicationDraft) -> None:
    payload = _get_payload(draft)
    if draft.action == 'create':
        create_promotion(db, PromotionCreate.model_validate(payload))
        return

    if not draft.entity_id:
        raise HTTPException(status_code=400, detail='Draft de promocao invalido.')

    promotion = get_promotion_by_id(db, int(draft.entity_id))
    if not promotion:
        raise HTTPException(status_code=404, detail='Promocao publicada nao encontrada.')

    if draft.action == 'delete':
        db.delete(promotion)
        db.commit()
        return

    update_promotion(db, promotion, PromotionUpdate.model_validate(payload))


def publish_draft(db: Session, draft: PublicationDraft) -> None:
    handlers = {
        'product': _publish_product_draft,
        'banner': _publish_banner_draft,
        'highlight': _publish_highlight_draft,
        'promotion': _publish_promotion_draft,
    }
    handler = handlers.get(draft.entity_type)
    if not handler:
        raise HTTPException(status_code=400, detail='Entidade de publicacao nao suportada.')
    handler(db, draft)
    discard_draft(db, draft)


def publish_all_drafts(db: Session) -> dict:
    drafts = list_publication_drafts(db)
    published_count = 0
    for draft in drafts:
        publish_draft(db, draft)
        published_count += 1
    return {
        'ok': True,
        'published_count': published_count,
        'published_at': _now_iso(),
    }


def discard_draft_by_entity_and_id(db: Session, entity_type: str, raw_id: int) -> bool:
    normalized_type = _validate_entity_type(entity_type)
    entity_or_virtual_id = int(raw_id)
    draft: PublicationDraft | None = None

    if entity_or_virtual_id < 0:
        draft = find_draft_by_id(db, abs(entity_or_virtual_id))
    else:
        draft = get_entity_draft(db, normalized_type, entity_or_virtual_id)

    if not draft:
        return False
    discard_draft(db, draft)
    return True


def publish_draft_by_entity_and_id(db: Session, entity_type: str, raw_id: int) -> bool:
    normalized_type = _validate_entity_type(entity_type)
    entity_or_virtual_id = int(raw_id)
    draft: PublicationDraft | None = None

    if entity_or_virtual_id < 0:
        draft = find_draft_by_id(db, abs(entity_or_virtual_id))
    else:
        draft = get_entity_draft(db, normalized_type, entity_or_virtual_id)

    if not draft:
        return False
    publish_draft(db, draft)
    return True


def build_preview_products(db: Session, category_slug: str | None = None) -> list[dict]:
    products = list_admin_products_with_drafts(db)
    visible = [item for item in products if bool(item.get('is_active'))]
    if category_slug:
        category = (
            db.query(Category)
            .filter(Category.slug == str(category_slug).strip().lower(), Category.is_active == True)
            .first()
        )
        if not category:
            return []
        visible = [item for item in visible if int(item.get('category_id') or 0) == int(category.id)]
    return visible


def build_preview_product_by_slug(db: Session, slug: str) -> dict | None:
    normalized = str(slug or '').strip().lower()
    for item in list_admin_products_with_drafts(db):
        if str(item.get('slug') or '').strip().lower() == normalized and bool(item.get('is_active')):
            return item
    return None


def build_preview_banners(db: Session) -> list[dict]:
    rows = list_admin_banners_with_drafts(db)
    return [item for item in rows if bool(item.get('is_active')) and bool(item.get('show_in_carousel'))]


def build_preview_highlights(db: Session) -> list[dict]:
    rows = list_admin_highlights_with_drafts(db)
    active = [item for item in rows if bool(item.get('is_active'))]
    active.sort(key=lambda item: (int(item.get('sort_order') or 1), abs(int(item.get('id') or 0))))
    return active[:3]


def build_preview_promotions(db: Session) -> list[dict]:
    return list_admin_promotions_with_drafts(db)


def build_preview_most_ordered_products(db: Session, limit: int = 4) -> list[dict]:
    ranked = list_most_ordered_products(db, limit=limit)
    ranked_slugs = [item.slug for item in ranked if item and item.slug]
    all_preview = list_admin_products_with_drafts(db)
    by_slug = {str(item.get('slug')): item for item in all_preview}
    ordered = [by_slug[slug] for slug in ranked_slugs if slug in by_slug and bool(by_slug[slug].get('is_active'))]
    if len(ordered) < limit:
        fallback = [item for item in all_preview if bool(item.get('is_active')) and str(item.get('slug')) not in set(ranked_slugs)]
        ordered.extend(fallback[: max(0, limit - len(ordered))])
    return ordered[:limit]
