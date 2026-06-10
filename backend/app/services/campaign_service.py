import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional, Tuple
import httpx
import structlog

from app.models.models import (
    Campaign, Communication, CampaignAnalytics,
    CampaignStatusEnum, CommunicationStatusEnum, ChannelEnum
)
from app.schemas.schemas import CampaignCreate, CampaignUpdate
from app.core.config import settings

logger = structlog.get_logger()


class CampaignService:
    def get_campaigns(self, db: Session, page: int = 1, size: int = 50,
                      status: Optional[str] = None) -> Tuple[List[Campaign], int]:
        q = db.query(Campaign)
        if status:
            q = q.filter(Campaign.status == status)
        total = q.count()
        items = q.order_by(Campaign.created_at.desc()).offset((page - 1) * size).limit(size).all()
        return items, total

    def get_campaign(self, db: Session, campaign_id: str) -> Optional[Campaign]:
        return db.query(Campaign).filter(Campaign.id == campaign_id).first()

    def create_campaign(self, db: Session, data: CampaignCreate, ai_generated: bool = False,
                        expected_engagement: float = None, expected_conversion: float = None) -> Campaign:
        camp = Campaign(
            name=data.name,
            description=data.description,
            channel=data.channel,
            segment_id=data.segment_id,
            message_template=data.message_template,
            scheduled_at=data.scheduled_at,
            ai_generated=ai_generated,
            expected_engagement=expected_engagement,
            expected_conversion=expected_conversion,
        )
        db.add(camp)
        db.flush()

        analytics = CampaignAnalytics(campaign_id=camp.id)
        db.add(analytics)
        db.commit()
        db.refresh(camp)
        return camp

    def update_campaign(self, db: Session, campaign_id: str, data: CampaignUpdate) -> Optional[Campaign]:
        camp = self.get_campaign(db, campaign_id)
        if not camp:
            return None
        for k, v in data.model_dump(exclude_none=True).items():
            setattr(camp, k, v)
        db.commit()
        db.refresh(camp)
        return camp

    def launch_campaign(self, db: Session, campaign_id: str) -> Campaign:
        camp = self.get_campaign(db, campaign_id)
        if not camp:
            raise ValueError("Campaign not found")
        if camp.status not in (CampaignStatusEnum.DRAFT, CampaignStatusEnum.SCHEDULED):
            raise ValueError(f"Cannot launch campaign in status: {camp.status}")

        from app.workers.campaign_worker import dispatch_campaign
        camp.status = CampaignStatusEnum.RUNNING
        camp.started_at = datetime.now(timezone.utc)
        db.commit()

        dispatch_campaign.delay(campaign_id)
        return camp

    def get_audience_ids(self, db: Session, segment_id: str) -> List[str]:
        from app.models.models import Segment, Customer
        seg = db.query(Segment).filter(Segment.id == segment_id).first()
        if not seg:
            return []
        sql = (seg.query_definition or {}).get("generated_sql")
        if not sql:
            rows = db.execute(text("SELECT id FROM customers LIMIT 10000")).fetchall()
        else:
            rows = db.execute(text(f"SELECT id FROM customers WHERE {sql}")).fetchall()
        return [r[0] for r in rows]

    def send_communications(self, db: Session, campaign: Campaign) -> int:
        audience_ids = self.get_audience_ids(db, campaign.segment_id)
        from app.models.models import Customer
        customers = db.query(Customer).filter(Customer.id.in_(audience_ids)).all()
        customer_map = {c.id: c for c in customers}

        sent = 0
        for cid in audience_ids:
            customer = customer_map.get(cid)
            if not customer:
                continue
            ikey = f"{campaign.id}:{cid}"
            existing = db.query(Communication).filter(Communication.idempotency_key == ikey).first()
            if existing:
                continue

            msg = campaign.message_template.replace("{customer_name}", customer.name)
            comm = Communication(
                campaign_id=campaign.id,
                customer_id=cid,
                message=msg,
                channel=campaign.channel,
                idempotency_key=ikey,
                status=CommunicationStatusEnum.PENDING,
            )
            db.add(comm)
            db.flush()

            try:
                with httpx.Client(timeout=5.0) as client:
                    resp = client.post(
                        f"{settings.CHANNEL_SIMULATOR_URL}/send",
                        json={
                            "communication_id": comm.id,
                            "recipient_id": cid,
                            "recipient_phone": customer.phone or f"+91{cid[:10]}",
                            "recipient_email": customer.email,
                            "message": msg,
                            "channel": campaign.channel.value,
                            "callback_url": f"{settings.CRM_RECEIPT_URL}/api/receipts/webhook",
                        }
                    )
                comm.status = CommunicationStatusEnum.SENT
                comm.sent_at = datetime.now(timezone.utc)
                sent += 1
            except Exception as e:
                logger.error("send_failed", comm_id=comm.id, error=str(e))
                comm.status = CommunicationStatusEnum.FAILED

        db.commit()
        return sent

    def mark_completed(self, db: Session, campaign_id: str):
        camp = self.get_campaign(db, campaign_id)
        if camp:
            camp.status = CampaignStatusEnum.COMPLETED
            camp.completed_at = datetime.now(timezone.utc)
            db.commit()

    def mark_failed(self, db: Session, campaign_id: str):
        camp = self.get_campaign(db, campaign_id)
        if camp:
            camp.status = CampaignStatusEnum.FAILED
            db.commit()

    def get_analytics(self, db: Session, campaign_id: str) -> Optional[CampaignAnalytics]:
        return db.query(CampaignAnalytics).filter(CampaignAnalytics.campaign_id == campaign_id).first()


campaign_service = CampaignService()
