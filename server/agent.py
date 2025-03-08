import json
from utils import load_logs, get_log_level_counts, compute_stats
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

Should a summary be generated? Answer in the following format:
yes / no
<REASONING>"""
        response = await self.model.chat_completion(prompt)
        if response:
            try:
                decision, explanation = response.strip().split("\n", 1)
                return decision.strip().lower() == "yes", explanation.strip()
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
