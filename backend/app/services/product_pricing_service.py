from decimal import Decimal, ROUND_HALF_UP
from types import SimpleNamespace

from fastapi import HTTPException

TWOPLACES = Decimal('0.01')


REQUIRED_PRICING_FIELDS = [
    'grams_filament',
    'price_kg_filament',
    'hours_printing',
    'avg_power_watts',
    'price_kwh',
    'total_hours_labor',
    'price_hour_labor',
    'extra_cost',
    'profit_margin',
    'manual_price',
]


def _to_decimal(value, field_name: str, allow_none: bool = False) -> Decimal:
    if value is None and allow_none:
        return Decimal('0')
    try:
        decimal_value = Decimal(str(value if value is not None else 0))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=f'Valor invalido para {field_name}.') from exc
    return decimal_value


def _money(value: Decimal) -> float:
    return float(value.quantize(TWOPLACES, rounding=ROUND_HALF_UP))


def _run_pricing(payload) -> dict:
    grams_filament = _to_decimal(payload.grams_filament, 'grams_filament')
    price_kg_filament = _to_decimal(payload.price_kg_filament, 'price_kg_filament')
    hours_printing = _to_decimal(payload.hours_printing, 'hours_printing')
    avg_power_watts = _to_decimal(payload.avg_power_watts, 'avg_power_watts')
    price_kwh = _to_decimal(payload.price_kwh, 'price_kwh')
    total_hours_labor = _to_decimal(payload.total_hours_labor, 'total_hours_labor')
    price_hour_labor = _to_decimal(payload.price_hour_labor, 'price_hour_labor')
    extra_cost = _to_decimal(payload.extra_cost, 'extra_cost')
    profit_margin_percent = _to_decimal(payload.profit_margin, 'profit_margin')
    manual_price = _to_decimal(payload.manual_price, 'manual_price', allow_none=True) if payload.manual_price is not None else None

    non_negative_fields = [
        ('grams_filament', grams_filament),
        ('price_kg_filament', price_kg_filament),
        ('hours_printing', hours_printing),
        ('avg_power_watts', avg_power_watts),
        ('price_kwh', price_kwh),
        ('total_hours_labor', total_hours_labor),
        ('price_hour_labor', price_hour_labor),
        ('extra_cost', extra_cost),
        ('profit_margin', profit_margin_percent),
    ]

    for field_name, value in non_negative_fields:
        if value < 0:
            raise HTTPException(status_code=422, detail=f'{field_name} nao pode ser negativo.')

    if manual_price is not None and manual_price < 0:
        raise HTTPException(status_code=422, detail='manual_price nao pode ser negativo.')

    if profit_margin_percent >= 100:
        raise HTTPException(status_code=422, detail='profit_margin deve ser menor que 100.')

    profit_margin_decimal = profit_margin_percent / Decimal('100')
    if profit_margin_decimal >= 1:
        raise HTTPException(status_code=422, detail='profit_margin invalido para calculo.')

    custo_filamento = (grams_filament / Decimal('1000')) * price_kg_filament
    kwh_usados = (avg_power_watts / Decimal('1000')) * hours_printing
    custo_energia = kwh_usados * price_kwh
    custo_mao_obra = total_hours_labor * price_hour_labor
    custo_extras = extra_cost

    custo_total = custo_filamento + custo_energia + custo_mao_obra + custo_extras

    denominador = Decimal('1') - profit_margin_decimal
    if denominador <= 0:
        raise HTTPException(status_code=422, detail='Margem invalida para calculo.')

    preco_venda_calculado = custo_total / denominador
    lucro_estimado = preco_venda_calculado - custo_total

    final_price = manual_price if manual_price is not None and manual_price > 0 else preco_venda_calculado

    return {
        'cost_total': _money(custo_total),
        'calculated_price': _money(preco_venda_calculado),
        'estimated_profit': _money(lucro_estimado),
        'final_price': _money(final_price),
    }


def calculate_product_pricing(payload) -> dict:
    return _run_pricing(payload)


def calculate_product_pricing_from_fields(fields: dict) -> dict:
    payload = SimpleNamespace(**{name: fields.get(name) for name in REQUIRED_PRICING_FIELDS})
    return _run_pricing(payload)
