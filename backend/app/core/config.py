from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
SQLALCHEMY_DATABASE_URL = f"sqlite:///{BASE_DIR / 'app.db'}"

ADMIN_TOKEN_SECRET = '3d-marketplace-admin-secret'
ADMIN_TOKEN_EXPIRE_HOURS = 12

UPLOADS_DIR = BASE_DIR / 'uploads'
LOGO_UPLOADS_DIR = UPLOADS_DIR / 'logo'
BANNER_UPLOADS_DIR = UPLOADS_DIR / 'banners'
PROJECT_UPLOADS_DIR = BASE_DIR.parent / 'uploads'


def ensure_upload_dirs() -> None:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    LOGO_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    BANNER_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    PROJECT_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
