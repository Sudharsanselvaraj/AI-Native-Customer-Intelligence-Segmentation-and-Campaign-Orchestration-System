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

SYSTEM_PROMPT = """You are Aster, an AI marketing copilot for AsterCRM. You help marketers understand customers, build segments, create campaigns, and analyse performance.

IMPORTANT RULES:
- For casual greetings or unclear inputs (e.g. "hi", "company", "hello"), respond conversationally WITHOUT calling any tools.
- Only call tools when the user explicitly asks for data, wants to create something, or requests an action.
- After tool results come back, ALWAYS write a clear, helpful natural-language summary of what you found or did. Never just say "I've completed the requested actions."
- Be concise. 3–5 sentences max for analytics summaries. Use bullet points for lists.
- If asked about the company or platform, explain that AsterCRM is an AI-native CRM with segments, campaigns, analytics, and an AI copilot."""

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
    },
    {
        "type": "function",
        "function": {
            "name": "plan_workflow",
            "description": "Given a high-level marketing goal, plan a full campaign workflow: segment → campaign → channel → launch. Returns a step-by-step plan for user approval before execution.",
            "parameters": {
                "type": "object",
                "properties": {
                    "goal": {
                        "type": "string",
                        "description": "The marketing goal, e.g. 'increase purchases from dormant users'"
                    }
                },
                "required": ["goal"]
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
                max_tokens=400,
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
                max_tokens=400,
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
                max_tokens=400,
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
        max_iterations = 3
        iteration = 0

        while iteration < max_iterations:
            iteration += 1
            try:
                response = self.client.chat.completions.create(
                    model=settings.AI_MODEL,
                    messages=messages,
                    tools=COPILOT_TOOLS,
                    tool_choice="auto",
                    max_tokens=400,
                )
            except Exception as tool_err:
                # Groq/Llama sometimes fails to parse its own tool-call output;
                # fall back to a plain text response without tools.
                if "tool_use_failed" in str(tool_err) or "Failed to call" in str(tool_err):
                    plain = self.client.chat.completions.create(
                        model=settings.AI_MODEL,
                        messages=messages,
                        max_tokens=400,
                    )
                    return {
                        "message": plain.choices[0].message.content or "Done.",
                        "actions_taken": actions_taken,
                    }
                raise

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

        # Max iterations reached — force the model to summarise what it did
        try:
            messages.append({
                "role": "user",
                "content": "Please summarise what you just did and what you found in 3–5 clear sentences."
            })
            summary = self.client.chat.completions.create(
                model=settings.AI_MODEL,
                messages=messages,
                max_tokens=400,
            )
            return {
                "message": summary.choices[0].message.content or "All actions completed.",
                "actions_taken": actions_taken,
            }
        except Exception:
            return {
                "message": f"I completed {len(actions_taken)} action(s): {', '.join(a['tool'] for a in actions_taken)}.",
                "actions_taken": actions_taken,
            }


    def generate_insights(self, stats: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate AI-powered insights from dashboard analytics."""
        try:
            summary = (
                f"Total customers: {stats.get('total_customers', 0)}, "
                f"Total revenue: ₹{stats.get('total_revenue', 0):,.0f}, "
                f"Total campaigns: {stats.get('total_campaigns', 0)}, "
                f"Messages sent: {stats.get('total_messages_sent', 0)}, "
                f"Avg delivery rate: {stats.get('avg_delivery_rate', 0):.1%}, "
                f"Avg open rate: {stats.get('avg_open_rate', 0):.1%}, "
                f"Avg CTR: {stats.get('avg_ctr', 0):.1%}, "
                f"Avg conversion rate: {stats.get('avg_conversion_rate', 0):.1%}. "
                f"Top campaign: {stats.get('campaign_performance', [{}])[0].get('name', 'N/A') if stats.get('campaign_performance') else 'N/A'}."
            )
            response = self.client.chat.completions.create(
                model=settings.AI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": """You are a marketing analytics expert. Given CRM performance stats, generate 3-5 actionable insights.
Respond ONLY with a JSON array (no markdown):
[
  {
    "type": "warning|opportunity|success|info",
    "title": "short title",
    "description": "1-2 sentence insight",
    "action": "suggested action or null"
  }
]"""
                    },
                    {"role": "user", "content": f"Analyze these CRM stats:\n{summary}"}
                ],
                max_tokens=400,
                temperature=0.5,
            )
            raw = response.choices[0].message.content.strip()
            raw = re.sub(r"```(?:json)?", "", raw).strip().strip("`")
            return json.loads(raw)
        except Exception as e:
            logger.error("insights_generation_failed", error=str(e))
            return [
                {
                    "type": "info",
                    "title": "Analytics overview",
                    "description": f"You have {stats.get('total_customers', 0)} customers and {stats.get('total_campaigns', 0)} campaigns running.",
                    "action": "Launch a new campaign to engage your audience."
                }
            ]

    def plan_campaign_workflow(
        self,
        goal: str,
        analytics_context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Agentic planning: given a high-level marketing goal, return a step-by-step
        workflow plan (segment definition, campaign brief, channel recommendation).
        """
        try:
            response = self.client.chat.completions.create(
                model=settings.AI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": """You are a senior marketing strategist. Given a goal and analytics context,
create a complete campaign workflow plan. Respond ONLY with this JSON (no markdown):
{
  "goal_summary": "rephrased goal",
  "segment": {
    "name": "segment name",
    "description": "who to target",
    "natural_language": "NL query for the segment"
  },
  "campaign": {
    "name": "campaign name",
    "message_template": "personalized message with {customer_name}",
    "channel": "whatsapp|email|sms|rcs",
    "channel_confidence": 0.85,
    "channel_reasoning": "why this channel"
  },
  "expected_outcomes": {
    "audience_size": "estimated size description",
    "delivery_rate": 0.90,
    "open_rate": 0.35,
    "conversion_rate": 0.08
  },
  "steps": [
    {"step": 1, "action": "create_segment", "description": "..."},
    {"step": 2, "action": "create_campaign", "description": "..."},
    {"step": 3, "action": "launch_campaign", "description": "..."}
  ]
}"""
                    },
                    {
                        "role": "user",
                        "content": f"Goal: {goal}\n\nCurrent analytics: {json.dumps(analytics_context, default=str)[:800]}"
                    }
                ],
                max_tokens=400,
                temperature=0.6,
            )
            raw = response.choices[0].message.content.strip()
            raw = re.sub(r"```(?:json)?", "", raw).strip().strip("`")
            return json.loads(raw)
        except Exception as e:
            logger.error("workflow_planning_failed", error=str(e))
            raise ValueError(f"Failed to plan workflow: {e}")


ai_service = AIService()
