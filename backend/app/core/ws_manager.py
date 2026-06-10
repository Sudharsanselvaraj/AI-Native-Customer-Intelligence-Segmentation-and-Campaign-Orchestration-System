"""WebSocket connection manager for real-time campaign event broadcasting."""
import json
from typing import Dict, List
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # campaign_id → list of active WebSocket connections
        self._connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, campaign_id: str, websocket: WebSocket):
        await websocket.accept()
        self._connections.setdefault(campaign_id, []).append(websocket)

    def disconnect(self, campaign_id: str, websocket: WebSocket):
        conns = self._connections.get(campaign_id, [])
        if websocket in conns:
            conns.remove(websocket)

    async def broadcast(self, campaign_id: str, data: dict):
        conns = self._connections.get(campaign_id, [])
        dead = []
        for ws in conns:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(campaign_id, ws)


ws_manager = ConnectionManager()
