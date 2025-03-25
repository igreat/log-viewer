import os
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import Any
from pydantic import BaseModel
from dotenv import load_dotenv
from model_client import ModelClient, OpenAIModelClient, OfflineModelClient
from sentence_transformers import SentenceTransformer
from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk
from fastapi.responses import StreamingResponse
from agent import ChatAgent
from utils import extract_top_rows
import torch

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


# Determine the device to use for models
device = (
    "cuda"
    if torch.cuda.is_available()
    else "mps"
    if torch.backends.mps.is_available()
    else "cpu"
)

# Initialize models and client
models: dict[str, ModelClient] = {
    "gpt-4o": OpenAIModelClient(os.getenv("OPENAI_API_KEY") or "", "gpt-4o"),
    "granite-3.2-2b": OfflineModelClient(
        "models/granite/granite-3.2-2b-instruct-Q6_K.gguf",
        context_window=3072,
    ),
    # "llama-3.2-3b": OfflineModelClient(
    #     "models/llama/Llama-3.2-3B-Instruct-Q6_K.gguf",
    #     context_window=3072,
    # ),
    # "granite-3.2-8b": OfflineModelClient(
    #     "models/granite/granite-3.2-8b-instruct-Q3_K_L.gguf",
    #     context_window=2048,
    # ),
}

emb_model = SentenceTransformer(
    "sentence-transformers/msmarco-MiniLM-L12-cos-v5",
    device=device,
)


# Define the request and response models
class ChatRequest(BaseModel):
    message: str
    known_issues: dict[str, Any] | None = None
    model: str = "gpt-4o"
    logs: list[dict[str, Any]] | None = None
    log_id: str | None = None


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
# chat_agent = ChatAgent(models["gpt-4o"], base_prompt)
# chat_agent = ChatAgent(models["llama-3.2-3b"], base_prompt)
# chat_agent = ChatAgent(models["granite-3.2-8b"], base_prompt)


# -------------------------------------
# Elasticsearch Similarity Search Setup
# -------------------------------------
def create_similarity_index(
    es: Elasticsearch, index_name: str, title: str, description: str
):
    """
    Creates an Elasticsearch index with a mapping for similarity search.
    """
    mapping = {
        "mappings": {
            "_meta": {"title": title, "description": description},
            "properties": {
                "message": {"type": "text"},
                "embedding": {
                    "type": "dense_vector",
                    "dims": 384,
                    "index": True,
                    "similarity": "cosine",
                },
            },
        }
    }
    if not es.indices.exists(index=index_name):
        es.indices.create(index=index_name, body=mapping)
    else:
        print(f"Index '{index_name}' already exists.")


def retrieve_logs_from_elasticsearch(index: str) -> list[dict]:
    """
    Retrieve logs from Elasticsearch for the given index.
    This function returns the logs with the "embedding" field removed.
    """
    es = Elasticsearch("http://localhost:9200", verify_certs=False)
    if not es.ping():
        raise Exception("Could not connect to Elasticsearch")

    resp = es.search(
        index=index,
        body={"query": {"match_all": {}}},
        scroll="2m",
        size=1000,
    )
    scroll_id = resp.get("_scroll_id")
    hits = resp["hits"]["hits"]
    logs = [hit["_source"] for hit in hits]

    while hits:
        resp = es.scroll(scroll_id=scroll_id, scroll="2m")
        scroll_id = resp.get("_scroll_id")
        hits = resp["hits"]["hits"]
        if hits:
            logs.extend(hit["_source"] for hit in hits)

    es.clear_scroll(scroll_id=scroll_id)

    return logs


