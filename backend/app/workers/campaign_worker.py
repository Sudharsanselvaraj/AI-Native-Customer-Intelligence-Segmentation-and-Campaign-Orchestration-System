import structlog
from app.core.celery_app import celery_app
from app.db.session import SessionLocal

logger = structlog.get_logger()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30, queue="campaigns")
def dispatch_campaign(self, campaign_id: str):
    db = SessionLocal()
    try:
        from app.services.campaign_service import campaign_service
        campaign = campaign_service.get_campaign(db, campaign_id)
        if not campaign:
            logger.error("campaign_not_found", campaign_id=campaign_id)
            return

        logger.info("dispatching_campaign", campaign_id=campaign_id, segment_id=campaign.segment_id)
        sent = campaign_service.send_communications(db, campaign)
        campaign_service.mark_completed(db, campaign_id)
        logger.info("campaign_dispatched", campaign_id=campaign_id, sent=sent)
        return {"sent": sent}

    except Exception as exc:
        logger.error("campaign_dispatch_failed", campaign_id=campaign_id, error=str(exc))
        db.rollback()
        try:
            from app.services.campaign_service import campaign_service
            campaign_service.mark_failed(db, campaign_id)
        except Exception:
            pass
        raise self.retry(exc=exc)
    finally:
        db.close()
