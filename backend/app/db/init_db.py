from sqlalchemy import text

from app.core.config import SEED_DEFAULT_ADMIN, SEED_SAMPLE_DATA
from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine
from app.models import AdminUser, Banner, Category, Coupon, Product, ProductReview, StoreSettings

PRODUCTS = [
    {
        'title': 'Estatueta Eliptica',
        'slug': 'estatueta-eliptica',
        'short_description': 'Escultura organica de design contemporaneo.',
        'full_description': 'Peca ideal para decoracao, com linhas suaves e acabamento premium para ambientes sofisticados.',
        'price': 159.9,
        'cover_image': 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=60',
        'images': [
            'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=60',
            'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=60',
            'https://images.unsplash.com/photo-1494253109108-2e30c049369b?auto=format&fit=crop&w=900&q=60',
        ],
        'rating_average': 4.8,
        'rating_count': 32,
        'category_slug': 'decoracao',
    },
    {
        'title': 'Lampada Modular',
        'slug': 'lampada-modular',
        'short_description': 'Iluminacao arquitetonica para mesas e escritorios.',
        'full_description': 'Design modular que permite combinacoes personalizadas com impressao 3D de qualidade e acabamento suave.',
        'price': 249.0,
        'cover_image': 'https://images.unsplash.com/photo-1494422651185-0817bf8bef2f?auto=format&fit=crop&w=900&q=60',
        'images': [
            'https://images.unsplash.com/photo-1494422651185-0817bf8bef2f?auto=format&fit=crop&w=900&q=60',
            'https://images.unsplash.com/photo-1512242342754-62a9d0f86d56?auto=format&fit=crop&w=900&q=60',
            'https://images.unsplash.com/photo-1512446733611-9099a758e703?auto=format&fit=crop&w=900&q=60',
        ],
        'rating_average': 4.7,
        'rating_count': 28,
        'category_slug': 'iluminacao',
    },
    {
        'title': 'Organizador Linear',
        'slug': 'organizador-linear',
        'short_description': 'Solucao limpa para mesa de trabalho e estudio.',
        'full_description': 'Organizador eficiente com compartimentos para canetas, cabos e componentes, perfeito para estudios criativos.',
        'price': 79.5,
        'cover_image': 'https://images.unsplash.com/photo-1495214783159-3503fd1b572d?auto=format&fit=crop&w=900&q=60',
        'images': [
            'https://images.unsplash.com/photo-1495214783159-3503fd1b572d?auto=format&fit=crop&w=900&q=60',
            'https://images.unsplash.com/photo-1505964259824-e2f6e438e838?auto=format&fit=crop&w=900&q=60',
            'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=60',
        ],
        'rating_average': 4.6,
        'rating_count': 21,
        'category_slug': 'organizacao',
    },
    {
        'title': 'Suporte Curvo',
        'slug': 'suporte-curvo',
        'short_description': 'Peca funcional com estetica futurista.',
        'full_description': 'Suporte para eletronicos ou decoracoes, com curvas suaves e excelente encaixe para itens delicados.',
        'price': 129.0,
        'cover_image': 'https://images.unsplash.com/photo-1545239704-bf25a8246f6b?auto=format&fit=crop&w=900&q=60',
        'images': [
            'https://images.unsplash.com/photo-1545239704-bf25a8246f6b?auto=format&fit=crop&w=900&q=60',
            'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=60',
            'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=60',
        ],
        'rating_average': 4.9,
        'rating_count': 44,
        'category_slug': 'suportes',
    },
]

CATEGORIES = [
    {'name': 'Decoracao', 'slug': 'decoracao', 'is_active': True},
    {'name': 'Iluminacao', 'slug': 'iluminacao', 'is_active': True},
    {'name': 'Organizacao', 'slug': 'organizacao', 'is_active': True},
    {'name': 'Suportes', 'slug': 'suportes', 'is_active': True},
]

COUPONS = [
    {'code': 'DESCONTO10', 'type': 'percent', 'value': 10.0, 'is_active': True},
]

