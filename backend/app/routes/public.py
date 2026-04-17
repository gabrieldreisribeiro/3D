from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_db
from app.schemas import BannerResponse, LogoResponse, StoreSettingsResponse
from app.services.banner_service import list_public_banners
from app.services.logo_service import get_public_logo_url
from app.services.settings_service import get_or_create_settings

router = APIRouter(prefix='/public', tags=['public'])


@router.get('/logo', response_model=LogoResponse)
def read_public_logo():
    return LogoResponse(url=get_public_logo_url())


@router.get('/banners', response_model=list[BannerResponse])
def read_public_banners(db: Session = Depends(get_db)):
    return list_public_banners(db)


@router.get('/settings', response_model=StoreSettingsResponse)
def read_public_settings(db: Session = Depends(get_db)):
    settings = get_or_create_settings(db)
    return StoreSettingsResponse(
        whatsapp_number=settings.whatsapp_number,
        pix_key=settings.pix_key,
    )
