import base64
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Literal

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import ADMIN_TOKEN_EXPIRE_HOURS, ADMIN_TOKEN_SECRET
from app.db.session import SessionLocal
from app.models import AdminUser


auth_scheme = HTTPBearer(auto_error=False)
AdminRole = Literal['admin', 'super_admin']


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False

    if password_hash.startswith('$2a$') or password_hash.startswith('$2b$') or password_hash.startswith('$2y$'):
        try:
            return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
        except ValueError:
            return False

    # Compatibilidade legada com hashes antigos PBKDF2.
    try:
        salt_b64, digest_b64 = password_hash.split('$', 1)
    except ValueError:
        return False
    salt = base64.urlsafe_b64decode(salt_b64.encode())
    expected = base64.urlsafe_b64decode(digest_b64.encode())
    actual = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 120_000)
    return hmac.compare_digest(expected, actual)


def needs_password_rehash(password_hash: str) -> bool:
    if not password_hash:
        return True
    return not (
        password_hash.startswith('$2a$')
        or password_hash.startswith('$2b$')
        or password_hash.startswith('$2y$')
    )


def _sign(payload: str) -> str:
    signature = hmac.new(ADMIN_TOKEN_SECRET.encode('utf-8'), payload.encode('utf-8'), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(signature).decode().rstrip('=')


def create_admin_token(admin_id: int) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(hours=ADMIN_TOKEN_EXPIRE_HOURS)
    payload = f'{admin_id}:{int(expires_at.timestamp())}'
    token_raw = f'{payload}:{_sign(payload)}'
    return base64.urlsafe_b64encode(token_raw.encode('utf-8')).decode()


def parse_admin_token(token: str) -> int:
    try:
        decoded = base64.urlsafe_b64decode(token.encode('utf-8')).decode('utf-8')
        admin_id_raw, expires_raw, signature = decoded.split(':', 2)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Token invalido') from exc

    payload = f'{admin_id_raw}:{expires_raw}'
    if not hmac.compare_digest(signature, _sign(payload)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Token invalido')

    if int(expires_raw) < int(datetime.now(timezone.utc).timestamp()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Sessao expirada')

    return int(admin_id_raw)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_admin(
    credentials: HTTPAuthorizationCredentials = Depends(auth_scheme),
    db: Session = Depends(get_db),
) -> AdminUser:
    if not credentials or credentials.scheme.lower() != 'bearer':
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Nao autenticado')

    admin_id = parse_admin_token(credentials.credentials)
    admin = db.query(AdminUser).filter(
        AdminUser.id == admin_id,
        AdminUser.is_active == True,
        AdminUser.is_blocked == False,
    ).first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Acesso negado')

    return admin


def require_super_admin(admin: AdminUser = Depends(require_admin)) -> AdminUser:
    if admin.role != 'super_admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Acesso restrito a super administradores')
    return admin


def get_optional_admin(
    credentials: HTTPAuthorizationCredentials = Depends(auth_scheme),
    db: Session = Depends(get_db),
) -> AdminUser | None:
    if not credentials or credentials.scheme.lower() != 'bearer':
        return None
    try:
        admin_id = parse_admin_token(credentials.credentials)
    except HTTPException:
        return None
    return db.query(AdminUser).filter(
        AdminUser.id == admin_id,
        AdminUser.is_active == True,
        AdminUser.is_blocked == False,
    ).first()