BANNERS = [
    {
        'title': 'Colecao Premium 3D',
        'subtitle': 'Modelos autorais para ambientes criativos',
        'image_url': 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1800&q=70',
        'target_url': '/',
        'sort_order': 1,
        'is_active': True,
        'show_in_carousel': True,
    },
    {
        'title': 'Novas Pecas de Decoracao',
        'subtitle': 'Acabamento premium e entrega rapida',
        'image_url': 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1800&q=70',
        'target_url': '/#produtos',
        'sort_order': 2,
        'is_active': True,
        'show_in_carousel': True,
    },
    {
        'title': 'Descontos em Kits',
        'subtitle': 'Monte seu setup com pecas selecionadas',
        'image_url': 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1800&q=70',
        'target_url': '/cart',
        'sort_order': 3,
        'is_active': True,
        'show_in_carousel': True,
    },
]


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


def _ensure_order_items_columns(session):
    if session.bind.dialect.name != 'sqlite':
        return
    columns = session.execute(text("PRAGMA table_info('order_items')")).fetchall()
    names = {column[1] for column in columns}
    required_columns = {
        'line_total': "REAL DEFAULT 0",
        'selected_color': "VARCHAR(20)",
        'selected_secondary_color': "VARCHAR(20)",
        'selected_sub_items': "TEXT DEFAULT ''",
        'name_personalizations': "TEXT DEFAULT ''",
    }
    changed = False
    for column_name, column_ddl in required_columns.items():
        if column_name not in names:
            session.execute(text(f"ALTER TABLE order_items ADD COLUMN {column_name} {column_ddl}"))
            changed = True

    session.execute(text("UPDATE order_items SET line_total = COALESCE(line_total, unit_price * quantity)"))
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
    if session.bind.dialect.name != 'sqlite':
        return
    columns = session.execute(text("PRAGMA table_info('products')")).fetchall()
    names = {column[1] for column in columns}

    required_columns = {
        'category_id': "INTEGER",
        'sub_items': "TEXT DEFAULT ''",
        'lead_time_hours': "REAL DEFAULT 0",
        'allow_colors': "BOOLEAN DEFAULT 0",
        'available_colors': "TEXT DEFAULT ''",
        'allow_secondary_color': "BOOLEAN DEFAULT 0",
        'secondary_color_pairs': "TEXT DEFAULT ''",
        'allow_name_personalization': "BOOLEAN DEFAULT 0",
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

    changed = False
    for column_name, column_ddl in required_columns.items():
        if column_name not in names:
            session.execute(text(f"ALTER TABLE products ADD COLUMN {column_name} {column_ddl}"))
            changed = True

    if changed:
        session.commit()

    session.execute(text("UPDATE products SET instagram_post_status = COALESCE(instagram_post_status, 'not_published')"))
    session.commit()


def _ensure_store_settings_columns(session):
    if session.bind.dialect.name != 'sqlite':
        return
    columns = session.execute(text("PRAGMA table_info('store_settings')")).fetchall()
    names = {column[1] for column in columns}
    required_columns = {
        'instagram_enabled': "BOOLEAN DEFAULT 0",
        'instagram_app_id': "VARCHAR(120)",
        'instagram_app_secret': "VARCHAR(220)",
        'instagram_access_token': "VARCHAR(600)",
        'instagram_user_id': "VARCHAR(120)",
        'instagram_page_id': "VARCHAR(120)",
        'instagram_default_caption': "TEXT",
        'instagram_default_hashtags': "TEXT",
        'instagram_auto_publish_default': "BOOLEAN DEFAULT 0",
    }
    changed = False
    for column_name, column_ddl in required_columns.items():
        if column_name not in names:
            session.execute(text(f"ALTER TABLE store_settings ADD COLUMN {column_name} {column_ddl}"))
            changed = True
    if changed:
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
        _ensure_order_items_columns(session)
        _ensure_coupon_columns(session)
        _ensure_product_pricing_columns(session)
        _ensure_store_settings_columns(session)
        _ensure_user_events_columns(session)
        _ensure_ads_provider_config_columns(session)
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

        if SEED_DEFAULT_ADMIN and session.query(AdminUser).filter_by(email='admin@admin.com').first() is None:
            session.add(
                AdminUser(
                    email='admin@admin.com',
                    password_hash=hash_password('123456'),
                    is_active=True,
                )
            )

        if session.query(StoreSettings).first() is None:
            session.add(StoreSettings(id=1, whatsapp_number=None, pix_key=None))

        session.commit()
        _migrate_existing_product_prices_and_categories(session)
        _sync_product_rating_with_reviews(session)
    finally:
        session.close()


