import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Any
from pydantic import BaseModel
from dotenv import load_dotenv
from model_client import ModelClient, OpenAIModelClient, OfflineModelClient
from agent import ChatAgent  # Import the agent
from utils import extract_top_rows, load_logs

# Load environment variables
load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize models and client
models: dict[str, ModelClient] = {
    "gpt-4o": OpenAIModelClient(os.getenv("OPENAI_API_KEY") or "", "gpt-4o"),
    "granite3.2-2b": OfflineModelClient(
        "models/granite/granite-3.1-2b-instruct-Q6_K_L.gguf",
        context_window=3072,
    ),
}


# Define the request and response models
class ChatRequest(BaseModel):
    message: str
    known_issues: dict[str, Any] | None = None


class Action(BaseModel):
    type: str
    body: dict[str, Any]


class ChatResponse(BaseModel):
    reply: str | None = None
    actions: list[Action] | None = None


# Create an instance of your ChatAgent with the chosen model and base prompt
base_prompt = (
    "You are a helpful assistant integrated with a log viewer tool for Cisco engineers. "
    "Your role is to help analyze and filter large log files quickly. "
    "Do not include any additional text."
)
chat_agent = ChatAgent(models["granite3.2-2b"], base_prompt)


@app.post("/chat_stream", response_model=ChatResponse)
async def chat_stream(request: ChatRequest):
    if not request.message:
        raise HTTPException(status_code=400, detail="Message is required")

    tasks: list[Action] = []

    try:
        # Step 1: Decide on summary generation.
        print(f"Message: {request.message}")
        generate_summary, explanation = await chat_agent.decide_summary(request.message)
        print(f"Generate Summary: {generate_summary}")
        tasks.append(
            Action(
                type="summary_decision",
                body={"generate_summary": generate_summary, "explanation": explanation},
            )
        )

        # Step 2: If summary is needed, generate it.
        if generate_summary:
            summary_text = await chat_agent.generate_summary(request.message)
            tasks.append(
                Action(type="generate_summary", body={"summary": summary_text})
            )
            print(f"Summary: {summary_text}")

        # Step 3: Evaluate each known issue.
        # Build known issues context.
        known_issues = request.known_issues if request.known_issues else {}
        issue_context: dict[str, str | dict] = {}
        logs = load_logs()
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

        for issue, details in issue_context.items():
            issue_text = await chat_agent.evaluate_issue(
                issue, details, request.message
            )
            if issue_text.strip():
                tasks.append(
                    Action(
                        type="flag_issue",
                        body={"issue": issue, "summary": issue_text},
                    )
                )

        return ChatResponse(reply="", actions=tasks)
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Error processing your request")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
