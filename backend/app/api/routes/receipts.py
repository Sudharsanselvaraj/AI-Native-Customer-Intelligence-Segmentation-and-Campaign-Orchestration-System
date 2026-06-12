import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import timezone

from app.db.session import get_db
from app.models.models import Communication, CommunicationEvent, CommunicationStatusEnum, EventTypeEnum
from app.schemas.schemas import BulkWebhookCallback, WebhookCallback

logger = structlog.get_logger()
router = APIRouter()

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


def _process_event(db: Session, event: WebhookCallback) -> str:
    """Returns 'processed', 'skipped', or raises HTTPException."""
    comm = db.query(Communication).filter(Communication.id == event.communication_id).first()
    if not comm:
        logger.warning("receipt_unknown_comm", comm_id=event.communication_id)
        raise HTTPException(404, f"Communication {event.communication_id} not found")

    # Idempotency: skip if exact event already recorded (except repeatable events)
    existing = db.query(CommunicationEvent).filter(
        CommunicationEvent.communication_id == event.communication_id,
        CommunicationEvent.event_type == event.event_type,
    ).first()
    if existing and event.event_type not in (EventTypeEnum.CLICKED, EventTypeEnum.CONVERTED):
        logger.info("receipt_duplicate_skipped", comm_id=event.communication_id, event=event.event_type)
        return "skipped"

    ev = CommunicationEvent(
        communication_id=event.communication_id,
        event_type=event.event_type,
        event_time=event.event_time,
        event_metadata=event.metadata,
    )
    db.add(ev)

    new_status = EVENT_TO_STATUS.get(event.event_type)
    if new_status and new_status != comm.status:
        if new_status == CommunicationStatusEnum.FAILED:
            comm.status = new_status
        elif (comm.status in STATUS_ORDER and
              STATUS_ORDER.index(new_status) > STATUS_ORDER.index(comm.status)):
            comm.status = new_status

    db.flush()

    from app.workers.analytics_worker import update_campaign_analytics
    update_campaign_analytics.delay(comm.campaign_id)

    # Broadcast to WebSocket subscribers
    try:
        from app.core.ws_manager import ws_manager
        import asyncio
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(ws_manager.broadcast(comm.campaign_id, {
                "communication_id": event.communication_id,
                "event_type": event.event_type.value,
                "event_time": event.event_time.isoformat(),
            }))
    except Exception:
        pass  # WebSocket broadcast is best-effort

    logger.info("receipt_processed", comm_id=event.communication_id, event=event.event_type, campaign=comm.campaign_id)
    return "processed"


@router.post("/webhook")
def webhook(payload: WebhookCallback, db: Session = Depends(get_db)):
    status = _process_event(db, payload)
    db.commit()
    return {"status": status}


@router.post("/webhook/bulk")
def bulk_webhook(payload: BulkWebhookCallback, db: Session = Depends(get_db)):
    processed, failed, skipped = 0, 0, 0
    for event in payload.events:
        try:
            result = _process_event(db, event)
            if result == "skipped":
                skipped += 1
            else:
                processed += 1
        except HTTPException:
            failed += 1
        except Exception as e:
            logger.error("bulk_event_failed", comm_id=event.communication_id, error=str(e))
            failed += 1
    db.commit()
    return {"total": len(payload.events), "processed": processed, "skipped": skipped, "failed": failed}
