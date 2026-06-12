from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
import math

from app.db.session import get_db
from app.models.models import Order, Customer
from app.schemas.schemas import OrderCreate, OrderResponse, BulkOrderImportRequest, BulkImportResponse

router = APIRouter()


@router.get("")
def list_orders(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    customer_id: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Order).join(Customer, Order.customer_id == Customer.id)
    if customer_id:
        q = q.filter(Order.customer_id == customer_id)
    if category:
        q = q.filter(Order.category == category)
    total = q.count()
    rows = q.order_by(desc(Order.purchase_date)).offset((page - 1) * size).limit(size).all()
    
    items = []
    for order in rows:
        item = {
            "id": order.id,
            "customer_id": order.customer_id,
            "customer_name": order.customer.name if order.customer else None,
            "amount": order.amount,
            "category": order.category,
            "purchase_date": order.purchase_date,
            "created_at": order.created_at,
        }
        items.append(item)
    
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


@router.post("/bulk", response_model=BulkImportResponse)
def bulk_import_orders(data: BulkOrderImportRequest, db: Session = Depends(get_db)):
    from datetime import datetime
    imported, skipped, failed = 0, 0, 0
    errors: list[str] = []
    date_fmts = ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%dT%H:%M:%S"]

    for i, row in enumerate(data.rows, start=1):
        try:
            cid = row.customer_id
            if not cid:
                if not row.customer_email:
                    failed += 1
                    errors.append(f"Row {i}: customer_id or customer_email required")
                    continue
                c = db.query(Customer).filter(
                    Customer.email == row.customer_email.strip().lower()
                ).first()
                if not c:
                    failed += 1
                    errors.append(f"Row {i}: customer '{row.customer_email}' not found")
                    continue
                cid = c.id

            clean_date = row.purchase_date.strip().rstrip("Z").split("+")[0].split(".")[0]
            purchase_date = None
            for fmt in date_fmts:
                try:
                    purchase_date = datetime.strptime(clean_date, fmt)
                    break
                except ValueError:
                    continue
            if purchase_date is None:
                failed += 1
                errors.append(f"Row {i}: unrecognised date '{row.purchase_date}'")
                continue

            db.add(Order(
                customer_id=cid,
                amount=float(row.amount),
                category=row.category.strip() if row.category else None,
                purchase_date=purchase_date,
            ))
            imported += 1
            if imported % 100 == 0:
                db.flush()
        except Exception as e:
            failed += 1
            if len(errors) < 50:
                errors.append(f"Row {i}: {str(e)}")

    db.commit()
    return BulkImportResponse(imported=imported, skipped=skipped, failed=failed, errors=errors)


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: str, db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o:
        raise HTTPException(404, "Order not found")
    return o
