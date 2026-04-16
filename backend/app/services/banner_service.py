from sqlalchemy.orm import Session

from app.models import Banner


def list_public_banners(db: Session):
    return (
        db.query(Banner)
        .filter(Banner.is_active == True, Banner.show_in_carousel == True)
        .order_by(Banner.sort_order.asc(), Banner.id.desc())
        .all()
    )


def list_admin_banners(db: Session):
    return db.query(Banner).order_by(Banner.sort_order.asc(), Banner.id.desc()).all()


def get_banner(db: Session, banner_id: int):
    return db.query(Banner).filter(Banner.id == banner_id).first()


def create_banner(db: Session, payload):
    banner = Banner(**payload.model_dump())
    db.add(banner)
    db.commit()
    db.refresh(banner)
    return banner


def update_banner(db: Session, banner: Banner, payload):
    data = payload.model_dump()
    for key, value in data.items():
        setattr(banner, key, value)
    db.commit()
    db.refresh(banner)
    return banner


def delete_banner(db: Session, banner: Banner):
    db.delete(banner)
    db.commit()
