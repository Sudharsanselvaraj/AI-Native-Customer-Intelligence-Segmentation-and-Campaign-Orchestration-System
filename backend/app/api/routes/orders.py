from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
import math

from app.db.session import get_db
from app.models.models import Order, Customer
from app.schemas.schemas import OrderCreate, OrderResponse

router = APIRouter()


@router.get("")
def list_orders(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    customer_id: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Order)
    if customer_id:
        q = q.filter(Order.customer_id == customer_id)
    if category:
        q = q.filter(Order.category == category)
    total = q.count()
    items = q.order_by(desc(Order.purchase_date)).offset((page - 1) * size).limit(size).all()
    return {"items": items, "total": total, "page": page, "size": size, "pages": math.ceil(total / size)}


@router.post("", status_code=201, response_model=OrderResponse)
def create_order(data: OrderCreate, db: Session = Depends(get_db)):
    if not db.query(Customer).filter(Customer.id == data.customer_id).first():
        raise HTTPException(404, "Customer not found")
    order = Order(**data.model_dump())
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    rows = db.query(Order.category).distinct().filter(Order.category.isnot(None)).all()
    return [r[0] for r in rows]


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: str, db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o:
        raise HTTPException(404, "Order not found")
    return o