def push_to_elastic_search(logs: list[dict], idx: str, title: str, description: str):
    es = Elasticsearch(
        [{"host": "localhost", "port": 9200, "scheme": "http"}], verify_certs=False
    )
    if not es.ping():
        raise Exception("Could not connect to Elasticsearch")

    if not es.indices.exists(index=idx):
        create_similarity_index(es, idx, title, description)
    else:
        print(f"Index '{idx}' exists. Clearing existing records.")
        es.delete_by_query(
            index=idx,
            body={"query": {"match_all": {}}},
            wait_for_completion=True,
        )

    actions = [{"_index": idx, "_id": i, "_source": log} for i, log in enumerate(logs)]
    bulk(es, actions, raise_on_error=True)

    # Force a refresh so the newly indexed documents become searchable immediately.
    es.indices.refresh(index=idx)

    return {"message": "Logs successfully uploaded.", "total_logs": len(logs)}


def update_embeddings_for_logs(idx: str):
    es = Elasticsearch(
        [{"host": "localhost", "port": 9200, "scheme": "http"}], verify_certs=False
    )
    if not es.ping():
        raise Exception("Could not connect to Elasticsearch")

    logs = retrieve_logs_from_elasticsearch(idx)

    # Collect texts from the "messages" field that need embeddings.
    texts_to_embed = [log["messages"] for log in logs]
    if texts_to_embed:
        computed_embeddings = compute_embeddings(texts_to_embed)
        print(f"Computed {len(computed_embeddings)} embeddings.")
        if len(computed_embeddings) != len(texts_to_embed):
            raise Exception(
                "Mismatch: Number of computed embeddings does not equal the number of texts."
            )

        for i, log in enumerate(logs):
            log["embedding"] = computed_embeddings[i]

        actions = [
            {"_index": idx, "_id": i, "_source": log} for i, log in enumerate(logs)
        ]
        bulk(es, actions, raise_on_error=False)
        print("Embeddings updated for all logs.")
    else:
        print("No logs found that need embeddings.")


@app.get("/table/{id}")
def get_from_elasticsearch(id: str):
    try:
        logs = retrieve_logs_from_elasticsearch(str(id))
        # Remove the "embedding" field from each log
        for log in logs:
            log.pop("embedding", None)

        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/table/{id}")
async def upload_file(id: str, request: Request, background_tasks: BackgroundTasks):
    try:
        data = await request.json()
        const_logs = data.get("logs")
        if not const_logs or not isinstance(const_logs, list):
            raise HTTPException(
                status_code=400, detail="Expected 'logs' to be a JSON array"
            )

        title = data.get("title", str(id))
        description = data.get("description", "")

        # Push logs without waiting for embedding computation.
        response = push_to_elastic_search(const_logs, id, title, description)
        # update_embeddings_for_logs(id)

        # Schedule background embedding computation and update.
        background_tasks.add_task(update_embeddings_for_logs, id)

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
        es = Elasticsearch(
            [{"host": "localhost", "port": 9200, "scheme": "http"}], verify_certs=False
        )
        if not es.ping():
            raise Exception("Could not connect to Elasticsearch")

        # Get all indices (aliases) as a dict.
        all_indices = es.indices.get_alias(index="*")
        log_files = []
        for index in all_indices.keys():
            if index.startswith("."):
                continue
            mapping = es.indices.get_mapping(index=index)
            meta = mapping[index]["mappings"].get("_meta", {})
            title = meta.get("title", "TITLE")
            description = meta.get("description", "DESCRIPTION")
            log_files.append({"id": index, "title": title, "description": description})
        return log_files
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def compute_embeddings(input_data: list[str]) -> list[list[float]]:
    texts = [text[0] for text in input_data]
    embeddings = emb_model.encode(
        texts, batch_size=64, convert_to_tensor=True, show_progress_bar=False
    )
    return [embedding.tolist() for embedding in embeddings]


