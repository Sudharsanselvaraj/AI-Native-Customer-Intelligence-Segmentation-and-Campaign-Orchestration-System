from sqlalchemy.orm import Session
from sqlalchemy import func, desc, text
from typing import List, Optional, Tuple
from datetime import datetime
import csv
import io

from app.models.models import Customer, Order
from app.schemas.schemas import CustomerCreate, CustomerUpdate, CustomerResponse


class CustomerService:
    def get_customers(
        self,
        db: Session,
        page: int = 1,
        size: int = 50,
        search: Optional[str] = None,
        city: Optional[str] = None,
        gender: Optional[str] = None,
    ) -> Tuple[List[Customer], int]:
        query = db.query(Customer)
        if search:
            query = query.filter(
                (Customer.name.ilike(f"%{search}%")) |
                (Customer.email.ilike(f"%{search}%"))
            )
        if city:
            query = query.filter(Customer.city == city)
        if gender:
            query = query.filter(Customer.gender == gender)
        total = query.count()
        items = query.order_by(desc(Customer.created_at)).offset((page - 1) * size).limit(size).all()
        return items, total

    def get_customer(self, db: Session, customer_id: str) -> Optional[Customer]:
        return db.query(Customer).filter(Customer.id == customer_id).first()

    def create_customer(self, db: Session, data: CustomerCreate) -> Customer:
        customer = Customer(**data.model_dump())
        db.add(customer)
        db.commit()
        db.refresh(customer)
        return customer

    def update_customer(self, db: Session, customer_id: str, data: CustomerUpdate) -> Optional[Customer]:
        customer = self.get_customer(db, customer_id)
        if not customer:
            return None
        for k, v in data.model_dump(exclude_none=True).items():
            setattr(customer, k, v)
        db.commit()
        db.refresh(customer)
        return customer

    def enrich_customer_response(self, db: Session, customer: Customer) -> dict:
        """Add order stats to customer response."""
        stats = db.query(
            func.count(Order.id).label("total_orders"),
            func.sum(Order.amount).label("total_spent"),
            func.max(Order.purchase_date).label("last_purchase"),
        ).filter(Order.customer_id == customer.id).first()

        return {
            "id": customer.id,
            "name": customer.name,
            "email": customer.email,
            "phone": customer.phone,
            "city": customer.city,
            "gender": customer.gender,
            "age": customer.age,
            "created_at": customer.created_at,
            "total_orders": stats.total_orders or 0,
            "total_spent": float(stats.total_spent or 0),
            "last_purchase_date": stats.last_purchase,
        }

    def import_from_csv(self, db: Session, content: bytes) -> dict:
        decoded = content.decode("utf-8")
        reader = csv.DictReader(io.StringIO(decoded))
        imported, skipped, errors = 0, 0, []

        for i, row in enumerate(reader):
            try:
                email = row.get("email", "").strip()
                if not email:
                    skipped += 1
                    continue
                existing = db.query(Customer).filter(Customer.email == email).first()
                if existing:
                    skipped += 1
                    continue
                customer = Customer(
                    name=row.get("name", "Unknown"),
                    email=email,
                    phone=row.get("phone"),
                    city=row.get("city"),
                    gender=row.get("gender"),
                    age=int(row["age"]) if row.get("age") else None,
                )
                db.add(customer)
                imported += 1
                if imported % 500 == 0:
                    db.flush()
            except Exception as e:
                errors.append(f"Row {i + 2}: {str(e)}")

        db.commit()
        return {"imported": imported, "skipped": skipped, "errors": errors[:20]}

    def get_cities(self, db: Session) -> List[str]:
        rows = db.query(Customer.city).distinct().filter(Customer.city.isnot(None)).all()
        return [r[0] for r in rows]


customer_service = CustomerService()
