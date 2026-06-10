import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.ai_service import ai_service
from app.services.segment_service import segment_service
from app.services.campaign_service import campaign_service
from app.services.analytics_service import analytics_service
from app.schemas.schemas import (
    CopilotRequest, CopilotResponse, NLSegmentRequest, CampaignCreate, ChannelEnum
)
from app.models.models import Segment, Campaign

router = APIRouter()


def make_tool_executor(db: Session):
    def execute_tool(tool_name: str, args: dict) -> dict:
        if tool_name == "create_segment":
            req = NLSegmentRequest(
                natural_language=args["natural_language"],
                name=args.get("name"),
            )
            result = segment_service.create_from_nl(db, req)
            return result

        elif tool_name == "create_campaign":
            prompt = args["prompt"]
            segment_id = args.get("segment_id")
            seg_name = None
            if segment_id:
                seg = db.query(Segment).filter(Segment.id == segment_id).first()
                seg_name = seg.name if seg else None

            gen = ai_service.generate_campaign(prompt, seg_name)

            if not segment_id:
                # Use first available segment
                segs = db.query(Segment).limit(1).all()
                segment_id = segs[0].id if segs else None

            if not segment_id:
                return {"error": "No segment available"}

            camp_data = CampaignCreate(
                name=gen["name"],
                description=gen.get("description"),
                channel=ChannelEnum(gen["channel"]),
                segment_id=segment_id,
                message_template=gen["message_template"],
            )
            camp = campaign_service.create_campaign(
                db, camp_data,
                ai_generated=True,
                expected_engagement=gen.get("expected_engagement"),
                expected_conversion=gen.get("expected_conversion"),
            )
            return {"campaign_id": camp.id, "name": camp.name, "channel": camp.channel.value}

        elif tool_name == "get_analytics":
            stats = analytics_service.get_dashboard_stats(db)
            metric = args.get("metric", "overview")
            if metric == "overview":
                return {
                    "total_customers": stats["total_customers"],
                    "total_revenue": stats["total_revenue"],
                    "total_campaigns": stats["total_campaigns"],
                    "total_messages_sent": stats["total_messages_sent"],
                    "avg_delivery_rate": stats["avg_delivery_rate"],
                    "avg_open_rate": stats["avg_open_rate"],
                }
            return stats

        elif tool_name == "list_segments":
            segs, _ = segment_service.get_segments(db, 1, 20)
            return [{"id": s.id, "name": s.name, "size": s.estimated_size} for s in segs]

        elif tool_name == "launch_campaign":
            campaign_id = args["campaign_id"]
            try:
                camp = campaign_service.launch_campaign(db, campaign_id)
                return {"status": camp.status.value, "campaign_id": camp.id}
            except ValueError as e:
                return {"error": str(e)}

        elif tool_name == "plan_workflow":
            goal = args["goal"]
            stats = analytics_service.get_dashboard_stats(db)
            plan = ai_service.plan_campaign_workflow(goal, {
                "total_customers": stats["total_customers"],
                "avg_open_rate": stats["avg_open_rate"],
                "avg_ctr": stats["avg_ctr"],
                "top_channels": stats["channel_breakdown"][:3],
            })
            return {"plan": plan, "requires_approval": True}

        return {"error": f"Unknown tool: {tool_name}"}

    return execute_tool


@router.post("", response_model=CopilotResponse)
def chat(req: CopilotRequest, db: Session = Depends(get_db)):
    session_id = req.session_id or str(uuid.uuid4())
    history = [{"role": m.role, "content": m.content} for m in req.conversation_history]
    try:
        result = ai_service.copilot_chat(
            message=req.message,
            conversation_history=history,
            tool_executor=make_tool_executor(db),
        )
        return {
            "message": result["message"],
            "actions_taken": result["actions_taken"],
            "session_id": session_id,
        }
    except Exception as e:
        raise HTTPException(500, f"Copilot error: {str(e)}")