def search_similar(q: str, index: str, k: int = 10) -> list[dict[str, Any]]:
    """
    Compute the embedding for the query text and perform a similarity search using Elasticsearch,
    returning only the log documents.
    """
    es = Elasticsearch(
        [{"host": "localhost", "port": 9200, "scheme": "http"}], verify_certs=False
    )
    if not es.ping():
        raise Exception("Could not connect to Elasticsearch")

    # Compute the query embedding using the optimized compute_embeddings function.
    # compute_embeddings expects a list of texts, so we wrap q in a list.
    query_embedding = compute_embeddings([q])[0]

    # Use Elasticsearch's knn query
    response = es.search(
        index=index,
        knn={
            "field": "embedding",
            "query_vector": query_embedding,
            "num_candidates": 50,
            "k": k,
        },
        size=k,
    )
    hits = response.get("hits", {}).get("hits", [])
    logs = [hit["_source"] for hit in hits]
    for log in logs:
        log.pop("embedding", None)
    return logs


@app.post("/chat_stream")
async def chat_stream(request: ChatRequest):
    if not request.message:
        raise HTTPException(status_code=400, detail="Message is required")

    chat_agent = ChatAgent(models[request.model], base_prompt)
    if request.logs and request.log_id:
        logs = request.logs
        log_id = request.log_id
    else:
        raise HTTPException(status_code=400, detail="Logs are required")

    async def event_generator():
        # Step 1: Decide on summary generation.
        print(f"Message: {request.message}")
        generate_summary, explanation = await chat_agent.decide_summary(request.message, logs)
        print(f"Generate Summary: {generate_summary}, Explanation: {explanation}")
        action = Action(
            type="summary_decision",
            body={"generate_summary": generate_summary, "explanation": explanation},
        )
        # SSE requires events to be prefixed with "data: " and double newline-delimited.
        yield f"data: {action.model_dump_json()}\n\n"

        # Step 2: If summary is needed, generate it.
        if generate_summary:
            summary_text, stats = await chat_agent.generate_summary(request.message, logs)
            action = Action(
                type="generate_summary",
                body={"summary": summary_text, "stats": stats},
            )
            yield f"data: {action.model_dump_json()}\n\n"
            print(f"Summary: {summary_text}")

        # Step 3: Decide on known issue evaluation.
        evaluate_issues, explanation = await chat_agent.evaluate_decision(
            request.message
        )
        action = Action(
            type="issue_decision",
            body={"evaluate_issues": evaluate_issues, "explanation": explanation},
        )
        yield f"data: {action.model_dump_json()}\n\n"
        print(f"Evaluate Issues: {evaluate_issues}, Explanation: {explanation}")

        # Step 4: Evaluate each known issue.
        detected_issues = {}  # to be used for generating a filter group
        if evaluate_issues:
            known_issues = request.known_issues if request.known_issues else {}
            issue_context: dict[str, Any] = {}
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
            print("Issue Context:", issue_context)

            similar_logs = search_similar(request.message, log_id, k=5)

            for issue, details in issue_context.items():
                issue_text = await chat_agent.evaluate_issue(
                    issue, details, request.message, similar_logs
                )
                if issue_text.strip():
                    action = Action(
                        type="flag_issue",
                        body={"issue": issue, "summary": issue_text},
                    )
                    detected_issues[issue] = details
                    yield f"data: {action.model_dump_json()}\n\n"

        # Step 5: Decide if a filter should be added.
        should_add_filter, filter_explanation = await chat_agent.decide_filter(
            request.message, detected_issues
        )
        action = Action(
            type="filter_decision",
            body={
                "should_add_filter": should_add_filter,
                "explanation": filter_explanation,
            },
        )
        yield f"data: {action.model_dump_json()}\n\n"
        print(
            f"Filter Decision: {should_add_filter}, Explanation: {filter_explanation}"
        )

        # Step 6: If filter is needed, generate a filter group.
        if should_add_filter:
            filter_group = await chat_agent.generate_filter_group(
                request.message, detected_issues
            )
            print("Filter Group:", filter_group)
            action = Action(
                type="add_filter",
                body={"filter_group": filter_group},
            )
            yield f"data: {action.model_dump_json()}\n\n"

        # Yield a final event to indicate that streaming is complete.
        yield "data: [DONE]\n\n"

    # Return a StreamingResponse with SSE media type.
    return StreamingResponse(event_generator(), media_type="text/event-stream")


# Run the app with uvicorn
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
