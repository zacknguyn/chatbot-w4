import json
import os
import sqlite3
import time
import urllib.request
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key

bedrock_agent_runtime = boto3.client("bedrock-agent-runtime", region_name="us-east-1")
bedrock_runtime = boto3.client("bedrock-runtime", region_name="us-east-1")
dynamodb = boto3.resource("dynamodb", region_name="us-east-1")

KNOWLEDGE_BASE_ID = os.environ.get("KB_ID", "YOUR_KB_ID")
MODEL_ID = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
DB_PATH = "/opt/geekbrain.db"
MONITORING_API_URL = os.environ.get(
    "MONITORING_API_URL", "http://YOUR_FARGATE_PUBLIC_IP:8000"
)
CONVERSATION_TABLE = "geekbrain-conversations"


# ================================================================
#  MEMORY — DynamoDB conversation store (compact model)
# ================================================================


def save_turn(session_id, turn_number, question, answer, level, tools_used=None):
    try:
        table = dynamodb.Table(CONVERSATION_TABLE)
        compact_answer = answer[:500] if answer else ""
        compact_tools = []
        for t in tools_used or []:
            if isinstance(t, dict):
                compact_tools.append(
                    {"tool": t.get("tool", ""), "input": t.get("input", {})}
                )

        # Adjacency list pattern — TURN# prefix for turn items
        table.put_item(
            Item={
                "session_id": session_id,
                "turn_number": f"TURN#{int(turn_number):04d}",
                "question": question[:300],
                "answer": compact_answer,
                "level": level,
                "tools_used": json.dumps(compact_tools),
                "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "expires_at": int(time.time()) + (24 * 60 * 60),
            }
        )

        # Adjacency list pattern — META# prefix for session metadata
        table.put_item(
            Item={
                "session_id": session_id,
                "turn_number": "META#session",
                "last_turn": int(turn_number),
                "last_question": question[:100],
                "last_updated": datetime.now(timezone.utc).strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                ),
                "expires_at": int(time.time()) + (24 * 60 * 60),
            }
        )

        print(f"✅ Saved TURN#{turn_number} for session {session_id}")
    except Exception as e:
        print(f"❌ Memory write error: {str(e)}")


def get_conversation_history(session_id, max_turns=5):
    try:
        table = dynamodb.Table(CONVERSATION_TABLE)
        response = table.query(
            KeyConditionExpression=Key("session_id").eq(session_id)
            & Key("turn_number").begins_with("TURN#"),
            ScanIndexForward=False,
            Limit=max_turns,
        )
        items = sorted(response.get("Items", []), key=lambda x: x["turn_number"])
        return items
    except Exception as e:
        print(f"Memory read error: {str(e)}")
        return []


def get_next_turn_number(session_id):
    try:
        table = dynamodb.Table(CONVERSATION_TABLE)
        response = table.get_item(
            Key={"session_id": session_id, "turn_number": "META#session"}
        )
        item = response.get("Item")
        if not item:
            return 1
        return int(item.get("last_turn", 0)) + 1
    except Exception:
        return 1


def build_history_context(history_items):
    if not history_items:
        return ""

    lines = ["=== Conversation history (use this to resolve pronouns) ==="]
    for item in history_items:
        turn_num = item.get("turn_number", "").replace("TURN#", "").lstrip("0") or "?"
        q = item.get("question", "")
        a = item.get("answer", "")
        tools = item.get("tools_used", "[]")

        try:
            tools_list = json.loads(tools) if isinstance(tools, str) else tools
            tool_names = [t.get("tool", "") for t in tools_list if isinstance(t, dict)]
            tool_hint = f" [tools: {', '.join(tool_names)}]" if tool_names else ""
        except Exception:
            tool_hint = ""

        lines.append(f"Turn {turn_num} — Q: {q}{tool_hint}")
        lines.append(f"         A: {a}")

    lines.append("=== End of history ===\n")
    return "\n".join(lines)


# ================================================================
#  SHARED UTILITIES
# ================================================================


