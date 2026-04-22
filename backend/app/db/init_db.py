from sqlalchemy import text

from app.core.config import SEED_DEFAULT_ADMIN, SEED_SAMPLE_DATA
from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine
from app.models import (
    AdminUser,
    Banner,
    Category,
    Coupon,
    EmailLog,
    EmailProviderConfig,
    EmailTemplate,
    HighlightItem,
    Order,
    OrderFlowStage,
    OrderStageHistory,
    PaymentProviderInfinitePayConfig,
    Product,
    Product3DModel,
    ProductReview,
    StoreSettings,
)

PRODUCTS = [
]

CATEGORIES = [
]

COUPONS = [
]

BANNERS = [
]

HIGHLIGHTS = [
    {
        'title': 'Pronto para uso',
        'description': 'Design premium com acabamento impecavel',
        'icon_name': 'badge-check',
        'sort_order': 1,
        'is_active': True,
    },
    {
        'title': 'Envio rapido',
        'description': 'Prazo de 1 dia apos confirmacao do pagamento',
        'icon_name': 'clock',
        'sort_order': 2,
        'is_active': True,
    },
    {
        'title': 'Compra segura',
        'description': 'Checkout protegido e suporte em todo o processo',
        'icon_name': 'shield',
        'sort_order': 3,
        'is_active': True,
    },
]

DEFAULT_EMAIL_TEMPLATES = [
    {
        'key': 'password_reset',
        'name': 'Recuperacao de senha',
        'subject_template': 'Redefinicao de senha - {{nome}}',
        'body_html_template': (
            '<p>Ola {{primeiro_nome}},</p>'
            '<p>Recebemos uma solicitacao para redefinir sua senha.</p>'
            '<p><a href="{{reset_link}}">Clique aqui para redefinir sua senha</a></p>'
            '<p>Este link/token expira em {{token_expiration}}.</p>'
        ),
        'body_text_template': (
            'Ola {{primeiro_nome}}, use o link {{reset_link}} para redefinir sua senha. '
            'Expira em {{token_expiration}}.'
        ),
        'variables_json': '["nome","primeiro_nome","email","reset_link","token_expiration"]',
        'is_active': True,
    },
    {
        'key': 'order_success',
        'name': 'Pedido criado com sucesso',
        'subject_template': 'Pedido #{{order_id}} recebido com sucesso',
        'body_html_template': (
            '<p>Ola {{primeiro_nome}}, seu pedido <strong>#{{order_id}}</strong> foi recebido.</p>'
            '<p>Total: {{order_total}} | Pagamento: {{payment_method}} ({{payment_status}})</p>'
            '<p>Itens:</p><pre>{{items_summary}}</pre>'
            '<p><a href="{{account_link}}">Acompanhar minhas compras</a></p>'
        ),
        'body_text_template': (
            'Pedido #{{order_id}} recebido em {{order_date}}. '
            'Total {{order_total}}. Pagamento: {{payment_method}} ({{payment_status}}). '
            'Itens: {{items_summary}}. Conta: {{account_link}}.'
        ),
        'variables_json': (
            '["nome","primeiro_nome","order_id","order_date","order_total","payment_method",'
            '"payment_status","items_summary","account_link","receipt_url"]'
        ),
        'is_active': True,
    },
    {
        'key': 'promotion_marketing',
        'name': 'Promocao marketing',
        'subject_template': '{{promotion_title}} - Oferta especial para voce',
        'body_html_template': (
            '<p>{{promotion_description}}</p>'
            '<p>Cupom: <strong>{{coupon_code}}</strong></p>'
            '<p><a href="{{promotion_link}}">Aproveitar promocao</a></p>'
        ),
        'body_text_template': (
            '{{promotion_title}} - {{promotion_description}} '
            'Cupom: {{coupon_code}} Link: {{promotion_link}}'
        ),
        'variables_json': '["nome","primeiro_nome","promotion_title","promotion_description","coupon_code","promotion_link"]',
        'is_active': True,
    },
    {
        'key': 'account_created',
        'name': 'Conta criada',
        'subject_template': 'Conta criada com sucesso',
        'body_html_template': (
            '<p>Ola {{primeiro_nome}}, sua conta foi criada com sucesso.</p>'
            '<p><a href="{{account_link}}">Acessar minha conta</a></p>'
        ),
        'body_text_template': 'Conta criada com sucesso. Acesse: {{account_link}}',
        'variables_json': '["nome","primeiro_nome","login_email","account_link"]',
        'is_active': True,
    },
    {
        'key': 'order_paid',
        'name': 'Pagamento confirmado',
        'subject_template': 'Pagamento confirmado - Pedido #{{order_id}}',
        'body_html_template': (
            '<p>Pagamento confirmado para o pedido <strong>#{{order_id}}</strong>.</p>'
            '<p>Total pago: {{order_total}} | Metodo: {{payment_method}}</p>'
            '<p><a href="{{receipt_url}}">Baixar comprovante</a></p>'
        ),
        'body_text_template': (
            'Pagamento confirmado para o pedido #{{order_id}}. '
            'Total pago {{order_total}}. Metodo {{payment_method}}. '
            'Comprovante: {{receipt_url}}'
        ),
        'variables_json': '["order_id","order_total","payment_method","payment_status","receipt_url","account_link"]',
        'is_active': True,
    },
]


def _normalize_postgres_column_ddl(column_ddl: str) -> str:
    ddl = str(column_ddl or '').strip()
    if not ddl:
        return ddl
    ddl = ddl.replace('DATETIME', 'TIMESTAMP')
    ddl = ddl.replace('BOOLEAN DEFAULT 0', 'BOOLEAN DEFAULT FALSE')
    ddl = ddl.replace('BOOLEAN DEFAULT 1', 'BOOLEAN DEFAULT TRUE')
    return ddl


