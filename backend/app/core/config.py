import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_SQLITE_URL = f"sqlite:///{BASE_DIR / 'app.db'}"


def _load_dotenv_file(dotenv_path: Path) -> None:
    if not dotenv_path.exists():
        return

    for raw_line in dotenv_path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue

        key, value = line.split('=', 1)
        key = key.strip()
        value = value.strip()

        if not key:
            continue

        if value and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]

        os.environ.setdefault(key, value)


def _normalize_database_url(url: str | None) -> str:
    value = str(url or '').strip()
    if not value:
        return DEFAULT_SQLITE_URL
    if value.startswith('postgres://'):
        return f"postgresql+psycopg://{value[len('postgres://'):]}"
    if value.startswith('postgresql://') and '+psycopg' not in value:
        return value.replace('postgresql://', 'postgresql+psycopg://', 1)
    return value


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}


_load_dotenv_file(BASE_DIR / '.env')
SQLALCHEMY_DATABASE_URL = _normalize_database_url(os.getenv('DATABASE_URL'))
SEED_SAMPLE_DATA = _env_bool('SEED_SAMPLE_DATA', default=False)
SEED_DEFAULT_ADMIN = _env_bool('SEED_DEFAULT_ADMIN', default=False)

ADMIN_TOKEN_SECRET = '3d-marketplace-admin-secret'
ADMIN_TOKEN_EXPIRE_HOURS = 12
CUSTOMER_TOKEN_SECRET = '3d-marketplace-customer-secret'
CUSTOMER_TOKEN_EXPIRE_HOURS = 24 * 30

UPLOADS_DIR = BASE_DIR / 'uploads'
LOGO_UPLOADS_DIR = UPLOADS_DIR / 'logo'
BANNER_UPLOADS_DIR = UPLOADS_DIR / 'banners'
PRODUCT_UPLOADS_DIR = UPLOADS_DIR / 'products'
FAVICON_UPLOADS_DIR = UPLOADS_DIR / 'favicon'
MODELS_3D_UPLOADS_DIR = UPLOADS_DIR / 'models3d'
MODELS_3D_ORIGINAL_UPLOADS_DIR = MODELS_3D_UPLOADS_DIR / 'original'
MODELS_3D_PREVIEW_UPLOADS_DIR = MODELS_3D_UPLOADS_DIR / 'preview'
REVIEW_UPLOADS_DIR = UPLOADS_DIR / 'reviews'
REVIEW_IMAGE_UPLOADS_DIR = REVIEW_UPLOADS_DIR / 'images'
REVIEW_VIDEO_UPLOADS_DIR = REVIEW_UPLOADS_DIR / 'videos'
PROJECT_UPLOADS_DIR = BASE_DIR.parent / 'uploads'


def ensure_upload_dirs() -> None:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    LOGO_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    BANNER_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    PRODUCT_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    FAVICON_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    MODELS_3D_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    MODELS_3D_ORIGINAL_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    MODELS_3D_PREVIEW_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    REVIEW_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    REVIEW_IMAGE_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    REVIEW_VIDEO_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    PROJECT_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