def retrieve_from_kb(question, num_results=10):
    try:
        response = bedrock_agent_runtime.retrieve(
            knowledgeBaseId=KNOWLEDGE_BASE_ID,
            retrievalQuery={"text": question},
            retrievalConfiguration={
                "vectorSearchConfiguration": {
                    "numberOfResults": num_results,
                    "overrideSearchType": "HYBRID",
                }
            },
        )
        chunks = response["retrievalResults"]
        if not chunks:
            return "No relevant documents found.", [], []

        context_parts = []
        sources = []
        chunks_detail = []

        for i, chunk in enumerate(chunks):
            doc_name = chunk["location"]["s3Location"]["uri"].split("/")[-1]
            text = chunk["content"]["text"]
            score = round(chunk["score"], 3)
            context_parts.append(f"[Source: {doc_name} | Score: {score}]\n{text[:500]}")
            if doc_name not in sources:
                sources.append(doc_name)

            lines = text.splitlines()
            total_lines = len(lines)
            preview_lines = lines[:15]
            line_end = min(15, total_lines)
            numbered_preview = "\n".join(
                [f"{idx + 1:>3} | {line}" for idx, line in enumerate(preview_lines)]
            )
            if total_lines > 15:
                numbered_preview += f"\n... ({total_lines - 15} more lines)"

            chunks_detail.append(
                {
                    "chunk_index": i + 1,
                    "source": doc_name,
                    "score": score,
                    "lines": f"line 1 to line {line_end} of {total_lines}",
                    "char_count": len(text),
                    "text_preview": numbered_preview,
                }
            )

        return "\n\n---\n\n".join(context_parts), sources, chunks_detail

    except Exception as e:
        return f"KB retrieval error: {str(e)}", [], []


def call_claude(system_prompt, messages, tools=None):
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1024,
        "system": system_prompt,
        "messages": messages,
    }
    if tools:
        body["tools"] = tools
    response = bedrock_runtime.invoke_model(modelId=MODEL_ID, body=json.dumps(body))
    return json.loads(response["body"].read())


# ================================================================
#  LEVEL 1 — Simple RAG
# ================================================================

L1_SYSTEM_PROMPT = """You are an AI assistant for GeekBrain, a fintech company.

Answer the question using the context provided below.

CRITICAL RULES:
1. If you see BOTH an archived/v1 document AND a current/v2 document, ALWAYS use v2/current.
2. NEVER say you cannot answer if a v2 document is in the context.
3. Cite the source document name (prefer v2 over v1).
4. Give a short, direct answer with the actual value.

MEMORY RULE: If "=== Conversation history ===" appears above, treat it as ground truth.
Resolve ALL pronouns and references from it: 'that service' → the service named in the last turn,
'their team' → the team responsible for that service, 'the same issue' → the issue from the last incident answer.
NEVER ask the user to repeat context they already gave.
"""


def handle_l1(question, history_context=""):
    kb_context, kb_sources, chunks_detail = retrieve_from_kb(question, num_results=1)
    history_section = f"{history_context}\n\n" if history_context else ""

    messages = [
        {
            "role": "user",
            "content": f"""{history_section}Context from Knowledge Base:
{kb_context}

Question: {question}""",
        }
    ]

    result = call_claude(L1_SYSTEM_PROMPT, messages)
    answer = next(
        (block["text"] for block in result["content"] if block["type"] == "text"),
        "No answer generated.",
    )
    return {
        "level": "L1 - Simple RAG",
        "answer": answer,
        "kb_sources": kb_sources,
        "chunks_retrieved": len(chunks_detail),
        "chunks_detail": chunks_detail,
        "tools_used": [],
    }


# ================================================================
#  LEVEL 2 — Multi-Source RAG + Conflict Resolution
# ================================================================

