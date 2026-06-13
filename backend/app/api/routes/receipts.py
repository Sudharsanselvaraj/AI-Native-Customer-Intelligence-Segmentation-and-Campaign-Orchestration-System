import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
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
    CommunicationStatusEnum.OPENED,
    CommunicationStatusEnum.READ,
    CommunicationStatusEnum.CLICKED,
    CommunicationStatusEnum.CONVERTED,
    CommunicationStatusEnum.FAILED,
]

EVENT_TO_STATUS = {
    EventTypeEnum.SENT:      CommunicationStatusEnum.SENT,
    EventTypeEnum.DELIVERED: CommunicationStatusEnum.DELIVERED,
    EventTypeEnum.OPENED:    CommunicationStatusEnum.OPENED,
    EventTypeEnum.READ:      CommunicationStatusEnum.READ,
    EventTypeEnum.CLICKED:   CommunicationStatusEnum.CLICKED,
    EventTypeEnum.CONVERTED: CommunicationStatusEnum.CONVERTED,
    EventTypeEnum.FAILED:    CommunicationStatusEnum.FAILED,
}


async def _broadcast_ws(campaign_id: str, payload: dict):
    """Fire-and-forget WebSocket broadcast — called as a BackgroundTask."""
    try:
        from app.core.ws_manager import ws_manager
        await ws_manager.broadcast(campaign_id, payload)
    except Exception:
        pass


def _process_event(db: Session, event: WebhookCallback) -> tuple[str, str, dict]:
    """Returns (status, campaign_id, ws_payload). Raises HTTPException on hard errors."""
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
        return "skipped", comm.campaign_id, {}

    ev = CommunicationEvent(
        communication_id=event.communication_id,
        event_type=event.event_type,
        event_time=event.event_time,
        event_metadata=event.metadata,
    )
    db.add(ev)

    # Forward-only status update
    new_status = EVENT_TO_STATUS.get(event.event_type)
    if new_status and new_status != comm.status:
        if new_status == CommunicationStatusEnum.FAILED:
            comm.status = new_status
        elif (comm.status in STATUS_ORDER
              and new_status in STATUS_ORDER
              and STATUS_ORDER.index(new_status) > STATUS_ORDER.index(comm.status)):
            comm.status = new_status

    db.flush()

    from app.workers.analytics_worker import update_campaign_analytics
    update_campaign_analytics.delay(comm.campaign_id)

    ws_payload = {
        "communication_id": event.communication_id,
        "event_type": event.event_type.value,
        "event_time": event.event_time.isoformat(),
    }
    logger.info("receipt_processed", comm_id=event.communication_id, event=event.event_type, campaign=comm.campaign_id)
    return "processed", comm.campaign_id, ws_payload


@router.post("/webhook")
async def webhook(payload: WebhookCallback, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    status, campaign_id, ws_payload = _process_event(db, payload)
    db.commit()
    if ws_payload:
        background_tasks.add_task(_broadcast_ws, campaign_id, ws_payload)
    return {"status": status}


@router.post("/webhook/bulk")
async def bulk_webhook(payload: BulkWebhookCallback, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    processed, failed, skipped = 0, 0, 0
    ws_broadcasts: list[tuple[str, dict]] = []
    for event in payload.events:
        try:
            result, campaign_id, ws_payload = _process_event(db, event)
            if result == "skipped":
                skipped += 1
            else:
                processed += 1
                if ws_payload:
                    ws_broadcasts.append((campaign_id, ws_payload))
        except HTTPException:
            failed += 1
        except Exception as e:
            logger.error("bulk_event_failed", comm_id=event.communication_id, error=str(e))
            failed += 1
    db.commit()
    for cid, wp in ws_broadcasts:
        background_tasks.add_task(_broadcast_ws, cid, wp)
    return {"total": len(payload.events), "processed": processed, "skipped": skipped, "failed": failed}
