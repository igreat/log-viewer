import json
from utils import load_logs, get_log_level_counts, compute_stats, clean_response_content
from model_client import ModelClient


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
- If generating a summary is not relevant, respond with: no: <brief explanation>
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
                cleaned = clean_response_content(response).strip()
                if ":" in cleaned:
                    decision_part, explanation = cleaned.split(":", 1)
                    return decision_part.strip().lower() == "yes", explanation.strip()
                else:
                    return False, cleaned
            except Exception as e:
                print("Error decoding decision:", e)
        return False, ""

    async def generate_summary(self, message: str) -> str:
        if self.stats is None:
            logs = load_logs()
            level_counts = get_log_level_counts(logs)
            self.stats = compute_stats(level_counts)
        stats_str = json.dumps(self.stats, default=str, indent=2)

        prompt = f"""{self.base_prompt}
Log Statistics:
{stats_str}

User Query: {message}

Generate a summary of the log statistics. Respond with just the explanation:"""
        return await self.model.chat_completion(prompt)

    async def evaluate_decision(self, message: str) -> tuple[bool, str]:
        prompt = f"""{self.base_prompt}
User Query: {message}

Should I look for known issues in the logs?
- If the user query is specific (e.g. "generate me a summary", "filter for debug logs") and does not mention problems or issues, then respond with: no: [brief explanation].
- Only respond with yes if the query is vague or indicates that issues might be present.
Respond in exactly one line in the following format (without any markdown or extra text):
yes: [brief explanation]
or
no: [brief explanation]
"""
        response = await self.model.chat_completion(prompt)
        if response:
            try:
                # Clean the response (e.g. remove any stray formatting) and split by colon.
                cleaned = clean_response_content(response).strip()
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
        self, issue: str, details: str | dict, message: str
    ) -> str:
        prompt = f"""{self.base_prompt}
Known Issue: "{issue}"
Issue Details:
{json.dumps(details, indent=2)}

User Query: {message}

Based on the above, should this issue be flagged?
If yes, respond in the following format:
Issue Summary:
<ISSUE SUMMARY>
Resolution:
<RESOLUTION>
Else, respond with an empty string."""
        return await self.model.chat_completion(prompt)
