from app.db.session import Base, SessionLocal, engine
from app.models import Coupon, Product

PRODUCTS = [
    {
        'title': 'Estatueta Elíptica',
        'slug': 'estatueta-eliptica',
        'short_description': 'Escultura orgânica de design contemporâneo.',
        'full_description': 'Peça ideal para decoração, com linhas suaves e acabamento premium para ambientes sofisticados.',
        'price': 159.9,
        'cover_image': 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=60',
        'images': [
            'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=60',
            'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=60',
            'https://images.unsplash.com/photo-1494253109108-2e30c049369b?auto=format&fit=crop&w=900&q=60',
        ],
        'rating_average': 4.8,
        'rating_count': 32,
    },
    {
        'title': 'Lâmpada Modular',
        'slug': 'lampada-modular',
        'short_description': 'Iluminação arquitetônica para mesas e escritórios.',
        'full_description': 'Design modular que permite combinações personalizadas com impressão 3D de qualidade e acabamento suave.',
        'price': 249.0,
        'cover_image': 'https://images.unsplash.com/photo-1494422651185-0817bf8bef2f?auto=format&fit=crop&w=900&q=60',
        'images': [
            'https://images.unsplash.com/photo-1494422651185-0817bf8bef2f?auto=format&fit=crop&w=900&q=60',
            'https://images.unsplash.com/photo-1512242342754-62a9d0f86d56?auto=format&fit=crop&w=900&q=60',
            'https://images.unsplash.com/photo-1512446733611-9099a758e703?auto=format&fit=crop&w=900&q=60',
        ],
        'rating_average': 4.7,
        'rating_count': 28,
    },
    {
        'title': 'Organizador Linear',
        'slug': 'organizador-linear',
        'short_description': 'Solução limpa para mesa de trabalho e estúdio.',
        'full_description': 'Organizador eficiente com compartimentos para canetas, cabos e componentes, perfeito para estúdios criativos.',
        'price': 79.5,
        'cover_image': 'https://images.unsplash.com/photo-1495214783159-3503fd1b572d?auto=format&fit=crop&w=900&q=60',
        'images': [
            'https://images.unsplash.com/photo-1495214783159-3503fd1b572d?auto=format&fit=crop&w=900&q=60',
            'https://images.unsplash.com/photo-1505964259824-e2f6e438e838?auto=format&fit=crop&w=900&q=60',
            'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=60',
        ],
        'rating_average': 4.6,
        'rating_count': 21,
    },
    {
        'title': 'Suporte Curvo',
        'slug': 'suporte-curvo',
        'short_description': 'Peça funcional com estética futurista.',
        'full_description': 'Suporte para eletrônicos ou decorações, com curvas suaves e excelente encaixe para itens delicados.',
        'price': 129.0,
        'cover_image': 'https://images.unsplash.com/photo-1545239704-bf25a8246f6b?auto=format&fit=crop&w=900&q=60',
        'images': [
            'https://images.unsplash.com/photo-1545239704-bf25a8246f6b?auto=format&fit=crop&w=900&q=60',
            'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=60',
            'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=60',
        ],
        'rating_average': 4.9,
        'rating_count': 44,
    },
]

COUPONS = [
    {'code': 'DESCONTO10', 'type': 'percent', 'value': 10.0, 'is_active': True},
]


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
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
                )
                session.add(product)
        if session.query(Coupon).filter_by(code='DESCONTO10').first() is None:
            session.add(Coupon(**COUPONS[0]))
        session.commit()
    finally:
        session.close()
