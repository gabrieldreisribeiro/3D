from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_db
from app.schemas import BannerResponse, LogoResponse
from app.services.banner_service import list_public_banners
from app.services.logo_service import get_public_logo_url

router = APIRouter(prefix='/public', tags=['public'])


@router.get('/logo', response_model=LogoResponse)
def read_public_logo():
    return LogoResponse(url=get_public_logo_url())


@router.get('/banners', response_model=list[BannerResponse])
def read_public_banners(db: Session = Depends(get_db)):
    return list_public_banners(db)
