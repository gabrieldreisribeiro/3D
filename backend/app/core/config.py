from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
SQLALCHEMY_DATABASE_URL = f"sqlite:///{BASE_DIR / 'app.db'}"

ADMIN_TOKEN_SECRET = '3d-marketplace-admin-secret'
ADMIN_TOKEN_EXPIRE_HOURS = 12