L2_SYSTEM_PROMPT = """You are an AI assistant for GeekBrain, a fintech company.

Answer the question using the context chunks provided below.

RULES:
1. Always cite the exact source document name for every fact.
2. If multiple documents give different information:
   - Check version numbers and dates
   - Prefer most recent (v2 over v1, newer date over older)
   - Explicitly state the conflict and resolution
3. Synthesize multi-document answers into one coherent response.

MEMORY RULE: If "=== Conversation history ===" appears above, treat it as ground truth.
Resolve ALL pronouns and references from it: 'that service' → the service named in the last turn,
'their team' → the team responsible for that service, 'the same issue' → the issue from the last incident answer.
NEVER ask the user to repeat context they already gave.

RANKING RULE: Before synthesizing, mentally rank all sources:
  1. Highest version number (v3 > v2 > v1)
  2. Most recent date if versions equal
  3. Most specific to the question if no version/date signals
  Always state your ranking explicitly: "Using [DocA] as primary source (v2, most recent) over [DocB] (v1, older)."
"""


def handle_l2(question, history_context=""):
    kb_context, kb_sources, chunks_detail = retrieve_from_kb(question, num_results=10)
    history_section = f"{history_context}\n\n" if history_context else ""

    messages = [
        {
            "role": "user",
            "content": f"""{history_section}Context from Knowledge Base (multiple documents):
{kb_context}

Question: {question}

If documents conflict, identify which is more recent and explain.""",
        }
    ]

    result = call_claude(L2_SYSTEM_PROMPT, messages)
    answer = next(
        (block["text"] for block in result["content"] if block["type"] == "text"),
        "No answer generated.",
    )
    return {
        "level": "L2 - Multi-Source RAG",
        "answer": answer,
        "kb_sources": kb_sources,
        "chunks_retrieved": len(chunks_detail),
        "chunks_detail": chunks_detail,
        "tools_used": [],
    }


# ================================================================
#  LEVEL 3 — RAG + Tools
# ================================================================

LIVE_MONITORING_TOOLS = [
    {
        "name": "list_services",
        "description": "[AG1-LiveMonitoring] List all services in GeekBrain system.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "service_status",
        "description": "[AG1-LiveMonitoring] Get current health status and uptime RIGHT NOW.",
        "input_schema": {
            "type": "object",
            "properties": {
                "service_name": {
                    "type": "string",
                    "description": "One of: PaymentGW, OrderSvc, NotificationSvc, AuthSvc, InventorySvc, ReportingSvc",
                }
            },
            "required": ["service_name"],
        },
    },
    {
        "name": "service_metrics",
        "description": "[AG1-LiveMonitoring] Get LIVE performance metrics: p99 latency, error rate, requests/min, CPU, memory RIGHT NOW.",
        "input_schema": {
            "type": "object",
            "properties": {
                "service_name": {
                    "type": "string",
                    "description": "One of: PaymentGW, OrderSvc, NotificationSvc, AuthSvc, InventorySvc, ReportingSvc",
                }
            },
            "required": ["service_name"],
        },
    },
]

DATABASE_QUERY_TOOLS = [
    {
        "name": "database_query",
        "description": "[AG2-DatabaseQuery] Query historical data from SQLite. Use for: monthly costs, SLA targets, daily metrics Jan-Mar 2026.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "SQL SELECT query. Tables: monthly_costs(service,month,total_cost), sla_targets(service,metric,target,measurement_window), daily_metrics(service,date,latency_p99_ms,error_rate_percent,requests_per_minute,availability_percent)",
                }
            },
            "required": ["query"],
        },
    }
]

INCIDENT_RETRIEVAL_TOOLS = [
    {
        "name": "incident_history_all",
        "description": "[AG3-IncidentRetrieval] Get ALL incidents across ALL services.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "incident_history_service",
        "description": "[AG3-IncidentRetrieval] Get incidents for ONE specific service.",
        "input_schema": {
            "type": "object",
            "properties": {
                "service_name": {
                    "type": "string",
                    "description": "One of: PaymentGW, OrderSvc, NotificationSvc, AuthSvc, InventorySvc, ReportingSvc",
                }
            },
            "required": ["service_name"],
        },
    },
]

L3_ALL_TOOLS = LIVE_MONITORING_TOOLS + DATABASE_QUERY_TOOLS + INCIDENT_RETRIEVAL_TOOLS

