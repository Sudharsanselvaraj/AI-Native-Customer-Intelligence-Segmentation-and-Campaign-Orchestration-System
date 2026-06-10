import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import timezone

from app.db.session import get_db
from app.models.models import Communication, CommunicationEvent, CommunicationStatusEnum, EventTypeEnum
from app.schemas.schemas import BulkWebhookCallback, WebhookCallback

logger = structlog.get_logger()
router = APIRouter()

# Map event types to communication status upgrades (only move forward)
STATUS_ORDER = [
    CommunicationStatusEnum.PENDING,
    CommunicationStatusEnum.SENT,
    CommunicationStatusEnum.DELIVERED,
    CommunicationStatusEnum.FAILED,
]

EVENT_TO_STATUS = {
    EventTypeEnum.SENT: CommunicationStatusEnum.SENT,
    EventTypeEnum.DELIVERED: CommunicationStatusEnum.DELIVERED,
    EventTypeEnum.FAILED: CommunicationStatusEnum.FAILED,
}


def _process_event(db: Session, event: WebhookCallback):
    comm = db.query(Communication).filter(Communication.id == event.communication_id).first()
    if not comm:
        logger.warning("receipt_unknown_comm", comm_id=event.communication_id)
        return False

    # Idempotency: skip if exact event already recorded
    existing = db.query(CommunicationEvent).filter(
        CommunicationEvent.communication_id == event.communication_id,
        CommunicationEvent.event_type == event.event_type,
    ).first()
    if existing and event.event_type not in (EventTypeEnum.CLICKED, EventTypeEnum.CONVERTED):
        return True  # already processed

    ev = CommunicationEvent(
        communication_id=event.communication_id,
        event_type=event.event_type,
        event_time=event.event_time,
        metadata=event.metadata,
    )
    db.add(ev)

    # Update comm status (only upgrade, never downgrade unless FAILED)
    new_status = EVENT_TO_STATUS.get(event.event_type)
    if new_status and new_status != comm.status:
        if new_status == CommunicationStatusEnum.FAILED:
            comm.status = new_status
        elif (comm.status in STATUS_ORDER and
              STATUS_ORDER.index(new_status) > STATUS_ORDER.index(comm.status)):
            comm.status = new_status

    db.flush()

    # Async analytics update
    from app.workers.analytics_worker import update_campaign_analytics
    update_campaign_analytics.delay(comm.campaign_id)
    return True


@router.post("/webhook")
def webhook(payload: WebhookCallback, db: Session = Depends(get_db)):
    try:
        _process_event(db, payload)
        db.commit()
        return {"status": "ok"}
    except Exception as e:
        db.rollback()
        logger.error("webhook_failed", error=str(e))
        raise HTTPException(500, "Failed to process event")


@router.post("/webhook/bulk")
def bulk_webhook(payload: BulkWebhookCallback, db: Session = Depends(get_db)):
    processed, failed = 0, 0
    for event in payload.events:
        try:
            _process_event(db, event)
            processed += 1
        except Exception as e:
            logger.error("bulk_event_failed", comm_id=event.communication_id, error=str(e))
            failed += 1
    db.commit()
    return {"processed": processed, "failed": failed}
