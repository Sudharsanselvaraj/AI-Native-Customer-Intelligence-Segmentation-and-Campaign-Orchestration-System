import json
import re
from typing import Any, Dict, List, Optional
from openai import OpenAI
from app.core.config import settings
import structlog

logger = structlog.get_logger()

client = OpenAI(
    api_key=settings.OPENROUTER_API_KEY,
    base_url=settings.OPENROUTER_BASE_URL,
)

SYSTEM_PROMPT = """You are ShopperReach AI, an intelligent marketing copilot for consumer brands.
You help marketers understand their customer base, build smart segments, create compelling campaigns, and measure performance.
You have access to tools to create segments, build campaigns, and fetch analytics.
Always be concise, data-driven, and action-oriented. When you take an action, confirm it clearly."""

SEGMENT_SQL_SYSTEM = """You are a SQL expert for a customer engagement platform. 
The database has these tables:
- customers(id, name, email, phone, city, gender, age, created_at)
- orders(id, customer_id, amount, category, purchase_date, created_at)

Generate a PostgreSQL WHERE clause (no SELECT, just the WHERE conditions) for customer IDs based on natural language.
The query must return customer IDs. Always use subqueries referencing customers.id.
Respond ONLY with valid JSON: {"sql": "...", "description": "..."}
Do not use markdown, do not explain, just JSON."""

COPILOT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_segment",
            "description": "Create a customer segment from a natural language description",
            "parameters": {
                "type": "object",
                "properties": {
                    "natural_language": {
                        "type": "string",
                        "description": "Natural language description of the segment"
                    },
                    "name": {
                        "type": "string",
                        "description": "Name for the segment"
                    }
                },
                "required": ["natural_language", "name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_campaign",
            "description": "Create a marketing campaign",
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": "Campaign goal or description"
                    },
                    "segment_id": {
                        "type": "string",
                        "description": "ID of the segment to target"
                    }
                },
                "required": ["prompt"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_analytics",
            "description": "Get analytics overview for campaigns and customers",
            "parameters": {
                "type": "object",
                "properties": {
                    "metric": {
                        "type": "string",
                        "description": "Specific metric to retrieve: overview, campaigns, customers, revenue"
                    }
                },
                "required": ["metric"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_segments",
            "description": "List available customer segments",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "launch_campaign",
            "description": "Execute/launch a campaign to start sending communications",
            "parameters": {
                "type": "object",
                "properties": {
                    "campaign_id": {
                        "type": "string",
                        "description": "The campaign ID to launch"
                    }
                },
                "required": ["campaign_id"]
            }
        }
    }
]


class AIService:
    def __init__(self):
        self.client = client

    def generate_segment_sql(self, natural_language: str) -> Dict[str, str]:
        """Convert natural language to SQL WHERE clause for customer segmentation."""
        try:
            response = self.client.chat.completions.create(
                model=settings.AI_MODEL,
                messages=[
                    {"role": "system", "content": SEGMENT_SQL_SYSTEM},
                    {"role": "user", "content": natural_language}
                ],
                max_tokens=500,
                temperature=0.1,
            )
            raw = response.choices[0].message.content.strip()
            # Strip markdown if model wraps in ```json
            raw = re.sub(r"```(?:json)?", "", raw).strip().strip("`")
            result = json.loads(raw)
            return result
        except Exception as e:
            logger.error("segment_sql_generation_failed", error=str(e))
            raise ValueError(f"Failed to generate segment SQL: {e}")

    def generate_campaign(self, prompt: str, segment_name: Optional[str] = None) -> Dict[str, Any]:
        """Generate a complete campaign from a prompt."""
        context = f"Target segment: {segment_name}" if segment_name else ""
        try:
            response = self.client.chat.completions.create(
                model=settings.AI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": """You are a marketing campaign expert. Generate campaign details as JSON.
Respond ONLY with this exact JSON structure, no markdown:
{
  "name": "campaign name",
  "description": "brief description",
  "message_template": "personalized message with {customer_name} placeholder",
  "channel": "whatsapp|email|sms|rcs",
  "channel_confidence": 0.85,
  "channel_reasoning": "reason for channel choice",
  "expected_engagement": 0.35,
  "expected_conversion": 0.12,
  "target_segment_suggestion": "optional segment description"
}"""
                    },
                    {"role": "user", "content": f"{prompt}\n{context}"}
                ],
                max_tokens=800,
                temperature=0.7,
            )
            raw = response.choices[0].message.content.strip()
            raw = re.sub(r"```(?:json)?", "", raw).strip().strip("`")
            return json.loads(raw)
        except Exception as e:
            logger.error("campaign_generation_failed", error=str(e))
            raise ValueError(f"Failed to generate campaign: {e}")

    def recommend_channel(self, segment_description: str, campaign_goal: str) -> Dict[str, Any]:
        """Recommend optimal channel for a campaign."""
        try:
            response = self.client.chat.completions.create(
                model=settings.AI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": """Recommend the best messaging channel for a marketing campaign.
Based on the segment and goal, output ONLY JSON:
{
  "recommended_channel": "whatsapp|email|sms|rcs",
  "confidence": 0.88,
  "reasoning": "explanation",
  "alternatives": [
    {"channel": "email", "confidence": 0.72, "note": "good for longer content"}
  ]
}"""
                    },
                    {
                        "role": "user",
                        "content": f"Segment: {segment_description}\nGoal: {campaign_goal}"
                    }
                ],
                max_tokens=500,
                temperature=0.3,
            )
            raw = response.choices[0].message.content.strip()
            raw = re.sub(r"```(?:json)?", "", raw).strip().strip("`")
            return json.loads(raw)
        except Exception as e:
            logger.error("channel_recommendation_failed", error=str(e))
            raise ValueError(f"Failed to recommend channel: {e}")

    def copilot_chat(
        self,
        message: str,
        conversation_history: List[Dict[str, str]],
        tool_executor: Any,
    ) -> Dict[str, Any]:
        """Multi-turn copilot chat with tool calling."""
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for h in conversation_history:
            messages.append({"role": h["role"], "content": h["content"]})
        messages.append({"role": "user", "content": message})

        actions_taken = []
        max_iterations = 5
        iteration = 0

        while iteration < max_iterations:
            iteration += 1
            response = self.client.chat.completions.create(
                model=settings.AI_MODEL,
                messages=messages,
                tools=COPILOT_TOOLS,
                tool_choice="auto",
                max_tokens=1000,
            )

            choice = response.choices[0]
            assistant_message = choice.message

            # If no tool calls, return final response
            if not assistant_message.tool_calls:
                return {
                    "message": assistant_message.content or "Done.",
                    "actions_taken": actions_taken,
                }

            # Append assistant message with tool calls
            messages.append({
                "role": "assistant",
                "content": assistant_message.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        }
                    }
                    for tc in assistant_message.tool_calls
                ]
            })

            # Execute each tool call
            for tool_call in assistant_message.tool_calls:
                fn_name = tool_call.function.name
                fn_args = json.loads(tool_call.function.arguments)

                try:
                    result = tool_executor(fn_name, fn_args)
                    actions_taken.append({"tool": fn_name, "args": fn_args, "result": result})
                    tool_result_content = json.dumps(result)
                except Exception as e:
                    tool_result_content = json.dumps({"error": str(e)})
                    actions_taken.append({"tool": fn_name, "args": fn_args, "error": str(e)})

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": tool_result_content,
                })

        return {
            "message": "I've completed the requested actions.",
            "actions_taken": actions_taken,
        }


ai_service = AIService()
