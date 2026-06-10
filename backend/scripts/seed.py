"""
Seed script: generates 2000 customers and 10000 orders with realistic Indian retail data.
Run: python -m scripts.seed  (from backend/)
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import random
from datetime import datetime, timedelta, timezone
from faker import Faker

from app.db.session import SessionLocal, engine, Base
from app.models.models import Customer, Order, Segment, GenderEnum

fake = Faker("en_IN")

CITIES = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Pune", "Kolkata",
          "Ahmedabad", "Jaipur", "Surat", "Lucknow", "Kanpur", "Nagpur", "Indore",
          "Thane", "Bhopal", "Patna", "Vadodara", "Goa", "Coimbatore"]

CATEGORIES = ["Fashion", "Beauty", "Coffee", "Electronics", "Home & Living",
               "Sports", "Books", "Wellness", "Food & Beverage", "Jewellery"]

CATEGORY_RANGES = {
    "Fashion": (500, 8000),
    "Beauty": (200, 3000),
    "Coffee": (150, 800),
    "Electronics": (2000, 50000),
    "Home & Living": (500, 15000),
    "Sports": (500, 10000),
    "Books": (100, 1000),
    "Wellness": (300, 5000),
    "Food & Beverage": (100, 2000),
    "Jewellery": (1000, 100000),
}

SMART_SEGMENTS = [
    {
        "name": "High Value Customers",
        "description": "Customers who have spent more than ₹10,000 total",
        "query_definition": {
            "natural_language": "Customers who have spent more than 10000 in total",
            "generated_sql": "id IN (SELECT customer_id FROM orders GROUP BY customer_id HAVING SUM(amount) > 10000)",
        },
        "is_smart": True,
    },
    {
        "name": "Lapsed Customers (60+ days)",
        "description": "Customers who haven't purchased in 60+ days",
        "query_definition": {
            "natural_language": "Customers who have not purchased in the last 60 days",
            "generated_sql": "id IN (SELECT customer_id FROM orders GROUP BY customer_id HAVING MAX(purchase_date) < NOW() - INTERVAL '60 days')",
        },
        "is_smart": True,
    },
    {
        "name": "Fashion Enthusiasts",
        "description": "Customers who primarily shop in the Fashion category",
        "query_definition": {
            "natural_language": "Customers who have bought fashion items",
            "generated_sql": "id IN (SELECT DISTINCT customer_id FROM orders WHERE category = 'Fashion')",
        },
        "is_smart": True,
    },
    {
        "name": "New Customers (Last 30 Days)",
        "description": "Customers who joined in the last 30 days",
        "query_definition": {
            "natural_language": "Customers who joined in the last 30 days",
            "generated_sql": "created_at >= NOW() - INTERVAL '30 days'",
        },
        "is_smart": True,
    },
    {
        "name": "Beauty Shoppers – Low Engagement",
        "description": "Beauty buyers who haven't purchased recently",
        "query_definition": {
            "natural_language": "Customers who bought beauty products but not in the last 45 days",
            "generated_sql": "id IN (SELECT customer_id FROM orders WHERE category = 'Beauty') AND id NOT IN (SELECT customer_id FROM orders WHERE purchase_date >= NOW() - INTERVAL '45 days')",
        },
        "is_smart": True,
    },
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    print("Seeding customers...")
    customers = []
    emails_used = set()
    for _ in range(2000):
        email = fake.unique.email()
        if email in emails_used:
            continue
        emails_used.add(email)
        gender = random.choice(list(GenderEnum))
        c = Customer(
            name=fake.name(),
            email=email,
            phone=f"+91{random.randint(7000000000, 9999999999)}",
            city=random.choice(CITIES),
            gender=gender,
            age=random.randint(18, 65),
        )
        customers.append(c)
        db.add(c)
        if len(customers) % 500 == 0:
            db.flush()
    db.commit()
    print(f"  Created {len(customers)} customers")

    print("Seeding orders...")
    order_count = 0
    for c in customers:
        n_orders = random.choices([1, 2, 3, 4, 5, 8, 12], weights=[20, 25, 20, 15, 10, 7, 3])[0]
        for _ in range(n_orders):
            cat = random.choice(CATEGORIES)
            lo, hi = CATEGORY_RANGES[cat]
            days_ago = random.randint(0, 365)
            order = Order(
                customer_id=c.id,
                amount=round(random.uniform(lo, hi), 2),
                category=cat,
                purchase_date=datetime.now(timezone.utc) - timedelta(days=days_ago),
            )
            db.add(order)
            order_count += 1
        if order_count % 2000 == 0:
            db.flush()
    db.commit()
    print(f"  Created {order_count} orders")

    print("Creating smart segments...")
    for s_data in SMART_SEGMENTS:
        exists = db.query(Segment).filter(Segment.name == s_data["name"]).first()
        if not exists:
            seg = Segment(**s_data)
            db.add(seg)
    db.commit()

    # Estimate sizes
    from sqlalchemy import text
    for seg in db.query(Segment).all():
        sql = (seg.query_definition or {}).get("generated_sql", "1=1")
        try:
            row = db.execute(text(f"SELECT COUNT(*) FROM customers WHERE {sql}")).fetchone()
            seg.estimated_size = row[0]
        except Exception:
            seg.estimated_size = 0
    db.commit()
    print("  Smart segments created")

    db.close()
    print("Seed complete!")


if __name__ == "__main__":
    seed()
