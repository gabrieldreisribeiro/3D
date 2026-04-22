from __future__ import annotations


def normalize_email(value: str | None) -> str | None:
    normalized = str(value or '').strip().lower()
    return normalized or None


def normalize_phone(value: str | None) -> str | None:
    digits = ''.join(char for char in str(value or '') if char.isdigit())
    if not digits:
        return None
    # Se vier com 10 ou 11 digitos, assume Brasil e prefixa 55.
    if len(digits) in {10, 11} and not digits.startswith('55'):
        return f'55{digits}'
    return digits


def ensure_customer_identifier(email: str | None, phone: str | None) -> bool:
    return bool(normalize_email(email) or normalize_phone(phone))
