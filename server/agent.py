import json
from utils import (
    load_logs,
    get_log_level_counts,
    compute_stats,
    get_simple_stats,
    clean_response_content,
)
from model_client import ModelClient
from typing import Any


class ChatAgent:
    def __init__(self, model: ModelClient, base_prompt: str):
        self.model = model
        self.base_prompt = base_prompt
        self.stats = None

    async def decide_summary(self, message: str) -> tuple[bool, str]:
        logs = load_logs()
        level_counts = get_log_level_counts(logs)
        self.stats = compute_stats(level_counts)
        stats_str = json.dumps(self.stats, default=str, indent=2)

        prompt = f"""{self.base_prompt}
Log Statistics:
{stats_str}

User Query: {message}

Should a summary be generated?
- If generating a summary is not relevant or the query is specific (e.g. "filter for debug logs"), respond with: no: <brief explanation>.
- If additional context is needed and a summary would be helpful, respond with: yes: <brief explanation>

Respond with exactly one line in the following format:
yes: [brief explanation]
or
no: [brief explanation]

Do not include any extra text.
"""
        response = await self.model.chat_completion(prompt)
        print("Response:", response)
        if response:
            try:
                cleaned = response.strip()
                if ":" in cleaned:
                    decision_part, explanation = cleaned.split(":", 1)
                    return decision_part.strip().lower() == "yes", explanation.strip()
                else:
                    return False, cleaned
            except Exception as e:
                print("Error decoding decision:", e)
        return False, ""

    async def generate_summary(self, message: str) -> tuple[str, dict]:
        logs = load_logs()
        if self.stats is None:
            level_counts = get_log_level_counts(logs)
            self.stats = compute_stats(level_counts)
        stats_str = json.dumps(self.stats, default=str, indent=2)

        prompt = f"""{self.base_prompt}
Log Statistics:
{stats_str}

User Query: {message}

Generate a summary of the log statistics. Respond with just the explanation:"""
        summary = await self.model.chat_completion(prompt)
        return summary, get_simple_stats(logs)

    async def evaluate_decision(self, message: str) -> tuple[bool, str]:
        prompt = f"""{self.base_prompt}
User Query: {message}

Should I look for known issues in the logs?
- If the user query is specific (e.g. "generate me a summary", "filter for debug logs") and does not mention problems or issues, then respond with: no: [brief explanation].
- Only respond with yes if the query is asking for detecting issues or problems in the logs.
Respond in exactly one line in the following format (without any markdown or extra text):
yes: [brief explanation]
or
no: [brief explanation]
"""
        response = await self.model.chat_completion(prompt)
        if response:
            try:
                # Clean the response (e.g. remove any stray formatting) and split by colon.
                cleaned = response.strip()
                if ":" in cleaned:
                    decision_part, explanation = cleaned.split(":", 1)
                    decision = decision_part.strip().lower() == "yes"
                    return decision, explanation.strip()
                else:
                    # If no colon is found, assume a default 'no' and return the whole text as explanation.
                    return False, cleaned
            except Exception as e:
                print("Error decoding decision:", e)
        return False, ""

    async def evaluate_issue(
        self, issue: str, details: str | dict, message: str, similar_logs: list[dict[str, Any]]
    ) -> str:
        prompt = f"""{self.base_prompt}
Known Issue: "{issue}"
Issue Details:
{json.dumps(details, indent=2)}

Similar Logs (note that these are done through a simple semantic search, and is very prone to not being relevant):
{json.dumps(similar_logs, indent=2)}

User Query: {message}

Based on the above, should this issue be flagged?
If yes, respond in the following format:
**Issue Summary**:
<ISSUE SUMMARY>
**Resolution**:
<RESOLUTION>
Else, respond with an empty string.
Note: if the details json does not have a logs field or the logs field is empty, respond with an empty string.
"""
        print("Prompt:", prompt)
        return await self.model.chat_completion(prompt)

        # New method to decide if a filter should be added.

    async def decide_filter(self, message: str) -> tuple[bool, str]:
        prompt = f"""{self.base_prompt}
User Query: {message}

Should I add a filter to refine the log output?
- If the query implies filtering (e.g. "show only errors", "filter out debug logs") or mentions keywords/regex, respond with: yes: [brief explanation].
- Otherwise, respond with: no: [brief explanation].
Respond in exactly one line in the following format:
yes: [brief explanation]
or
no: [brief explanation]
Do not include any extra text.
"""
        response = await self.model.chat_completion(prompt)
        if response:
            try:
                cleaned = response.strip()
                if ":" in cleaned:
                    decision_part, explanation = cleaned.split(":", 1)
                    decision = decision_part.strip().lower() == "yes"
                    return decision, explanation.strip()
                else:
                    return False, cleaned
            except Exception as e:
                print("Error decoding filter decision:", e)
        return False, ""

    # New method to generate a filter group.
    async def generate_filter_group(self, message: str) -> dict:
        prompt = f"""{self.base_prompt}
User Query: {message}

Generate a filter group in JSON format with the following structure:
{{
  "title": string,
  "description": string,
  "filters": [
    {{
      "text": string,
      "regex": boolean,
      "caseSensitive": boolean,
      "color": string,
      "description": string
    }}
    // You may include additional filters if needed.
  ]
}}

Make sure to follow these guidelines:
- The title should be a short, descriptive name for the filter group.
- The description should be a brief explanation of the filter group.
- Each filter should have a text field with the keyword or regex pattern to match.
- The regex field should be true if the text is a regex pattern, false otherwise.
- The caseSensitive field should be true if the filter should be case-sensitive, false otherwise.
    - In most cases, it should be false to match case-insensitively.
- The color field should be a hex color code.
    - Keep in mind it will be in a light gray background on black text, so choose a highlight color that is appropriate.
    - Mostly go for a light color that is easy on the eyes.
- The description field should be a brief explanation of the filter, like a comment.

The filter group should capture the intent of the user's request in terms of log filtering. Do not include any extra text.
"""
        response = await self.model.chat_completion(prompt)
        cleaned = clean_response_content(response.strip()) if response else ""
        try:
            filter_group = json.loads(cleaned)
            return filter_group
        except Exception as e:
            print("Error decoding filter group:", e)
            return {}