L3_SYSTEM_PROMPT = """You are an AI assistant for GeekBrain, a fintech company with 6 production services.

ACTION GROUP 1 — LiveMonitoring (ECS Fargate monitoring API):
- list_services: list all services
- service_status: current health/uptime RIGHT NOW
- service_metrics: live latency, error rate, requests/min RIGHT NOW

ACTION GROUP 2 — DatabaseQuery (SQLite historical database):
- database_query: monthly costs, SLA targets, daily metrics Jan-Mar 2026

ACTION GROUP 3 — IncidentRetrieval (ECS Fargate monitoring API):
- incident_history_all: ALL incidents across ALL services
- incident_history_service: incidents for ONE specific service

ACTION GROUP 4 — KnowledgeBase (36 markdown docs):
- policies, teams, architecture, deployment rules

DECISION RULES:
- Current/live/right now → AG1
- Historical cost/metrics → AG2
- Incident/outage history → AG3
- Policy/team/architecture → AG4
- Comparing current vs historical → AG1 + AG2

MEMORY RULE: If "=== Conversation history ===" appears above, treat it as ground truth.
Resolve ALL pronouns and references from it: 'that service' → the service named in the last turn,
'their team' → the team responsible for that service, 'the same issue' → the issue from the last incident answer.
NEVER ask the user to repeat context they already gave.

Always state which Action Group and tool you used.
"""


def call_monitoring_api(path):
    try:
        url = f"{MONITORING_API_URL}{path}"
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode()), url
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.reason}"}, f"{MONITORING_API_URL}{path}"
    except urllib.error.URLError as e:
        return {
            "error": f"Cannot connect: {str(e.reason)}"
        }, f"{MONITORING_API_URL}{path}"
    except Exception as e:
        return {"error": str(e)}, f"{MONITORING_API_URL}{path}"


def dispatch_tool(tool_name, tool_input):
    if tool_name == "list_services":
        result, url = call_monitoring_api("/services")
        return result, "AG1-LiveMonitoring", url
    elif tool_name == "service_status":
        result, url = call_monitoring_api(
            f"/status/{tool_input.get('service_name', '')}"
        )
        return result, "AG1-LiveMonitoring", url
    elif tool_name == "service_metrics":
        result, url = call_monitoring_api(
            f"/metrics/{tool_input.get('service_name', '')}"
        )
        return result, "AG1-LiveMonitoring", url
    elif tool_name == "database_query":
        query = tool_input.get("query", "")
        if any(w in query.upper() for w in ["DROP", "DELETE", "INSERT", "UPDATE"]):
            return (
                {"error": "Only SELECT queries allowed"},
                "AG2-DatabaseQuery",
                "SQLite DB",
            )
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(query)
            rows = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return (
                {"results": rows, "count": len(rows)},
                "AG2-DatabaseQuery",
                "SQLite /opt/geekbrain.db",
            )
        except Exception as e:
            return {"error": f"SQL Error: {str(e)}"}, "AG2-DatabaseQuery", "SQLite DB"
    elif tool_name == "incident_history_all":
        result, url = call_monitoring_api("/incidents")
        return result, "AG3-IncidentRetrieval", url
    elif tool_name == "incident_history_service":
        result, url = call_monitoring_api(
            f"/incidents/{tool_input.get('service_name', '')}"
        )
        return result, "AG3-IncidentRetrieval", url
    else:
        return {"error": f"Unknown tool: {tool_name}"}, "Unknown", "unknown"