def _ensure_orders_created_at_column(session):
    if session.bind.dialect.name != 'sqlite':
        return
    columns = session.execute(text("PRAGMA table_info('orders')")).fetchall()
    names = {column[1] for column in columns}
    has_created_at = 'created_at' in names
    if not has_created_at:
        session.execute(text("ALTER TABLE orders ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"))
    if 'payment_status' not in names:
        session.execute(text("ALTER TABLE orders ADD COLUMN payment_status VARCHAR(20) DEFAULT 'pending'"))
    if 'payment_method' not in names:
        session.execute(text("ALTER TABLE orders ADD COLUMN payment_method VARCHAR(30)"))
    session.execute(text("UPDATE orders SET payment_status = COALESCE(payment_status, 'pending')"))
    session.commit()


def _ensure_orders_payment_columns(session):
    required_columns = {
        'customer_account_id': "INTEGER",
        'payment_provider': "VARCHAR(40)",
        'sales_channel': "VARCHAR(30) DEFAULT 'whatsapp'",
        'customer_email_snapshot': "VARCHAR(180)",
        'customer_phone_snapshot': "VARCHAR(40)",
        'shipping_address_snapshot': "TEXT",
        'order_nsu': "VARCHAR(120)",
        'invoice_slug': "VARCHAR(160)",
        'transaction_nsu': "VARCHAR(160)",
        'receipt_url': "VARCHAR(600)",
        'checkout_url': "VARCHAR(600)",
        'capture_method': "VARCHAR(40)",
        'paid_amount': "REAL",
        'installments': "INTEGER",
        'paid_at': "DATETIME",
        'current_stage_id': "INTEGER",
        'current_stage_updated_at': "DATETIME",
        'production_status': "VARCHAR(20)",
        'production_started_at': "DATETIME",
        'estimated_ready_at': "DATETIME",
        'ready_at': "DATETIME",
        'payment_metadata_json': "TEXT DEFAULT '{}'",
    }
    dialect = session.bind.dialect.name
    if dialect == 'sqlite':
        columns = session.execute(text("PRAGMA table_info('orders')")).fetchall()
        names = {column[1] for column in columns}
        for column_name, column_ddl in required_columns.items():
            if column_name not in names:
                session.execute(text(f"ALTER TABLE orders ADD COLUMN {column_name} {column_ddl}"))
    elif dialect.startswith('postgres'):
        for column_name, column_ddl in required_columns.items():
            session.execute(
                text(
                    f"ALTER TABLE orders ADD COLUMN IF NOT EXISTS {column_name} "
                    f"{_normalize_postgres_column_ddl(column_ddl)}"
                )
            )
    else:
        return

    session.execute(text("UPDATE orders SET payment_metadata_json = COALESCE(NULLIF(payment_metadata_json, ''), '{}')"))
    session.execute(text("UPDATE orders SET sales_channel = COALESCE(NULLIF(sales_channel, ''), 'whatsapp')"))
    session.execute(
        text(
            """
            UPDATE orders
            SET payment_provider = CASE
                WHEN LOWER(COALESCE(payment_method, '')) = 'whatsapp' THEN 'whatsapp'
                WHEN LOWER(COALESCE(payment_method, '')) IN ('pix', 'credit_card') THEN 'infinitepay'
                ELSE payment_provider
            END
            """
        )
    )
    session.execute(
        text(
            """
            UPDATE orders
            SET sales_channel = CASE
                WHEN LOWER(COALESCE(payment_method, '')) = 'whatsapp' THEN 'whatsapp'
                WHEN LOWER(COALESCE(payment_method, '')) IN ('pix', 'credit_card') THEN 'online_checkout'
                ELSE sales_channel
            END
            """
        )
    )
    session.execute(
        text(
            """
            UPDATE orders
            SET production_status = 'paid'
            WHERE LOWER(COALESCE(payment_status, '')) = 'paid'
              AND COALESCE(NULLIF(production_status, ''), '') = ''
            """
        )
    )
    session.execute(text("CREATE INDEX IF NOT EXISTS ix_orders_order_nsu ON orders(order_nsu)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS ix_orders_invoice_slug ON orders(invoice_slug)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS ix_orders_transaction_nsu ON orders(transaction_nsu)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS ix_orders_customer_account_id ON orders(customer_account_id)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS ix_orders_customer_email_snapshot ON orders(customer_email_snapshot)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS ix_orders_customer_phone_snapshot ON orders(customer_phone_snapshot)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS ix_orders_current_stage_id ON orders(current_stage_id)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS ix_orders_production_status ON orders(production_status)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS ix_orders_estimated_ready_at ON orders(estimated_ready_at)"))
    session.commit()


