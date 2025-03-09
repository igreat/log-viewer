import os
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import Any
from pydantic import BaseModel
from dotenv import load_dotenv
from model_client import ModelClient, OpenAIModelClient, OfflineModelClient
from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk
from fastapi.responses import StreamingResponse
from agent import ChatAgent
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
    "gpt-4o": OpenAIModelClient(os.getenv("OPENAI_API_KEY") or "", "gpt-4o-mini"),
    # "granite-3.2-2b": OfflineModelClient(
    #     "models/granite/granite-3.2-2b-instruct-Q6_K.gguf",
    #     context_window=3072,
    # ),
    # "llama-3.2-3b": OfflineModelClient(
    #     "models/llama/Llama-3.2-3B-Instruct-Q6_K.gguf",
    #     context_window=3072,
    # ),
    # "granite-3.2-8b": OfflineModelClient(
    #     "models/granite/granite-3.2-8b-instruct-Q3_K_L.gguf",
    #     context_window=2048,
    # ),
}


# Define the request and response models
class ChatRequest(BaseModel):
    message: str
    known_issues: dict[str, Any] | None = None


class Action(BaseModel):
    type: str
    body: dict[str, Any]


# Create an instance of your ChatAgent with the chosen model and base prompt
base_prompt = (
    "You are a helpful assistant integrated with a log viewer tool for Cisco engineers. "
    "Your role is to help analyze and filter large log files quickly. "
    "Do not include any additional text."
)
# chat_agent = ChatAgent(models["granite-3.2-2b"], base_prompt)
chat_agent = ChatAgent(models["gpt-4o"], base_prompt)
# chat_agent = ChatAgent(models["llama-3.2-3b"], base_prompt)
# chat_agent = ChatAgent(models["granite-3.2-8b"], base_prompt)


@app.post("/chat_stream")
async def chat_stream(request: ChatRequest):
    if not request.message:
        raise HTTPException(status_code=400, detail="Message is required")

    async def event_generator():
        # Step 1: Decide on summary generation.
        print(f"Message: {request.message}")
        generate_summary, explanation = await chat_agent.decide_summary(request.message)
        print(f"Generate Summary: {generate_summary}, Explanation: {explanation}")
        action = Action(
            type="summary_decision",
            body={"generate_summary": generate_summary, "explanation": explanation},
        )
        # SSE requires events to be prefixed with "data: " and double newline-delimited.
        yield f"data: {action.json()}\n\n"

        # Step 2: If summary is needed, generate it.
        if generate_summary:
            summary_text, stats = await chat_agent.generate_summary(request.message)
            action = Action(
                type="generate_summary",
                body={"summary": summary_text, "stats": stats},
            )
            yield f"data: {action.json()}\n\n"
            print(f"Summary: {summary_text}")

        # Step 3: Decide on known issue evaluation.
        evaluate_issues, explanation = await chat_agent.evaluate_decision(
            request.message
        )
        action = Action(
            type="issue_decision",
            body={"evaluate_issues": evaluate_issues, "explanation": explanation},
        )
        yield f"data: {action.json()}\n\n"
        print(f"Evaluate Issues: {evaluate_issues}, Explanation: {explanation}")

        # Step 4: Evaluate each known issue.
        if evaluate_issues:
            known_issues = request.known_issues if request.known_issues else {}
            issue_context: dict[str, Any] = {}
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
                    action = Action(
                        type="flag_issue",
                        body={"issue": issue, "summary": issue_text},
                    )
                    yield f"data: {action.model_dump_json()}\n\n"

        # Yield a final event to indicate that streaming is complete.
        yield "data: [DONE]\n\n"

    # Return a StreamingResponse with SSE media type.
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/table/{id}")
def get_from_elasticsearch(id: str):
    try:
        es = Elasticsearch("http://localhost:9200", verify_certs=False)
        if not es.ping():
            raise Exception("Could not connect to Elasticsearch")

        # Initialize the scroll request
        resp = es.search(
            index=str(id),
            body={"query": {"match_all": {}}},
            scroll="2m",  # Keep the search context alive for 2 minutes
            size=1000,  # Fetch 1000 documents per batch
        )

        # Extract the initial results
        scroll_id = resp.get("_scroll_id")
        hits = resp["hits"]["hits"]
        logs = [hit["_source"] for hit in hits]

        # Continue fetching until there are no more results
        while hits:
            resp = es.scroll(scroll_id=scroll_id, scroll="2m")
            scroll_id = resp.get("_scroll_id")
            hits = resp["hits"]["hits"]

            if hits:
                logs.extend(hit["_source"] for hit in hits)

        # Cleanup: Clear scroll context to free up memory
        es.clear_scroll(scroll_id=scroll_id)

        return logs  # Return all retrieved logs

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def push_to_elastic_search(logs, idx):
    es = Elasticsearch(
        [{"host": "localhost", "port": 9200, "scheme": "http"}], verify_certs=False
    )

    if not es.ping():
        raise Exception("Could not connect to Elasticsearch")

    index_name = str(idx)

    if es.indices.exists(index=index_name):
        print(f"Index '{index_name}' exists. Replacing records instead of deleting.")

        query = {"query": {"match_all": {}}}
        es.delete_by_query(index=index_name, body=query, wait_for_completion=True)
    else:
        es.indices.create(index=index_name)

    # Use bulk indexing for better performance
    actions = [
        {"_index": index_name, "_id": i, "_source": log} for i, log in enumerate(logs)
    ]

    bulk(es, actions)

    return {
        "message": "Logs successfully uploaded and indexed.",
        "total_logs": len(logs),
    }


@app.post("/table/{id}")
async def upload_file(id: str, request: Request):
    try:
        log_data = await request.json()

        # print(f"Received data type: {type(log_data)}")
        # print(f"log id: {id}")
        if not isinstance(log_data, list):
            raise HTTPException(status_code=400, detail="Expected a JSON array")

        response = push_to_elastic_search(log_data, id)
        return response
    except Exception as e:
        print(f"Error processing request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/table/{id}")
async def delete_file(id: str):
    es = Elasticsearch(
        [{"host": "localhost", "port": 9200, "scheme": "http"}], verify_certs=False
    )
    try:
        if es.indices.exists(index=id):
            es.indices.delete(index=id)
            return {"status": "success", "message": "log table deleted successfully"}
        else:
            return {"status": "error", "message": f"log file with id: {id} not found"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/table")
def list_log_indices():
    try:
        es = Elasticsearch("http://localhost:9200", verify_certs=False)
        if not es.ping():
            raise Exception("Could not connect to Elasticsearch")

        # Get all indices; this returns a dict of index names as keys.
        all_indices = es.indices.get_alias(index="*")

        # Filter out system indices (those starting with a dot) or any indices that shouldn't be treated as logs.
        log_ids = [index for index in all_indices.keys() if not index.startswith(".")]

        return log_ids
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Run the app with uvicorn
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