def handle_l3(question, history_context=""):
    # Always retrieve KB context — let Claude decide if it needs it
    kb_context, kb_sources, chunks_detail = retrieve_from_kb(question, num_results=5)
    history_section = f"{history_context}\n\n" if history_context else ""

    messages = [
        {
            "role": "user",
            "content": f"""{history_section}Knowledge Base Context (AG4-KnowledgeBase):
{kb_context}

Question: {question}""",
        }
    ]

    tool_calls_log = []
    reasoning_steps = []
    loop_count = 0
    max_loops = 5

    while loop_count < max_loops:
        loop_count += 1
        result = call_claude(L3_SYSTEM_PROMPT, messages, tools=L3_ALL_TOOLS)
        stop_reason = result.get("stop_reason")
        content = result.get("content", [])
        messages.append({"role": "assistant", "content": content})

        if stop_reason == "end_turn":
            answer = next(
                (block["text"] for block in content if block["type"] == "text"),
                "No answer generated.",
            )
            return {
                "level": "L3 - RAG + Tools",
                "answer": answer,
                "reasoning": reasoning_steps,
                "tools_used": tool_calls_log,
                "kb_sources": kb_sources,
                "chunks_retrieved": len(chunks_detail),
                "chunks_detail": chunks_detail,
            }

        if stop_reason == "tool_use":
            tool_results = []
            for block in content:
                if block["type"] != "tool_use":
                    continue
                tool_name = block["name"]
                tool_input = block["input"]
                tool_use_id = block["id"]
                tool_result, action_group, api_endpoint = dispatch_tool(
                    tool_name, tool_input
                )
                step_num = len(reasoning_steps) + 1
                is_error = isinstance(tool_result, dict) and "error" in tool_result
                reasoning_steps.append(
                    {
                        "step": step_num,
                        "action_group": action_group,
                        "tool_called": tool_name,
                        "api_endpoint": api_endpoint,
                        "input": tool_input,
                        "status": "error" if is_error else "success",
                    }
                )
                tool_calls_log.append(
                    {
                        "step": step_num,
                        "action_group": action_group,
                        "tool": tool_name,
                        "api_endpoint": api_endpoint,
                        "input": tool_input,
                        "result": tool_result,
                        "status": "error" if is_error else "success",
                    }
                )
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_use_id,
                        "content": [
                            {
                                "type": "text",
                                "text": json.dumps(tool_result, ensure_ascii=False),
                            }
                        ],
                    }
                )
            messages.append({"role": "user", "content": tool_results})

    # Fallback if max loops reached — return best available answer
    last_text = next(
        (
            b["text"]
            for b in messages[-1].get("content", [])
            if isinstance(b, dict) and b.get("type") == "text"
        ),
        None,
    )
    return {
        "level": "L3 - RAG + Tools",
        "answer": last_text or "Partial response — tool limit reached.",
        "reasoning": reasoning_steps,
        "tools_used": tool_calls_log,
        "kb_sources": kb_sources,
        "chunks_retrieved": len(chunks_detail),
        "chunks_detail": chunks_detail,
    }


# ================================================================
#  MAIN HANDLER
# ================================================================


def lambda_handler(event, context):
    try:
        body = json.loads(event.get("body", "{}"))
        question = body.get("question", "")
        level = int(body.get("level", 3))
        session_id = body.get("session_id", "default-session")

        if not question:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "No question provided"}),
            }

        # Get conversation history from DynamoDB
        history = get_conversation_history(session_id, max_turns=5)
        history_context = build_history_context(history)
        turn_number = get_next_turn_number(session_id)

        # Route to correct level
        if level == 1:
            result = handle_l1(question, history_context)
        elif level == 2:
            result = handle_l2(question, history_context)
        elif level == 3:
            result = handle_l3(question, history_context)
        elif level == 4:
            result = handle_l3(question, history_context)
            result["level"] = "L4 - RAG + Tools + Memory"
        else:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "level must be 1, 2, 3, or 4"}),
            }

        # Save compact turn to DynamoDB
        save_turn(
            session_id=session_id,
            turn_number=turn_number,
            question=question,
            answer=result.get("answer", ""),
            level=f"L{level}",
            tools_used=result.get("tools_used", []),
        )

        # Add memory metadata to response
        result["session_id"] = session_id
        result["turn_number"] = turn_number
        result["history_turns_used"] = len(history)

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(result),
        }

    except bedrock_agent_runtime.exceptions.ResourceNotFoundException:
        return {
            "statusCode": 404,
            "body": json.dumps(
                {"error": "Knowledge Base not found. Check KB_ID env var."}
            ),
        }
    except Exception as e:
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
