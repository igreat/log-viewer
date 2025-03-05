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

@app.get("/upload")
def getFromElasticSearch():
    try:
        es = Elasticsearch("http://localhost:9200", verify_certs=False)
        if not es.ping():
            raise Exception("Could not connect to Elasticsearch")
        
        # Basic search to retrieve all documents
        result = es.search(
            index="myindex",
            body={
                "query": {
                    "match_all": {}
                }
            },
            size=100  # Limit to 100 results, adjust as needed
        )
        
        # Extract the documents
        hits = result["hits"]["hits"]
        logs = [hit["_source"] for hit in hits]
        
        return {
            "message": f"Retrieved {len(logs)} logs successfully",
            "logs": logs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def pushToElasticSearch(logs):
    es = Elasticsearch("http://localhost:9200", verify_certs=False)
    if not es.ping():
        raise Exception("Could not connect to Elasticsearch")
    for log in logs:
        es.index(index='myindex', document=log)  # Index each log as a separate document

    return {"message": "Logs successfully uploaded and indexed.", "total_logs": len(logs)}


@app.post("/upload")
async def uploadFile(request: Request):
    try:
        log_data = await request.json()
        
        print(f"Received data type: {type(log_data)}")
        
        if not isinstance(log_data, list):
            raise HTTPException(status_code=400, detail="Expected a JSON array")
            
        response = pushToElasticSearch(log_data)
        return response
    except Exception as e:
        print(f"Error processing request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Run the app with uvicorn
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)