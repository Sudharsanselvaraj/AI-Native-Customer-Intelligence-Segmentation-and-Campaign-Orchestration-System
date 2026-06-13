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
        from app.models.models import Segment
        from app.services.segment_service import segment_service
        seg = db.query(Segment).filter(Segment.id == segment_id).first()
        if not seg:
            return []
        sql = (seg.query_definition or {}).get("generated_sql")
        if not sql:
            logger.warning(
                "audience_fallback_all_customers",
                segment_id=segment_id,
                segment_name=seg.name,
                note="No generated_sql on segment — targeting all customers up to 10000",
            )
            rows = db.execute(text("SELECT id FROM customers LIMIT 10000")).fetchall()
        else:
            safe_sql = segment_service._make_safe(sql)
            rows = db.execute(text(f"SELECT id FROM customers WHERE {safe_sql}")).fetchall()
        return [r[0] for r in rows]

    def send_communications(self, db: Session, campaign: Campaign) -> int:
        from app.models.models import Customer
        from concurrent.futures import ThreadPoolExecutor, as_completed

        audience_ids = self.get_audience_ids(db, campaign.segment_id)
        customers = db.query(Customer).filter(Customer.id.in_(audience_ids)).all()
        customer_map = {c.id: c for c in customers}

        # Build Communication records in bulk, skip duplicates
        comms_to_send: list[tuple[Communication, str]] = []  # (comm, msg)
        existing_keys = {
            row[0] for row in db.execute(
                text("SELECT idempotency_key FROM communications WHERE campaign_id = :cid"),
                {"cid": campaign.id},
            ).fetchall()
        }
        for cid in audience_ids:
            customer = customer_map.get(cid)
            if not customer:
                continue
            ikey = f"{campaign.id}:{cid}"
            if ikey in existing_keys:
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
            comms_to_send.append((comm, customer))

        db.flush()  # assigns IDs without committing

        callback_url = f"{settings.CRM_RECEIPT_URL}/api/receipts/webhook"
        channel_url = f"{settings.CHANNEL_SIMULATOR_URL}/send"

        def _fire(comm: Communication, customer: Customer) -> bool:
            payload = {
                "communication_id": comm.id,
                "recipient_id": customer.id,
                "recipient_phone": customer.phone or f"+91{customer.id[:10]}",
                "recipient_email": customer.email,
                "message": comm.message,
                "channel": campaign.channel.value,
                "callback_url": callback_url,
            }
            try:
                with httpx.Client(timeout=5.0) as client:
                    client.post(channel_url, json=payload).raise_for_status()
                return True
            except Exception as e:
                logger.error("send_failed", comm_id=comm.id, error=str(e))
                return False

        sent = 0
        now = datetime.now(timezone.utc)
        # Concurrently fire to channel simulator — 20 workers caps parallelism
        with ThreadPoolExecutor(max_workers=20) as pool:
            futures = {pool.submit(_fire, comm, cust): comm for comm, cust in comms_to_send}
            for future in as_completed(futures):
                comm = futures[future]
                if future.result():
                    comm.status = CommunicationStatusEnum.SENT
                    comm.sent_at = now
                    sent += 1
                else:
                    comm.status = CommunicationStatusEnum.FAILED

        db.commit()
        logger.info("campaign_sent", campaign_id=campaign.id, sent=sent, total=len(comms_to_send))
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
