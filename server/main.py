from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from elasticsearch import Elasticsearch
from pydantic import BaseModel
from typing import List 

# Initialize the FastAPI app
app = FastAPI()

# Allow CORS so that the frontend can communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/upload/{id}")
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
            size=1000  # Fetch 1000 documents per batch
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


from elasticsearch import Elasticsearch


from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk

def pushToElasticSearch(logs, idx):
    es = Elasticsearch([{"host": "localhost", "port": 9200, "scheme": "http"}], verify_certs=False)

    if not es.ping():
        raise Exception("Could not connect to Elasticsearch")

    index_name = str(idx)

    if es.indices.exists(index=index_name):
        print(f"Index '{index_name}' exists. Replacing records instead of deleting.")

        query = {"query": {"match_all": {}}}
        es.delete_by_query(index=index_name, body=query, wait_for_completion=True)
    else:
        es.indices.create(index=index_name, ignore=400)

    # Use bulk indexing for better performance
    actions = [
        {
            "_index": index_name,
            "_id": i,  
            "_source": log
        }
        for i, log in enumerate(logs)
    ]

    bulk(es, actions)

    return {"message": "Logs successfully uploaded and indexed.", "total_logs": len(logs)}


@app.post("/upload/{id}")
async def uploadFile(id:str, request: Request):
    try:
        log_data = await request.json()

        # print(f"Received data type: {type(log_data)}")
        # print(f"log id: {id}") 
        if not isinstance(log_data, list):
            raise HTTPException(status_code=400, detail="Expected a JSON array")
            
        response = pushToElasticSearch(log_data, id)
        return response
    except Exception as e:
        print(f"Error processing request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Run the app with uvicorn
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)