def _ensure_order_flow_tables(session):
    dialect = session.bind.dialect.name
    if dialect == 'sqlite':
        session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS order_flow_stages (
                    id INTEGER PRIMARY KEY,
                    name VARCHAR(120) NOT NULL,
                    description VARCHAR(260),
                    color VARCHAR(30),
                    icon_name VARCHAR(60),
                    sort_order INTEGER NOT NULL DEFAULT 1,
                    is_active BOOLEAN NOT NULL DEFAULT 1,
                    is_visible_to_customer BOOLEAN NOT NULL DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS order_stage_history (
                    id INTEGER PRIMARY KEY,
                    order_id INTEGER NOT NULL,
                    stage_id INTEGER,
                    moved_by_admin_user_id INTEGER,
                    note VARCHAR(400),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
                    FOREIGN KEY(stage_id) REFERENCES order_flow_stages(id) ON DELETE SET NULL,
                    FOREIGN KEY(moved_by_admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
                )
                """
            )
        )
    elif dialect.startswith('postgres'):
        session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS order_flow_stages (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(120) NOT NULL,
                    description VARCHAR(260),
                    color VARCHAR(30),
                    icon_name VARCHAR(60),
                    sort_order INTEGER NOT NULL DEFAULT 1,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    is_visible_to_customer BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS order_stage_history (
                    id SERIAL PRIMARY KEY,
                    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                    stage_id INTEGER REFERENCES order_flow_stages(id) ON DELETE SET NULL,
                    moved_by_admin_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
                    note VARCHAR(400),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
    else:
        return

    session.execute(text("CREATE INDEX IF NOT EXISTS ix_order_flow_stages_sort_order ON order_flow_stages(sort_order)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS ix_order_flow_stages_is_active ON order_flow_stages(is_active)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS ix_order_stage_history_order_id ON order_stage_history(order_id)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS ix_order_stage_history_stage_id ON order_stage_history(stage_id)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS ix_order_stage_history_created_at ON order_stage_history(created_at)"))
    session.commit()

    if session.query(OrderFlowStage).count() == 0:
        default_stages = [
            OrderFlowStage(name='Pedido recebido', description='Pedido criado no sistema', color='#64748B', icon_name='inbox', sort_order=1, is_active=True, is_visible_to_customer=True),
            OrderFlowStage(name='Pago', description='Pagamento confirmado', color='#16A34A', icon_name='check-circle', sort_order=2, is_active=True, is_visible_to_customer=True),
            OrderFlowStage(name='Em producao', description='Pedido em producao', color='#2563EB', icon_name='cog', sort_order=3, is_active=True, is_visible_to_customer=True),
            OrderFlowStage(name='Pronto', description='Pedido pronto para envio/retirada', color='#7C3AED', icon_name='package-check', sort_order=4, is_active=True, is_visible_to_customer=True),
            OrderFlowStage(name='Enviado', description='Pedido enviado', color='#F59E0B', icon_name='truck', sort_order=5, is_active=True, is_visible_to_customer=True),
            OrderFlowStage(name='Entregue', description='Pedido finalizado', color='#059669', icon_name='home', sort_order=6, is_active=True, is_visible_to_customer=True),
        ]
        for stage in default_stages:
            session.add(stage)
        session.commit()

    stages = session.query(OrderFlowStage).order_by(OrderFlowStage.sort_order.asc(), OrderFlowStage.id.asc()).all()
    if not stages:
        return
    first_stage = stages[0]
    paid_stage = next((stage for stage in stages if 'pago' in str(stage.name or '').strip().lower() or 'paid' in str(stage.name or '').strip().lower()), first_stage)
    production_stage = next((stage for stage in stages if 'produc' in str(stage.name or '').strip().lower()), paid_stage)
    ready_stage = next((stage for stage in stages if 'pronto' in str(stage.name or '').strip().lower() or 'ready' in str(stage.name or '').strip().lower()), production_stage)

    rows = session.query(Order).filter(Order.current_stage_id.is_(None)).all()
    changed = False
    for row in rows:
        payment_status = str(row.payment_status or '').strip().lower()
        production_status = str(row.production_status or '').strip().lower()
        target = first_stage
        if production_status == 'ready':
            target = ready_stage
        elif production_status == 'in_production':
            target = production_stage
        elif payment_status == 'paid':
            target = paid_stage
        row.current_stage_id = target.id
        row.current_stage_updated_at = row.current_stage_updated_at or row.created_at
        session.add(row)
        if session.query(OrderStageHistory).filter(OrderStageHistory.order_id == row.id).first() is None:
            session.add(
                OrderStageHistory(
                    order_id=row.id,
                    stage_id=target.id,
                    moved_by_admin_user_id=None,
                    note='auto_bootstrap_stage_assignment',
                )
            )
        changed = True
    if changed:
        session.commit()


def _ensure_infinitepay_config_table(session):
    dialect = session.bind.dialect.name
    if dialect == 'sqlite':
        session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS payment_provider_infinitepay_config (
                    id INTEGER PRIMARY KEY,
                    is_enabled BOOLEAN NOT NULL DEFAULT 0,
                    handle VARCHAR(120),
                    redirect_url VARCHAR(500),
                    webhook_url VARCHAR(500),
                    default_currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
                    success_page_url VARCHAR(500),
                    cancel_page_url VARCHAR(500),
                    test_mode BOOLEAN NOT NULL DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        session.commit()
    elif dialect.startswith('postgres'):
        session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS payment_provider_infinitepay_config (
                    id INTEGER PRIMARY KEY,
                    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                    handle VARCHAR(120),
                    redirect_url VARCHAR(500),
                    webhook_url VARCHAR(500),
                    default_currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
                    success_page_url VARCHAR(500),
                    cancel_page_url VARCHAR(500),
                    test_mode BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        session.commit()


def _ensure_customer_accounts_tables(session):
    dialect = session.bind.dialect.name
    if dialect == 'sqlite':
        session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS customer_accounts (
                    id INTEGER PRIMARY KEY,
                    full_name VARCHAR(180) NOT NULL,
                    email VARCHAR(180) NOT NULL UNIQUE,
                    phone_number VARCHAR(40) NOT NULL,
                    password_hash VARCHAR(300) NOT NULL,
                    is_active BOOLEAN DEFAULT 1,
                    email_verified BOOLEAN DEFAULT 0,
                    phone_verified BOOLEAN DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_login_at DATETIME
                )
                """
            )
        )
        session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS customer_password_reset_tokens (
                    id INTEGER PRIMARY KEY,
                    customer_account_id INTEGER NOT NULL,
                    token VARCHAR(220) NOT NULL UNIQUE,
                    is_used BOOLEAN DEFAULT 0,
                    expires_at DATETIME NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(customer_account_id) REFERENCES customer_accounts(id) ON DELETE CASCADE
                )
                """
            )
        )
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_customer_accounts_email ON customer_accounts(email)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_customer_accounts_phone_number ON customer_accounts(phone_number)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_customer_password_reset_tokens_token ON customer_password_reset_tokens(token)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_customer_password_reset_tokens_account_id ON customer_password_reset_tokens(customer_account_id)"))
        session.commit()
        return

    if dialect.startswith('postgres'):
        session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS customer_accounts (
                    id SERIAL PRIMARY KEY,
                    full_name VARCHAR(180) NOT NULL,
                    email VARCHAR(180) NOT NULL UNIQUE,
                    phone_number VARCHAR(40) NOT NULL,
                    password_hash VARCHAR(300) NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    email_verified BOOLEAN DEFAULT FALSE,
                    phone_verified BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login_at TIMESTAMP
                )
                """
            )
        )
        session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS customer_password_reset_tokens (
                    id SERIAL PRIMARY KEY,
                    customer_account_id INTEGER NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
                    token VARCHAR(220) NOT NULL UNIQUE,
                    is_used BOOLEAN DEFAULT FALSE,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_customer_accounts_email ON customer_accounts(email)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_customer_accounts_phone_number ON customer_accounts(phone_number)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_customer_password_reset_tokens_token ON customer_password_reset_tokens(token)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_customer_password_reset_tokens_account_id ON customer_password_reset_tokens(customer_account_id)"))
        session.commit()
    existing = session.query(PaymentProviderInfinitePayConfig).first()
    if not existing:
        session.add(
            PaymentProviderInfinitePayConfig(
                id=1,
                is_enabled=False,
                handle=None,
                redirect_url=None,
                webhook_url=None,
                default_currency='BRL',
                success_page_url=None,
                cancel_page_url=None,
                test_mode=False,
            )
        )
        session.commit()


def _ensure_order_items_columns(session):
    required_columns = {
        'line_total': "REAL DEFAULT 0",
        'production_days_snapshot': "INTEGER DEFAULT 1",
        'selected_color': "VARCHAR(20)",
        'selected_secondary_color': "VARCHAR(20)",
        'selected_sub_items': "TEXT DEFAULT ''",
        'name_personalizations': "TEXT DEFAULT ''",
    }
    if session.bind.dialect.name == 'sqlite':
        columns = session.execute(text("PRAGMA table_info('order_items')")).fetchall()
        names = {column[1] for column in columns}
        for column_name, column_ddl in required_columns.items():
            if column_name not in names:
                session.execute(text(f"ALTER TABLE order_items ADD COLUMN {column_name} {column_ddl}"))
    elif session.bind.dialect.name.startswith('postgres'):
        for column_name, column_ddl in required_columns.items():
            session.execute(
                text(
                    f"ALTER TABLE order_items ADD COLUMN IF NOT EXISTS {column_name} "
                    f"{_normalize_postgres_column_ddl(column_ddl)}"
                )
            )
    else:
        return

    session.execute(text("UPDATE order_items SET line_total = COALESCE(line_total, unit_price * quantity)"))
    session.execute(text("UPDATE order_items SET production_days_snapshot = COALESCE(production_days_snapshot, 1)"))
    session.execute(text("UPDATE order_items SET production_days_snapshot = 1 WHERE production_days_snapshot <= 0"))
    session.commit()


def _ensure_coupon_columns(session):
    if session.bind.dialect.name != 'sqlite':
        return
    columns = session.execute(text("PRAGMA table_info('coupons')")).fetchall()
    names = {column[1] for column in columns}
    if 'expires_at' not in names:
        session.execute(text("ALTER TABLE coupons ADD COLUMN expires_at DATETIME"))
    if 'max_uses' not in names:
        session.execute(text("ALTER TABLE coupons ADD COLUMN max_uses INTEGER"))
    if 'uses_count' not in names:
        session.execute(text("ALTER TABLE coupons ADD COLUMN uses_count INTEGER DEFAULT 0"))
    session.execute(text("UPDATE coupons SET uses_count = COALESCE(uses_count, 0)"))
    session.commit()


def _ensure_product_pricing_columns(session):
    required_columns = {
        'category_id': "INTEGER",
        'sub_items': "TEXT DEFAULT ''",
        'lead_time_hours': "REAL DEFAULT 0",
        'production_days': "INTEGER DEFAULT 1",
        'allow_colors': "BOOLEAN DEFAULT 0",
        'available_colors': "TEXT DEFAULT ''",
        'allow_secondary_color': "BOOLEAN DEFAULT 0",
        'secondary_color_pairs': "TEXT DEFAULT ''",
        'allow_name_personalization': "BOOLEAN DEFAULT 0",
        'width_mm': "REAL",
        'height_mm': "REAL",
        'depth_mm': "REAL",
        'dimensions_source': "VARCHAR(20) DEFAULT 'manual'",
        'grams_filament': "REAL DEFAULT 0",
        'price_kg_filament': "REAL DEFAULT 0",
        'hours_printing': "REAL DEFAULT 0",
        'avg_power_watts': "REAL DEFAULT 0",
        'price_kwh': "REAL DEFAULT 0",
        'total_hours_labor': "REAL DEFAULT 0",
        'price_hour_labor': "REAL DEFAULT 0",
        'extra_cost': "REAL DEFAULT 0",
        'profit_margin': "REAL DEFAULT 0",
        'cost_total': "REAL DEFAULT 0",
        'calculated_price': "REAL DEFAULT 0",
        'estimated_profit': "REAL DEFAULT 0",
        'manual_price': "REAL",
        'final_price': "REAL DEFAULT 0",
        'publish_to_instagram': "BOOLEAN DEFAULT 0",
        'instagram_caption': "TEXT",
        'instagram_hashtags': "TEXT",
        'instagram_post_status': "VARCHAR(30) DEFAULT 'not_published'",
        'instagram_post_id': "VARCHAR(120)",
        'instagram_published_at': "DATETIME",
        'instagram_error_message': "TEXT",
        'is_draft': "BOOLEAN DEFAULT 0",
        'generated_by_ai': "BOOLEAN DEFAULT 0",
        'source_ad_generation_id': "INTEGER",
    }

    if session.bind.dialect.name == 'sqlite':
        columns = session.execute(text("PRAGMA table_info('products')")).fetchall()
        names = {column[1] for column in columns}
        changed = False
        for column_name, column_ddl in required_columns.items():
            if column_name not in names:
                session.execute(text(f"ALTER TABLE products ADD COLUMN {column_name} {column_ddl}"))
                changed = True

        if changed:
            session.commit()
    elif session.bind.dialect.name.startswith('postgres'):
        for column_name, column_ddl in required_columns.items():
            session.execute(
                text(
                    f"ALTER TABLE products ADD COLUMN IF NOT EXISTS {column_name} "
                    f"{_normalize_postgres_column_ddl(column_ddl)}"
                )
            )
        session.commit()
    else:
        return

    session.execute(text("UPDATE products SET instagram_post_status = COALESCE(instagram_post_status, 'not_published')"))
    session.execute(text("UPDATE products SET dimensions_source = COALESCE(NULLIF(dimensions_source, ''), 'manual')"))
    session.execute(text("UPDATE products SET production_days = COALESCE(production_days, 1)"))
    session.execute(text("UPDATE products SET production_days = 1 WHERE production_days <= 0"))
    session.commit()


def _ensure_store_settings_columns(session):
    required_columns = {
        'favicon_url': "VARCHAR(500)",
        'logs_enabled': "BOOLEAN DEFAULT 1",
        'logs_capture_request_body': "BOOLEAN DEFAULT 1",
        'logs_capture_response_body': "BOOLEAN DEFAULT 0",
        'logs_capture_integrations': "BOOLEAN DEFAULT 1",
        'logs_capture_webhooks': "BOOLEAN DEFAULT 1",
        'logs_min_level': "VARCHAR(20) DEFAULT 'info'",
        'instagram_enabled': "BOOLEAN DEFAULT 0",
        'instagram_app_id': "VARCHAR(120)",
        'instagram_app_secret': "VARCHAR(220)",
        'instagram_access_token': "VARCHAR(600)",
        'instagram_user_id': "VARCHAR(120)",
        'instagram_page_id': "VARCHAR(120)",
        'instagram_default_caption': "TEXT",
        'instagram_default_hashtags': "TEXT",
        'instagram_auto_publish_default': "BOOLEAN DEFAULT 0",
        'meta_pixel_enabled': "BOOLEAN DEFAULT 0",
        'meta_pixel_pixel_id': "VARCHAR(64)",
        'meta_pixel_auto_page_view': "BOOLEAN DEFAULT 1",
        'meta_pixel_track_product_events': "BOOLEAN DEFAULT 1",
        'meta_pixel_track_cart_events': "BOOLEAN DEFAULT 1",
        'meta_pixel_track_whatsapp_as_lead': "BOOLEAN DEFAULT 1",
        'meta_pixel_track_order_created': "BOOLEAN DEFAULT 1",
        'meta_pixel_test_event_code': "VARCHAR(120)",
    }

    if session.bind.dialect.name == 'sqlite':
        columns = session.execute(text("PRAGMA table_info('store_settings')")).fetchall()
        names = {column[1] for column in columns}
        changed = False
        for column_name, column_ddl in required_columns.items():
            if column_name not in names:
                session.execute(text(f"ALTER TABLE store_settings ADD COLUMN {column_name} {column_ddl}"))
                changed = True
        if changed:
            session.commit()
        return

    if session.bind.dialect.name.startswith('postgres'):
        for column_name, column_ddl in required_columns.items():
            session.execute(
                text(
                    f"ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS {column_name} "
                    f"{_normalize_postgres_column_ddl(column_ddl)}"
                )
            )
        session.commit()


def _ensure_system_logs_table(session):
    dialect = session.bind.dialect.name
    if dialect == 'sqlite':
        session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS system_logs (
                    id INTEGER PRIMARY KEY,
                    level VARCHAR(20) NOT NULL DEFAULT 'info',
                    category VARCHAR(40) NOT NULL DEFAULT 'http',
                    action_name VARCHAR(160),
                    request_method VARCHAR(10),
                    request_path VARCHAR(500),
                    request_query TEXT,
                    request_headers_json TEXT DEFAULT '{}',
                    request_body_json TEXT,
                    response_status INTEGER,
                    response_headers_json TEXT DEFAULT '{}',
                    response_body_json TEXT,
                    duration_ms REAL,
                    response_size_bytes INTEGER,
                    admin_user_id INTEGER,
                    session_id VARCHAR(160),
                    ip_address VARCHAR(120),
                    user_agent VARCHAR(600),
                    entity_type VARCHAR(80),
                    entity_id VARCHAR(80),
                    source_system VARCHAR(80),
                    error_message TEXT,
                    stack_trace TEXT,
                    metadata_json TEXT DEFAULT '{}',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
                )
                """
            )
        )
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_system_logs_created_at ON system_logs(created_at)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_system_logs_level ON system_logs(level)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_system_logs_category ON system_logs(category)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_system_logs_request_path ON system_logs(request_path)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_system_logs_response_status ON system_logs(response_status)"))
        session.commit()
        return

    if dialect.startswith('postgres'):
        session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS system_logs (
                    id SERIAL PRIMARY KEY,
                    level VARCHAR(20) NOT NULL DEFAULT 'info',
                    category VARCHAR(40) NOT NULL DEFAULT 'http',
                    action_name VARCHAR(160),
                    request_method VARCHAR(10),
                    request_path VARCHAR(500),
                    request_query TEXT,
                    request_headers_json TEXT DEFAULT '{}',
                    request_body_json TEXT,
                    response_status INTEGER,
                    response_headers_json TEXT DEFAULT '{}',
                    response_body_json TEXT,
                    duration_ms DOUBLE PRECISION,
                    response_size_bytes INTEGER,
                    admin_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
                    session_id VARCHAR(160),
                    ip_address VARCHAR(120),
                    user_agent VARCHAR(600),
                    entity_type VARCHAR(80),
                    entity_id VARCHAR(80),
                    source_system VARCHAR(80),
                    error_message TEXT,
                    stack_trace TEXT,
                    metadata_json TEXT DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_system_logs_created_at ON system_logs(created_at)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_system_logs_level ON system_logs(level)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_system_logs_category ON system_logs(category)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_system_logs_request_path ON system_logs(request_path)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_system_logs_response_status ON system_logs(response_status)"))
        session.commit()


def _ensure_user_events_columns(session):
    required_columns = {
        'category_id': 'INTEGER',
        'page_url': 'VARCHAR(500)',
        'source_channel': 'VARCHAR(80)',
        'referrer': 'VARCHAR(500)',
        'cta_name': 'VARCHAR(120)',
        'ip_address': 'VARCHAR(120)',
        'country': 'VARCHAR(120)',
        'state': 'VARCHAR(120)',
        'city': 'VARCHAR(120)',
    }
    if session.bind.dialect.name == 'sqlite':
        columns = session.execute(text("PRAGMA table_info('user_events')")).fetchall()
        names = {column[1] for column in columns}
        changed = False
        for column_name, column_ddl in required_columns.items():
            if column_name not in names:
                session.execute(text(f"ALTER TABLE user_events ADD COLUMN {column_name} {column_ddl}"))
                changed = True
        if changed:
            session.commit()
        return

    if session.bind.dialect.name.startswith('postgres'):
        for column_name, column_ddl in required_columns.items():
            session.execute(text(f"ALTER TABLE user_events ADD COLUMN IF NOT EXISTS {column_name} {column_ddl}"))
        session.commit()


def _ensure_email_tables(session):
    dialect = session.bind.dialect.name
    if dialect == 'sqlite':
        session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS email_provider_config (
                    id INTEGER PRIMARY KEY,
                    provider_name VARCHAR(80) NOT NULL DEFAULT 'smtp',
                    smtp_host VARCHAR(255),
                    smtp_port INTEGER NOT NULL DEFAULT 587,
                    smtp_username VARCHAR(255),
                    smtp_password VARCHAR(500),
                    smtp_use_tls BOOLEAN NOT NULL DEFAULT 1,
                    smtp_use_ssl BOOLEAN NOT NULL DEFAULT 0,
                    from_name VARCHAR(180),
                    from_email VARCHAR(255),
                    reply_to_email VARCHAR(255),
                    is_enabled BOOLEAN NOT NULL DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS email_templates (
                    id INTEGER PRIMARY KEY,
                    key VARCHAR(80) NOT NULL UNIQUE,
                    name VARCHAR(180) NOT NULL,
                    subject_template VARCHAR(500) NOT NULL,
                    body_html_template TEXT NOT NULL,
                    body_text_template TEXT,
                    variables_json TEXT DEFAULT '[]',
                    is_active BOOLEAN NOT NULL DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS email_logs (
                    id INTEGER PRIMARY KEY,
                    template_key VARCHAR(80),
                    recipient_email VARCHAR(255) NOT NULL,
                    subject_rendered VARCHAR(500) NOT NULL,
                    body_rendered_preview TEXT,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    error_message TEXT,
                    related_entity_type VARCHAR(80),
                    related_entity_id VARCHAR(80),
                    metadata_json TEXT DEFAULT '{}',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    sent_at DATETIME
                )
                """
            )
        )
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_email_templates_key ON email_templates(key)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_email_logs_template_key ON email_logs(template_key)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_email_logs_recipient_email ON email_logs(recipient_email)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_email_logs_status ON email_logs(status)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_email_logs_created_at ON email_logs(created_at)"))
        session.commit()
    elif dialect.startswith('postgres'):
        session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS email_provider_config (
                    id INTEGER PRIMARY KEY,
                    provider_name VARCHAR(80) NOT NULL DEFAULT 'smtp',
                    smtp_host VARCHAR(255),
                    smtp_port INTEGER NOT NULL DEFAULT 587,
                    smtp_username VARCHAR(255),
                    smtp_password VARCHAR(500),
                    smtp_use_tls BOOLEAN NOT NULL DEFAULT TRUE,
                    smtp_use_ssl BOOLEAN NOT NULL DEFAULT FALSE,
                    from_name VARCHAR(180),
                    from_email VARCHAR(255),
                    reply_to_email VARCHAR(255),
                    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS email_templates (
                    id SERIAL PRIMARY KEY,
                    key VARCHAR(80) NOT NULL UNIQUE,
                    name VARCHAR(180) NOT NULL,
                    subject_template VARCHAR(500) NOT NULL,
                    body_html_template TEXT NOT NULL,
                    body_text_template TEXT,
                    variables_json TEXT DEFAULT '[]',
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS email_logs (
                    id SERIAL PRIMARY KEY,
                    template_key VARCHAR(80),
                    recipient_email VARCHAR(255) NOT NULL,
                    subject_rendered VARCHAR(500) NOT NULL,
                    body_rendered_preview TEXT,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    error_message TEXT,
                    related_entity_type VARCHAR(80),
                    related_entity_id VARCHAR(80),
                    metadata_json TEXT DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    sent_at TIMESTAMP
                )
                """
            )
        )
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_email_templates_key ON email_templates(key)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_email_logs_template_key ON email_logs(template_key)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_email_logs_recipient_email ON email_logs(recipient_email)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_email_logs_status ON email_logs(status)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_email_logs_created_at ON email_logs(created_at)"))
        session.commit()

    config = session.query(EmailProviderConfig).first()
    if not config:
        session.add(
            EmailProviderConfig(
                id=1,
                provider_name='smtp',
                smtp_port=587,
                smtp_use_tls=True,
                smtp_use_ssl=False,
                is_enabled=False,
            )
        )
        session.commit()

    for template in DEFAULT_EMAIL_TEMPLATES:
        exists = session.query(EmailTemplate).filter(EmailTemplate.key == template['key']).first()
        if exists:
            continue
        session.add(EmailTemplate(**template))
    session.commit()


def _ensure_ads_provider_config_columns(session):
    if session.bind.dialect.name != 'sqlite':
        return
    columns = session.execute(text("PRAGMA table_info('ads_provider_config')")).fetchall()
    names = {column[1] for column in columns}
    required_columns = {
        'prompt_complement': 'TEXT',
    }
    changed = False
    for column_name, column_ddl in required_columns.items():
        if column_name not in names:
            session.execute(text(f"ALTER TABLE ads_provider_config ADD COLUMN {column_name} {column_ddl}"))
            changed = True
    if changed:
        session.commit()


def _ensure_admin_users_columns(session):
    required_columns = {
        'name': "VARCHAR(160) DEFAULT 'Administrador'",
        'is_blocked': 'BOOLEAN DEFAULT 0',
        'role': "VARCHAR(20) DEFAULT 'super_admin'",
        'last_login_at': 'DATETIME',
        'updated_at': 'DATETIME DEFAULT CURRENT_TIMESTAMP',
    }

    if session.bind.dialect.name == 'sqlite':
        columns = session.execute(text("PRAGMA table_info('admin_users')")).fetchall()
        names = {column[1] for column in columns}
        changed = False
        for column_name, column_ddl in required_columns.items():
            if column_name not in names:
                session.execute(text(f"ALTER TABLE admin_users ADD COLUMN {column_name} {column_ddl}"))
                changed = True
        if changed:
            session.commit()
    elif session.bind.dialect.name.startswith('postgres'):
        for column_name, column_ddl in required_columns.items():
            session.execute(
                text(
                    f"ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS {column_name} "
                    f"{_normalize_postgres_column_ddl(column_ddl)}"
                )
            )
        session.commit()
    else:
        return

    session.execute(text("UPDATE admin_users SET name = COALESCE(NULLIF(name, ''), 'Administrador')"))
    session.execute(text("UPDATE admin_users SET role = COALESCE(NULLIF(role, ''), 'super_admin')"))
    session.execute(text("UPDATE admin_users SET is_blocked = COALESCE(is_blocked, FALSE)"))
    session.commit()


def _ensure_product_3d_models_columns(session):
    required_columns = {
        'name': "VARCHAR(180)",
        'description': "TEXT",
        'sub_item_id': "VARCHAR(80)",
        'original_file_url': "VARCHAR(500)",
        'preview_file_url': "VARCHAR(500)",
        'width_mm': "REAL",
        'height_mm': "REAL",
        'depth_mm': "REAL",
        'dimensions_source': "VARCHAR(20) DEFAULT 'auto'",
        'allow_download': "BOOLEAN DEFAULT 0",
        'sort_order': "INTEGER DEFAULT 1",
        'is_active': "BOOLEAN DEFAULT 1",
        'created_at': "DATETIME DEFAULT CURRENT_TIMESTAMP",
        'updated_at': "DATETIME DEFAULT CURRENT_TIMESTAMP",
    }

    if session.bind.dialect.name == 'sqlite':
        table = session.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='product_3d_models'")
        ).fetchone()
        if not table:
            return
        columns = session.execute(text("PRAGMA table_info('product_3d_models')")).fetchall()
        names = {column[1] for column in columns}
        changed = False
        for column_name, column_ddl in required_columns.items():
            if column_name not in names:
                session.execute(text(f"ALTER TABLE product_3d_models ADD COLUMN {column_name} {column_ddl}"))
                changed = True
        if changed:
            session.commit()
    elif session.bind.dialect.name.startswith('postgres'):
        for column_name, column_ddl in required_columns.items():
            session.execute(
                text(
                    f"ALTER TABLE product_3d_models ADD COLUMN IF NOT EXISTS {column_name} "
                    f"{_normalize_postgres_column_ddl(column_ddl)}"
                )
            )
        session.commit()
    else:
        return

    session.execute(text("UPDATE product_3d_models SET dimensions_source = COALESCE(NULLIF(dimensions_source, ''), 'auto')"))
    session.execute(text("UPDATE product_3d_models SET allow_download = COALESCE(allow_download, FALSE)"))
    session.execute(text("UPDATE product_3d_models SET is_active = COALESCE(is_active, TRUE)"))
    session.execute(text("UPDATE product_3d_models SET sort_order = COALESCE(sort_order, 1)"))
    session.commit()


def _ensure_product_3d_models_product_nullable(session):
    dialect = session.bind.dialect.name
    if dialect == 'sqlite':
        table = session.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='product_3d_models'")
        ).fetchone()
        if not table:
            return
        columns = session.execute(text("PRAGMA table_info('product_3d_models')")).fetchall()
        target = next((column for column in columns if column[1] == 'product_id'), None)
        if not target:
            return
        not_null = int(target[3] or 0) == 1
        if not not_null:
            return

        session.execute(text("PRAGMA foreign_keys=OFF"))
        session.execute(
            text(
                """
                CREATE TABLE product_3d_models__tmp (
                    id INTEGER PRIMARY KEY,
                    product_id INTEGER,
                    sub_item_id VARCHAR(80),
                    name VARCHAR(180) NOT NULL,
                    description TEXT,
                    original_file_url VARCHAR(500),
                    preview_file_url VARCHAR(500) NOT NULL,
                    width_mm REAL,
                    height_mm REAL,
                    depth_mm REAL,
                    dimensions_source VARCHAR(20) NOT NULL DEFAULT 'auto',
                    allow_download BOOLEAN DEFAULT 0,
                    sort_order INTEGER NOT NULL DEFAULT 1,
                    is_active BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
                )
                """
            )
        )
        session.execute(
            text(
                """
                INSERT INTO product_3d_models__tmp (
                    id, product_id, sub_item_id, name, description, original_file_url, preview_file_url,
                    width_mm, height_mm, depth_mm, dimensions_source, allow_download, sort_order, is_active, created_at, updated_at
                )
                SELECT
                    id, product_id, sub_item_id, name, description, original_file_url, preview_file_url,
                    width_mm, height_mm, depth_mm, dimensions_source, allow_download, sort_order, is_active, created_at, updated_at
                FROM product_3d_models
                """
            )
        )
        session.execute(text("DROP TABLE product_3d_models"))
        session.execute(text("ALTER TABLE product_3d_models__tmp RENAME TO product_3d_models"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_product_3d_models_product_id ON product_3d_models(product_id)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_product_3d_models_sub_item_id ON product_3d_models(sub_item_id)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_product_3d_models_sort_order ON product_3d_models(sort_order)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_product_3d_models_is_active ON product_3d_models(is_active)"))
        session.execute(text("PRAGMA foreign_keys=ON"))
        session.commit()
        return

    if dialect.startswith('postgres'):
        session.execute(text("ALTER TABLE product_3d_models ALTER COLUMN product_id DROP NOT NULL"))
        session.commit()


def _sync_postgres_sequences(session):
    if not session.bind.dialect.name.startswith('postgres'):
        return

    preparer = session.bind.dialect.identifier_preparer
    for table in Base.metadata.sorted_tables:
        if 'id' not in table.columns:
            continue

        table_name = table.name
        sequence_name = session.execute(
            text("SELECT pg_get_serial_sequence(:table_name, 'id')"),
            {'table_name': table_name},
        ).scalar()
        if not sequence_name:
            continue

        quoted_table = preparer.quote(table_name)
        max_id = session.execute(text(f"SELECT COALESCE(MAX(id), 0) FROM {quoted_table}")).scalar() or 0
        if int(max_id) > 0:
            session.execute(
                text("SELECT setval(:seq_name, :max_id, true)"),
                {'seq_name': sequence_name, 'max_id': int(max_id)},
            )
        else:
            session.execute(
                text("SELECT setval(:seq_name, 1, false)"),
                {'seq_name': sequence_name},
            )
    session.commit()


def _seed_categories(session):
    existing = {item.slug: item for item in session.query(Category).all()}
    for category in CATEGORIES:
        if category['slug'] not in existing:
            session.add(Category(**category))
    session.commit()


def _migrate_existing_product_prices_and_categories(session):
    categories = {item.slug: item.id for item in session.query(Category).all()}
    rows = session.execute(text("SELECT id, slug, price, manual_price, final_price, category_id FROM products")).fetchall()

    for row in rows:
        product_id = row[0]
        slug = row[1]
        price = float(row[2] or 0)
        manual_price = row[3]
        final_price = row[4]
        category_id = row[5]

        if manual_price is None and price > 0:
            session.execute(text("UPDATE products SET manual_price = :price WHERE id = :id"), {'price': price, 'id': product_id})

        if (final_price is None or float(final_price) <= 0) and price > 0:
            session.execute(
                text(
                    "UPDATE products SET final_price = :price, calculated_price = :price, cost_total = :price, estimated_profit = 0 WHERE id = :id"
                ),
                {'price': price, 'id': product_id},
            )

        if not category_id:
            matched = next((item for item in PRODUCTS if item['slug'] == slug), None)
            if matched:
                cat_id = categories.get(matched['category_slug'])
                if cat_id:
                    session.execute(text("UPDATE products SET category_id = :category_id WHERE id = :id"), {'category_id': cat_id, 'id': product_id})

        session.execute(
            text("UPDATE products SET price = COALESCE(final_price, price) WHERE id = :id"),
            {'id': product_id},
        )

    session.commit()


def _sync_product_rating_with_reviews(session):
    approved_reviews = session.query(ProductReview).filter(ProductReview.status == 'approved').count()
    if approved_reviews > 0:
        return
    session.execute(text('UPDATE products SET rating_average = 0, rating_count = 0'))
    session.commit()


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        _ensure_orders_created_at_column(session)
        _ensure_orders_payment_columns(session)
        _ensure_customer_accounts_tables(session)
        _ensure_order_items_columns(session)
        _ensure_coupon_columns(session)
        _ensure_product_pricing_columns(session)
        _ensure_store_settings_columns(session)
        _ensure_system_logs_table(session)
        _ensure_email_tables(session)
        _ensure_user_events_columns(session)
        _ensure_ads_provider_config_columns(session)
        _ensure_admin_users_columns(session)
        _ensure_order_flow_tables(session)
        _ensure_product_3d_models_columns(session)
        _ensure_product_3d_models_product_nullable(session)
        _ensure_infinitepay_config_table(session)
        _sync_postgres_sequences(session)
        if SEED_SAMPLE_DATA:
            _seed_categories(session)

        categories = {item.slug: item.id for item in session.query(Category).all()}

        if SEED_SAMPLE_DATA and session.query(Product).count() == 0:
            for item in PRODUCTS:
                product = Product(
                    title=item['title'],
                    slug=item['slug'],
                    short_description=item['short_description'],
                    full_description=item['full_description'],
                    price=item['price'],
                    cover_image=item['cover_image'],
                    images=','.join(item['images']),
                    is_active=True,
                    rating_average=item['rating_average'],
                    rating_count=item['rating_count'],
                    category_id=categories.get(item['category_slug']),
                    manual_price=item['price'],
                    final_price=item['price'],
                    calculated_price=item['price'],
                    cost_total=item['price'],
                    estimated_profit=0,
                )
                session.add(product)

        if SEED_SAMPLE_DATA and session.query(Coupon).filter_by(code='DESCONTO10').first() is None:
            session.add(Coupon(**COUPONS[0]))

        if SEED_SAMPLE_DATA and session.query(Banner).count() == 0:
            for banner in BANNERS:
                session.add(Banner(**banner))

        if session.query(HighlightItem).count() == 0:
            for item in HIGHLIGHTS:
                session.add(HighlightItem(**item))

        if SEED_DEFAULT_ADMIN and session.query(AdminUser).filter_by(email='admin@admin.com').first() is None:
            session.add(
                AdminUser(
                    name='Administrador',
                    email='admin@admin.com',
                    password_hash=hash_password('123456'),
                    role='super_admin',
                    is_active=True,
                    is_blocked=False,
                )
            )

        if session.query(StoreSettings).first() is None:
            session.add(StoreSettings(id=1, whatsapp_number=None, pix_key=None))

        session.commit()
        _migrate_existing_product_prices_and_categories(session)
        _sync_product_rating_with_reviews(session)
    finally:
        session.close()


