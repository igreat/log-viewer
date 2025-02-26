import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
from typing import Optional, Any
import json
from datetime import datetime, timedelta
from collections import defaultdict

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
    type: str  # e.g. "add_filter"
    body: dict[str, Any]  # e.g. { "filter_text": "ERROR" }


class ChatResponse(BaseModel):
    reply: Optional[str] = None
    actions: Optional[list[Action]] = None


# TODO: for now will just load from local file, later will load same data from database
def load_logs():
    with open("data/all-logs.json") as f:
        return json.load(f)


def get_log_level_counts(logs, interval=timedelta(seconds=1)):
    summary = defaultdict(lambda: {"Debug": 0, "Info": 0, "Warn": 0, "Error": 0})
    if not logs:
        return summary
    # Convert the first log's timestamp to a datetime object.
    start_time = datetime.fromisoformat(logs[0]["timestamp"].replace("Z", "+00:00"))
    for log in logs:
        # Convert each log's timestamp to a datetime object.
        log_time = datetime.fromisoformat(log["timestamp"].replace("Z", "+00:00"))
        bucket = start_time + ((log_time - start_time) // interval) * interval
        summary[bucket][log["level"]] += 1
    return summary


def compute_stats(level_counts):
    stats = {
        "max_per_level": {},  # For each level, the bucket with the maximum count.
        "max_total": {"bucket": None, "count": 0},  # Bucket with highest total logs.
        "overall_total": 0,  # Total logs across all buckets.
        "count_intervals": len(level_counts),  # Number of buckets.
        "overall_average": 0,  # Average logs per interval.
    }

    total_logs = 0
    # Initialize max_per_level for each log level.
    for level in ["Debug", "Info", "Warn", "Error"]:
        stats["max_per_level"][level] = {"bucket": None, "count": 0}

    for bucket, counts in level_counts.items():
        interval_total = sum(counts.values())
        total_logs += interval_total

        # Update maximum for each level.
        for level, count in counts.items():
            if count > stats["max_per_level"][level]["count"]:
                stats["max_per_level"][level] = {"bucket": bucket, "count": count}

        # Update overall maximum total.
        if interval_total > stats["max_total"]["count"]:
            stats["max_total"] = {"bucket": bucket, "count": interval_total}

    stats["overall_total"] = total_logs
    if stats["count_intervals"] > 0:
        stats["overall_average"] = total_logs / stats["count_intervals"]
    return stats


def extract_top_rows(logs, keywords, top_n=5):
    """
    For each keyword in the provided keywords dictionary,
    return up to top_n log entries that contain that keyword.
    """
    extracted = {}
    for category, kw_list in keywords.items():
        extracted[category] = []
        for kw in kw_list:
            count = 0
            for log in logs:
                if (
                    log["messages"]
                    and any(kw in msg for msg in log["messages"])
                    and log["level"] in ["Error", "Warn"]
                ):
                    extracted[category].append(log)
                    count += 1
                    if count >= top_n:
                        break
    print("extracted", extracted)
    return extracted


known_issues = {
    "Missing Media Track Error": {
        "description": "A media track could not be retrieved by the Media Track Manager, resulting in a 'No Track!' error. This may indicate a failure in creating or negotiating the required media track for a video call.",
        "context": "This error is logged when the system attempts to retrieve a video track (vid=1) during a media session and finds that no track exists. This might be due to signaling failures, media engine initialization issues, or network problems that prevented proper track creation.",
        "keywords": {
            "media": ["CMediaTrackMgr::GetTrack", "No Track!"],
            "video": ["vid=1"],
            "session": ["MediaSession"],
        },
        "conditions": "This error typically occurs during call setup or renegotiation and may be accompanied by other signaling errors or warnings in the logs.",
        "resolution": "Investigate preceding log entries for errors in media negotiation or track creation. Ensure that the media engine is properly initialized and that network conditions support the required media streams. Verify configuration settings for media track management.",
    }
}


# TODO: part of the chat request should probably be the logs
@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    if not request.message:
        raise HTTPException(status_code=400, detail="Message is required")

    try:
        # Load logs and compute statistics
        logs = load_logs()
        level_counts = get_log_level_counts(logs)
        stats = compute_stats(level_counts)
        # Convert stats to a JSON-formatted string (ensure datetimes are converted to strings)
        stats_str = json.dumps(stats, default=str, indent=2)

        issue_context = {}
        for issue, details in known_issues.items():
            extracted_logs = extract_top_rows(logs, details["keywords"])
            print("extracted_logs", extracted_logs)
            issue_context[issue] = {
                "description": details["description"],
                "context": details["context"],
                "keywords": details["keywords"],
                "conditions": details["conditions"],
                "resolution": details["resolution"],
                "logs": extracted_logs,
            }

        issues_str = json.dumps(issue_context, default=str, indent=2)
        print("issues_str", issues_str)

        # Build the system prompt, injecting the computed stats as context.
        system_prompt = f"""
            You are a helpful assistant integrated with a log viewer tool for Cisco engineers. Your role is to help the user analyze and filter large log files quickly. When the user instructs you to modify filters or perform related actions, you must respond in a strict JSON format. Your JSON response must include:

            - A "reply" field containing a clear, natural language explanation of what you are doing.
            - Optionally, an "actions" array. Each action object must have:
                - a "type" field (for now, "add_filter", "generate_summary" or "flag_issue").
                - an "action_body" field (a JSON object with the necessary parameters).
            You may include multiple actions if needed. You decide, based on the provided context, if for example adding a summary is required or if you need to add a filter.

            Below are the current log summary statistics:
            {stats_str}

            These stats are based on intervals (buckets) of 1 second. You can use this information to provide more context in your responses.

            Known issues and their context:
            {issues_str}

            For example, if the user asks you to filter for debug logs so that they can see where most debug logs are coming from, you might respond with:

            {{
            "reply": "I have added a filter to show only debug logs.",
            "actions": [
                {{
                "type": "add_filter",
                "body": {{
                    "filter_groups": [
                    {{
                        "title": "Debug Logs",
                        "description": "Show only debug logs",
                        "filters": [
                        {{
                            "text": "DEBUG",
                            "regex": false,
                            "caseSensitive": false,
                            "color": "#FF0000",
                            "description": "Show only debug logs"
                        }}
                        ]
                    }}
                    ]
                }}
                }}
            ]
            }}

            Similarly, you might generate a summary if fitting (this is probably the most fitting for most requests):

            {{
                "reply": "I have generated a summary of the log statistics.",
                "actions": [
                    {{
                        "type": "generate_summary",
                        "body": {{
                            "summary_level": "basic",
                            "overview": "The logs show a high number of errors in the ...",
                        }}
                    }}
            }}

            Another example is flagging an issue, and always output this if there is evidence of a known issue:
            
            {{
                "reply": "The logs indicate that the hardware may not meet the minimum requirements for virtual background.",
                "actions": [
                    {{
                        "type": "flag_issue",
                        "body": {{
                            "issue_category": "Video Virtual Background (VBG)",
                            "summary_of_issue": "The logs indicate that the hardware may not meet the minimum requirements for virtual background (8 occurrences)."
                            "resolution": "Enable the appropriate feature toggles or upgrade hardware as per https://help.webex.com/en-us/article/80jduab/Use-virtual-backgrounds-in-Webex-Meetings-and-Webex-Webinars"
                        }}
                    }}
                ]
            }}

            if multiple issues are detected, you can output multiple "flag_issue" actions.

            This is just a very basic summary, you should respond with much more detailed description of the statistics and what they might mean. Do try to be succinct and clear in your responses.

            Always return valid JSON and include only these fields—do not output any additional text. Do not wrap your response in markdown code blocks.
        """

        # Call OpenAI's ChatCompletion API with the updated system prompt.
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.message},
            ],
        )
        print("response", response)
        raw_reply = response.choices[0].message.content
        print(raw_reply)
        if raw_reply is None:
            raise HTTPException(status_code=500, detail="Error processing your request")
        return ChatResponse.model_validate_json(raw_reply.strip())
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Error processing your request")


# Run the app with uvicorn
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
