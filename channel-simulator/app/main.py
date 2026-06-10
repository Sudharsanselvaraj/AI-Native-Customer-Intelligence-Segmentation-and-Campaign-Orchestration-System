from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional, Dict, Any
import structlog

from app.tasks import simulate_delivery
from app.config import settings

logger = structlog.get_logger()
app = FastAPI(title="Channel Simulator", version="1.0.0")


class SendRequest(BaseModel):
    communication_id: str
    recipient_id: str
    recipient_phone: Optional[str] = None
    recipient_email: Optional[str] = None
    message: str
    channel: str
    callback_url: str
    metadata: Optional[Dict[str, Any]] = None


@app.get("/health")
def health():
    return {"status": "ok", "service": "channel-simulator"}


@app.post("/send")
def send(req: SendRequest):
    logger.info("send_queued", comm_id=req.communication_id, channel=req.channel)
    simulate_delivery.delay(
        communication_id=req.communication_id,
        channel=req.channel,
        callback_url=req.callback_url,
        metadata=req.metadata or {},
    )
    return {"status": "queued", "communication_id": req.communication_id}
