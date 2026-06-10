from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import math

from app.db.session import get_db
from app.services.segment_service import segment_service
from app.schemas.schemas import SegmentCreate, SegmentUpdate, NLSegmentRequest, NLSegmentResponse

router = APIRouter()


@router.get("")
def list_segments(page: int = Query(1, ge=1), size: int = Query(50), db: Session = Depends(get_db)):
    items, total = segment_service.get_segments(db, page, size)
    return {"items": items, "total": total, "page": page, "size": size, "pages": math.ceil(total / size)}


@router.post("", status_code=201)
def create_segment(data: SegmentCreate, db: Session = Depends(get_db)):
    return segment_service.create_segment(db, data)


@router.post("/from-nl", response_model=NLSegmentResponse)
def create_from_nl(req: NLSegmentRequest, db: Session = Depends(get_db)):
    try:
        return segment_service.create_from_nl(db, req)
    except ValueError as e:
        raise HTTPException(422, str(e))


@router.get("/{segment_id}")
def get_segment(segment_id: str, db: Session = Depends(get_db)):
    seg = segment_service.get_segment(db, segment_id)
    if not seg:
        raise HTTPException(404, "Segment not found")
    return seg


@router.patch("/{segment_id}")
def update_segment(segment_id: str, data: SegmentUpdate, db: Session = Depends(get_db)):
    seg = segment_service.update_segment(db, segment_id, data)
    if not seg:
        raise HTTPException(404, "Segment not found")
    return seg


@router.delete("/{segment_id}", status_code=204)
def delete_segment(segment_id: str, db: Session = Depends(get_db)):
    if not segment_service.delete_segment(db, segment_id):
        raise HTTPException(404, "Segment not found")


@router.get("/{segment_id}/customers")
def get_segment_customers(
    segment_id: str,
    page: int = Query(1, ge=1),
    size: int = Query(50),
    db: Session = Depends(get_db),
):
    items, total = segment_service.get_segment_customers(db, segment_id, page, size)
    return {"items": items, "total": total, "page": page, "size": size}


@router.post("/{segment_id}/refresh-size")
def refresh_size(segment_id: str, db: Session = Depends(get_db)):
    count = segment_service.refresh_size(db, segment_id)
    return {"estimated_size": count}
