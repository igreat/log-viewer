import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
from typing import Optional, Any
from utils import load_logs, get_log_level_counts, compute_stats, extract_top_rows
from model_client import ModelClient, OpenAIModelClient, OfflineModelClient

# Load the .env file
load_dotenv()

# Initialize the FastAPI app
app = FastAPI()

# Allow CORS so that the frontend can communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# TODO: here I want paths to work in any environment, so maybe I should use pathlib
models: dict[str, ModelClient] = {
    "gpt-4o": OpenAIModelClient(os.getenv("OPENAI_API_KEY") or "", "gpt-4o"),
    "granite3.2-2b": OfflineModelClient(
        "models/granite/granite-3.1-2b-instruct-Q6_K_L.gguf"
    ),
}


# Define the request and response models
class ChatRequest(BaseModel):
    message: str
    known_issues: Optional[dict[str, Any]] = None


class Action(BaseModel):
    type: str  # e.g. "add_filter", "generate_summary", "flag_issue"
    body: dict[str, Any]


class ChatResponse(BaseModel):
    reply: Optional[str] = None
    actions: Optional[list[Action]] = None


@app.post("/chat_stream", response_model=ChatResponse)
async def chat_stream(request: ChatRequest):
    # TODO: the model should be part of the request, for now it's hardcoded
    model = models["gpt-4o"]

    if not request.message:
        raise HTTPException(status_code=400, detail="Message is required")
    try:
        # Load logs and compute statistics.
        logs = load_logs()
        level_counts = get_log_level_counts(logs)
        stats = compute_stats(level_counts)
        stats_str = json.dumps(stats, default=str, indent=2)

        # Build known issues context.
        known_issues = request.known_issues if request.known_issues else {}
        issue_context = {}
        for issue, details in known_issues.items():
            extracted_logs = extract_top_rows(logs, details["keywords"])
            issue_context[issue] = {
                "description": details["description"],
                "context": details["context"],
                "keywords": details["keywords"],
                "conditions": details["conditions"],
                "resolution": details["resolution"],
                "logs": extracted_logs,
            }

        # Define a lean base prompt.
        base_prompt = (
            "You are a helpful assistant integrated with a log viewer tool for Cisco engineers. "
            "Your role is to help analyze and filter large log files quickly. "
            "Do not include any additional text."
        )

        tasks = []  # Accumulate task objects.

        # Step 1: Decide if a summary is needed.
        prompt_summary_decision = f"""{base_prompt}
Log Statistics:
{stats_str}

User Query: {request.message}

Should a summary be generated? Answer with JSON:
{{ "generate_summary": true/false, "explanation": "Your reasoning" }}"""
        summary_decision_text = await model.chat_completion(prompt_summary_decision)
        summary_decision = {}
        if summary_decision_text:
            try:
                summary_decision = json.loads(summary_decision_text)
                tasks.append(
                    Action(
                        type="summary_decision",
                        body={
                            "generate_summary": summary_decision.get(
                                "generate_summary", False
                            ),
                            "explanation": summary_decision.get("explanation", ""),
                        },
                    )
                )
            except Exception as e:
                print("Error decoding summary decision:", e)

        # Step 2: Generate summary if requested.
        if summary_decision.get("generate_summary", False):
            prompt_generate_summary = f"""{base_prompt}
Log Statistics:
{stats_str}

User Query: {request.message}

Generate a summary of the log statistics. Respond with just the explanation:"""
            summary_text = await model.chat_completion(prompt_generate_summary)
            if summary_text:
                try:
                    tasks.append(
                        Action(
                            type="generate_summary",
                            body={"summary": summary_text},
                        )
                    )
                except Exception as e:
                    print("Error decoding summary task:", e)

        # Step 3: Evaluate each known issue.
        for issue, details in issue_context.items():
            prompt_issue = f"""{base_prompt}
Known Issue: "{issue}"
Issue Details:
{json.dumps(details, indent=2)}

User Query: {request.message}

Based on the above, should this issue be flagged? Respond with just the issue summary.
Make sure to include the resolution in the summary if needed
If not, respond with an empty string."""
            print("Prompt issue:", prompt_issue)
            issue_text = await model.chat_completion(prompt_issue)
            # issue_resp = await asyncio.to_thread(
            #     client.chat.completions.create,
            #     model="gpt-4o",
            #     messages=[{"role": "system", "content": prompt_issue}],
            # )
            print("Issue content:", issue_text)
            if issue_text:
                tasks.append(
                    Action(
                        type="flag_issue",
                        body={
                            "issue": issue,
                            "summary": issue_text,
                        },
                    )
                )

        # Aggregate final reply by concatenating all task explanations.
        # TODO: think about what to do with "final_reply", for now it's just a placeholder
        # final_reply = " ".join(
        #     [t.get("explanation", "") for t in tasks if "explanation" in t]
        # ).strip()

        return ChatResponse(
            reply="",
            actions=tasks,
        )
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Error processing your request")


def clean_response_content(response_content: str) -> str:
    """
    Removes markdown code block markers (e.g. ```json ... ```)
    from the response content if present.
    """
    content = response_content.strip()
    if content.startswith("```"):
        lines = content.splitlines()
        # Remove the first and last lines if they are code block markers.
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        content = "\n".join(lines).strip()
    return content


# Run the app with uvicorn
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
