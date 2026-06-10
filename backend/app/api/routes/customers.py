from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
import math

from app.db.session import get_db
from app.services.customer_service import customer_service
from app.schemas.schemas import CustomerCreate, CustomerUpdate, CustomerListResponse, ImportResponse

router = APIRouter()


@router.get("", response_model=CustomerListResponse)
def list_customers(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    city: Optional[str] = None,
    gender: Optional[str] = None,
    db: Session = Depends(get_db),
):
    items, total = customer_service.get_customers(db, page, size, search, city, gender)
    enriched = [customer_service.enrich_customer_response(db, c) for c in items]
    return {
        "items": enriched,
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size),
    }


@router.post("", status_code=201)
def create_customer(data: CustomerCreate, db: Session = Depends(get_db)):
    customer = customer_service.create_customer(db, data)
    return customer_service.enrich_customer_response(db, customer)


@router.get("/cities")
def list_cities(db: Session = Depends(get_db)):
    return customer_service.get_cities(db)


@router.get("/{customer_id}")
def get_customer(customer_id: str, db: Session = Depends(get_db)):
    c = customer_service.get_customer(db, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")
    return customer_service.enrich_customer_response(db, c)


@router.patch("/{customer_id}")
def update_customer(customer_id: str, data: CustomerUpdate, db: Session = Depends(get_db)):
    c = customer_service.update_customer(db, customer_id, data)
    if not c:
        raise HTTPException(404, "Customer not found")
    return customer_service.enrich_customer_response(db, c)


@router.post("/import/csv", response_model=ImportResponse)
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    result = customer_service.import_from_csv(db, content)
    return result
