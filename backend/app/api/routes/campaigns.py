from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
import math

from app.db.session import get_db
from app.services.campaign_service import campaign_service
from app.services.ai_service import ai_service
from app.schemas.schemas import (
    CampaignCreate, CampaignUpdate, CampaignGenerateRequest,
    CampaignGenerateResponse, ChannelRecommendationRequest
)
from app.models.models import Segment

router = APIRouter()


@router.get("")
def list_campaigns(
    page: int = Query(1, ge=1),
    size: int = Query(50),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    items, total = campaign_service.get_campaigns(db, page, size, status)
    result = []
    for c in items:
        d = {
            "id": c.id, "name": c.name, "description": c.description,
            "channel": c.channel, "segment_id": c.segment_id,
            "segment_name": c.segment.name if c.segment else None,
            "status": c.status, "message_template": c.message_template,
            "ai_generated": c.ai_generated, "expected_engagement": c.expected_engagement,
            "expected_conversion": c.expected_conversion, "scheduled_at": c.scheduled_at,
            "started_at": c.started_at, "completed_at": c.completed_at,
            "created_at": c.created_at, "updated_at": c.updated_at,
        }
        result.append(d)
    return {"items": result, "total": total, "page": page, "size": size, "pages": math.ceil(total / size)}


@router.post("", status_code=201)
def create_campaign(data: CampaignCreate, db: Session = Depends(get_db)):
    if not db.query(Segment).filter(Segment.id == data.segment_id).first():
        raise HTTPException(404, "Segment not found")
    return campaign_service.create_campaign(db, data)


@router.post("/generate", response_model=CampaignGenerateResponse)
def generate_campaign(req: CampaignGenerateRequest, db: Session = Depends(get_db)):
    seg_name = None
    if req.segment_id:
        seg = db.query(Segment).filter(Segment.id == req.segment_id).first()
        seg_name = seg.name if seg else None
    try:
        result = ai_service.generate_campaign(req.prompt, seg_name)
        return result
    except ValueError as e:
        raise HTTPException(422, str(e))


@router.get("/{campaign_id}")
def get_campaign(campaign_id: str, db: Session = Depends(get_db)):
    c = campaign_service.get_campaign(db, campaign_id)
    if not c:
        raise HTTPException(404, "Campaign not found")
    analytics = campaign_service.get_analytics(db, campaign_id)
    return {
        "id": c.id, "name": c.name, "description": c.description,
        "channel": c.channel, "segment_id": c.segment_id,
        "segment_name": c.segment.name if c.segment else None,
        "status": c.status, "message_template": c.message_template,
        "ai_generated": c.ai_generated, "expected_engagement": c.expected_engagement,
        "expected_conversion": c.expected_conversion, "scheduled_at": c.scheduled_at,
        "started_at": c.started_at, "completed_at": c.completed_at,
        "created_at": c.created_at, "updated_at": c.updated_at,
        "analytics": analytics,
    }


@router.patch("/{campaign_id}")
def update_campaign(campaign_id: str, data: CampaignUpdate, db: Session = Depends(get_db)):
    c = campaign_service.update_campaign(db, campaign_id, data)
    if not c:
        raise HTTPException(404, "Campaign not found")
    return c


@router.post("/{campaign_id}/launch")
def launch_campaign(campaign_id: str, db: Session = Depends(get_db)):
    try:
        c = campaign_service.launch_campaign(db, campaign_id)
        return {"status": c.status, "campaign_id": c.id, "message": "Campaign launched successfully"}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/{campaign_id}/analytics")
def get_campaign_analytics(campaign_id: str, db: Session = Depends(get_db)):
    a = campaign_service.get_analytics(db, campaign_id)
    if not a:
        raise HTTPException(404, "Analytics not found")
    return a


@router.post("/recommend-channel")
def recommend_channel(req: ChannelRecommendationRequest, db: Session = Depends(get_db)):
    seg = db.query(Segment).filter(Segment.id == req.segment_id).first()
    if not seg:
        raise HTTPException(404, "Segment not found")
    try:
        return ai_service.recommend_channel(seg.description or seg.name, req.campaign_goal)
    except ValueError as e:
        raise HTTPException(422, str(e))
