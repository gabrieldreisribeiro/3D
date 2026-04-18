from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_db
from app.services.product_service import category_by_id
from app.schemas import UserEventCreate, UserEventResponse
from app.services.analytics_service import create_user_event, parse_metadata
from app.services.review_service import get_product_by_id

router = APIRouter(tags=['events'])


@router.post('/events', response_model=UserEventResponse)
def create_event(payload: UserEventCreate, db: Session = Depends(get_db)):
    if payload.product_id is not None:
        product = get_product_by_id(db, payload.product_id)
        if not product:
            raise HTTPException(status_code=404, detail='Produto nao encontrado')
    if payload.category_id is not None:
        category = category_by_id(db, payload.category_id, include_inactive=True)
        if not category:
            raise HTTPException(status_code=404, detail='Categoria nao encontrada')

    event = create_user_event(db, payload)
    return UserEventResponse(
        id=event.id,
        event_type=event.event_type,
        product_id=event.product_id,
        category_id=event.category_id,
        session_id=event.session_id,
        user_identifier=event.user_identifier,
        page_url=event.page_url,
        source_channel=event.source_channel,
        referrer=event.referrer,
        cta_name=event.cta_name,
        metadata_json=parse_metadata(event.metadata_json),
        created_at=event.created_at,
    )
