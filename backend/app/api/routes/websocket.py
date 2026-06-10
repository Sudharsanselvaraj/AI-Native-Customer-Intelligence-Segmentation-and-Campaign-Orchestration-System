"""WebSocket endpoint for real-time campaign analytics streaming."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.ws_manager import ws_manager
import structlog

logger = structlog.get_logger()
router = APIRouter()


@router.websocket("/campaigns/{campaign_id}")
async def campaign_ws(campaign_id: str, websocket: WebSocket):
    """
    Subscribe to live events for a campaign.
    Messages are JSON: {communication_id, event_type, event_time}
    """
    await ws_manager.connect(campaign_id, websocket)
    logger.info("ws_connected", campaign_id=campaign_id)
    try:
        while True:
            # Keep connection alive — we only push, never read from client
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(campaign_id, websocket)
        logger.info("ws_disconnected", campaign_id=campaign_id)
