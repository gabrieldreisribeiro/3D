import ipaddress
import json
from functools import lru_cache
from urllib import error, request

from fastapi import Request

GEO_TIMEOUT_SECONDS = 2.0


def _clean(value: str | None, max_len: int = 120) -> str | None:
    text = str(value or '').strip()
    if not text:
        return None
    return text[:max_len]


def extract_client_ip(req: Request) -> str | None:
    header = req.headers.get('x-forwarded-for') or req.headers.get('x-real-ip') or ''
    raw = header.split(',')[0].strip() if header else ''
    if not raw and req.client:
        raw = str(req.client.host or '').strip()
    if not raw:
        return None
    if raw.startswith('::ffff:'):
        raw = raw[7:]
    return raw[:120]


def _is_public_ip(ip_value: str) -> bool:
    try:
        parsed = ipaddress.ip_address(ip_value)
        return not (
            parsed.is_private
            or parsed.is_loopback
            or parsed.is_link_local
            or parsed.is_multicast
            or parsed.is_reserved
            or parsed.is_unspecified
        )
    except Exception:  # noqa: BLE001
        return False


@lru_cache(maxsize=4096)
def _lookup_geo(ip_value: str) -> dict:
    # Sem chave/API paga: usa ipwho.is com HTTPS.
    url = f'https://ipwho.is/{ip_value}'
    req = request.Request(url, headers={'User-Agent': '3d-marketplace/1.0'})
    with request.urlopen(req, timeout=GEO_TIMEOUT_SECONDS) as response:
        payload = response.read().decode('utf-8')
    data = json.loads(payload)
    if not isinstance(data, dict):
        return {}
    if data.get('success') is False:
        return {}
    return {
        'country': _clean(data.get('country')),
        'state': _clean(data.get('region')),
        'city': _clean(data.get('city')),
    }


def resolve_geo_by_ip(ip_value: str | None) -> dict:
    ip_clean = _clean(ip_value, max_len=120)
    if not ip_clean or not _is_public_ip(ip_clean):
        return {'country': None, 'state': None, 'city': None}
    try:
        data = _lookup_geo(ip_clean)
        return {
            'country': _clean(data.get('country')),
            'state': _clean(data.get('state')),
            'city': _clean(data.get('city')),
        }
    except (TimeoutError, error.URLError, ValueError, json.JSONDecodeError):
        return {'country': None, 'state': None, 'city': None}
