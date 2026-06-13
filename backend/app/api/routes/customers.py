from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
import math
import csv
import io

from app.db.session import get_db
from app.models.models import Customer
from app.services.customer_service import customer_service
from app.schemas.schemas import (
    CustomerCreate, CustomerUpdate, CustomerListResponse, ImportResponse,
    BulkCustomerImportRequest, BulkImportResponse,
)

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


@router.delete("/{customer_id}", status_code=204)
def delete_customer(customer_id: str, db: Session = Depends(get_db)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(404, "Customer not found")
    db.delete(c)
    db.commit()


@router.get("/export/csv")
def export_customers_csv(
    search: Optional[str] = None,
    city: Optional[str] = None,
    gender: Optional[str] = None,
    db: Session = Depends(get_db),
):
    items, _ = customer_service.get_customers(db, page=1, size=10000, search=search, city=city, gender=gender)
    enriched = [customer_service.enrich_customer_response(db, c) for c in items]

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "id", "name", "email", "phone", "city", "gender", "age",
        "total_orders", "total_spent", "last_purchase_date",
    ])
    writer.writeheader()
    for c in enriched:
        writer.writerow({
            "id": c.get("id", ""),
            "name": c.get("name", ""),
            "email": c.get("email", ""),
            "phone": c.get("phone", "") or "",
            "city": c.get("city", "") or "",
            "gender": c.get("gender", "") or "",
            "age": c.get("age", "") or "",
            "total_orders": c.get("total_orders", 0),
            "total_spent": c.get("total_spent", 0),
            "last_purchase_date": c.get("last_purchase_date", "") or "",
        })
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=customers.csv"},
    )


@router.post("/import/csv", response_model=ImportResponse)
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    result = customer_service.import_from_csv(db, content)
    return result


@router.post("/bulk", response_model=BulkImportResponse)
def bulk_import_customers(data: BulkCustomerImportRequest, db: Session = Depends(get_db)):
    imported, skipped, failed = 0, 0, 0
    errors: list[str] = []

    for i, row in enumerate(data.rows, start=1):
        try:
            email = row.email.strip().lower()
            if db.query(Customer).filter(Customer.email == email).first():
                skipped += 1
                continue
            gender = row.gender.strip().lower() if row.gender else None
            if gender and gender not in ("male", "female", "other"):
                gender = None
            db.add(Customer(
                name=row.name.strip(),
                email=email,
                phone=row.phone.strip() if row.phone else None,
                city=row.city.strip() if row.city else None,
                gender=gender,
                age=row.age,
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
