import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
from typing import Optional, Any

# Load the .env file
load_dotenv()

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

# Initialize the OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Define the request and response models
class ChatRequest(BaseModel):
    message: str

class Action(BaseModel):
    type: str            # e.g. "add_filter"
    body: dict[str, Any] # e.g. { "filter_text": "ERROR" }

class ChatResponse(BaseModel):
    reply: Optional[str] = None
    actions: Optional[list[Action]] = None

# Create a route to handle chat messages
@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    if not request.message:
        raise HTTPException(status_code=400, detail="Message is required")
    
    try:
        # Call OpenAI's ChatCompletion API (using gpt-3.5-turbo model)
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": """
                    You are a helpful assistant integrated with a log viewer tool for Cisco engineers. Your role is to help the user analyze and filter large log files quickly. When the user instructs you to modify filters or perform related actions, you must respond in a strict JSON format. Your JSON response must include:

                        A reply field containing a clear, natural language explanation of what you are doing.
                        Optionally, an action field if an operation is required (for example, "add_filter").
                        Optionally, an action_body object with the necessary parameters (for example, { "filter_text": "ERROR" }).

                    For example, if the user asks you to filter for debug logs so that they can see where most debug logs are coming from, you should respond with:

                    {
                        "reply": "I have added a filter to show only debug logs.",
                        "actions": [
                            {
                            "type": "add_filter",
                            "body": {
                                "filter_groups": [
                                {
                                    "title": "Debug Logs",
                                    "description": "Show only debug logs",
                                    "filters": [
                                    {
                                        "text": "DEBUG",
                                        "regex": false,
                                        "caseSensitive": false,
                                        "color": "#FF0000",
                                        "description": "Show only debug logs"
                                    }
                                    ]
                                }
                                ]
                            }
                            }
                        ]
                    }
                 
                    The actions and filter_groups can be a lot more complex than this, but this is a simple example. 

                    Always return valid JSON and include only these fields—do not output any additional text. Don't wrap the text in ```json ```
                """
                },
                {"role": "user", "content": request.message},
            ],
        )
        reply = response.choices[0].message.content.strip()
        print(reply) 
        return ChatResponse.model_validate_json(reply)
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Error processing your request")
    
# Run the app with uvicorn
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
