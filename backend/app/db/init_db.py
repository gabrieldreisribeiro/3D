from sqlalchemy import text

from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine
from app.models import AdminUser, Banner, Category, Coupon, Product

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
    columns = session.execute(text("PRAGMA table_info('orders')")).fetchall()
    has_created_at = any(column[1] == 'created_at' for column in columns)
    if not has_created_at:
        session.execute(text("ALTER TABLE orders ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"))
        session.commit()


def _ensure_product_pricing_columns(session):
    columns = session.execute(text("PRAGMA table_info('products')")).fetchall()
    names = {column[1] for column in columns}

    required_columns = {
        'category_id': "INTEGER",
        'sub_items': "TEXT DEFAULT ''",
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
    }

    changed = False
    for column_name, column_ddl in required_columns.items():
        if column_name not in names:
            session.execute(text(f"ALTER TABLE products ADD COLUMN {column_name} {column_ddl}"))
            changed = True

    if changed:
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


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        _ensure_orders_created_at_column(session)
        _ensure_product_pricing_columns(session)
        _seed_categories(session)

        categories = {item.slug: item.id for item in session.query(Category).all()}

        if session.query(Product).count() == 0:
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

        if session.query(Coupon).filter_by(code='DESCONTO10').first() is None:
            session.add(Coupon(**COUPONS[0]))

        if session.query(Banner).count() == 0:
            for banner in BANNERS:
                session.add(Banner(**banner))

        if session.query(AdminUser).filter_by(email='admin@admin.com').first() is None:
            session.add(
                AdminUser(
                    email='admin@admin.com',
                    password_hash=hash_password('123456'),
                    is_active=True,
                )
            )

        session.commit()
        _migrate_existing_product_prices_and_categories(session)
    finally:
        session.close()
