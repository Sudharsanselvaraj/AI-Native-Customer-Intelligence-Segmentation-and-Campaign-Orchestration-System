import random
import time
from datetime import datetime, timezone
from celery import Celery
import httpx
import structlog

from app.config import settings

logger = structlog.get_logger()

celery_app = Celery(
    "channel_simulator",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)

# Realistic delivery probabilities per channel
CHANNEL_PROFILES = {
    "whatsapp": {"delivered": 0.92, "opened": 0.78, "read": 0.65, "clicked": 0.22, "converted": 0.08},
    "email":    {"delivered": 0.88, "opened": 0.35, "read": 0.28, "clicked": 0.12, "converted": 0.04},
    "sms":      {"delivered": 0.95, "opened": 0.90, "read": 0.85, "clicked": 0.08, "converted": 0.03},
    "rcs":      {"delivered": 0.85, "opened": 0.60, "read": 0.50, "clicked": 0.18, "converted": 0.06},
}

DEFAULT_PROFILE = {"delivered": 0.88, "opened": 0.40, "read": 0.32, "clicked": 0.12, "converted": 0.04}


def _callback(callback_url: str, comm_id: str, event_type: str, metadata: dict = None):
    payload = {
        "communication_id": comm_id,
        "event_type": event_type,
        "event_time": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata or {},
    }
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(callback_url, json=payload)
            resp.raise_for_status()
    except Exception as e:
        logger.error("callback_failed", comm_id=comm_id, event=event_type, error=str(e))


@celery_app.task(bind=True, max_retries=3, default_retry_delay=5)
def simulate_delivery(self, communication_id: str, channel: str, callback_url: str, metadata: dict):
    profile = CHANNEL_PROFILES.get(channel.lower(), DEFAULT_PROFILE)

    try:
        # SENT immediately
        _callback(callback_url, communication_id, "SENT")
        time.sleep(random.uniform(0.5, 2.0))

        # DELIVERED or FAILED
        if random.random() < profile["delivered"]:
            _callback(callback_url, communication_id, "DELIVERED")

            # OPENED
            time.sleep(random.uniform(1.0, 5.0))
            if random.random() < profile["opened"]:
                _callback(callback_url, communication_id, "OPENED")

                # READ
                time.sleep(random.uniform(0.5, 2.0))
                if random.random() < profile["read"]:
                    _callback(callback_url, communication_id, "READ")

                # CLICKED
                time.sleep(random.uniform(1.0, 8.0))
                if random.random() < profile["clicked"]:
                    _callback(callback_url, communication_id, "CLICKED")

                    # CONVERTED
                    time.sleep(random.uniform(2.0, 15.0))
                    if random.random() < profile["converted"]:
                        order_value = round(random.uniform(200, 5000), 2)
                        _callback(callback_url, communication_id, "CONVERTED",
                                  {"order_value": order_value})
        else:
            _callback(callback_url, communication_id, "FAILED",
                      {"reason": random.choice(["invalid_number", "network_error", "opted_out"])})

        logger.info("simulation_complete", comm_id=communication_id, channel=channel)

    except Exception as exc:
        logger.error("simulation_error", comm_id=communication_id, error=str(exc))
        raise self.retry(exc=exc)
