import json
from utils import (
    get_log_level_counts,
    compute_stats,
    get_simple_stats,
    clean_response_content,
)
from model_client.model_client import ModelClient
from typing import Any


class ChatAgent:
    """
    A chat agent that uses a ModelClient to process log-related queries,
    generate summaries, evaluate decisions, and create filter groups based on logs.

    Attributes:
        model (ModelClient): The model client used for chat completions.
        base_prompt (str): The base prompt string used as a template for generating prompts.
        stats (Any): Statistics computed from log levels.
    """

    def __init__(self, model: ModelClient, base_prompt: str):
        """
        Initialize the ChatAgent with a model and a base prompt.

        Args:
            model (ModelClient): An instance of ModelClient to handle chat completions.
            base_prompt (str): The base prompt to be prepended to every generated prompt.
        """

        self.model = model
        self.base_prompt = base_prompt
        self.stats = None

    async def decide_summary(
        self, message: str, logs: list[dict[str, Any]]
    ) -> tuple[bool, str]:
        """
        Decide whether a summary should be generated for the given user message and logs.

        The method computes log level statistics, incorporates them into a prompt,
        and asks the model to decide if a summary is needed. The response must be in a specific
        one-line format ("yes: explanation" or "no: explanation").

        Args:
            message (str): The user query message.
            logs (list[dict[str, Any]]): A list of log entries.

        Returns:
            tuple[bool, str]: A tuple where the first element indicates if a summary should be generated
                              (True for yes, False for no), and the second element contains the brief explanation.
        """

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

    async def generate_summary(
        self, message: str, logs: list[dict[str, Any]]
    ) -> tuple[str, dict]:
        """
        Generate a summary of the log statistics based on the user query.

        If the statistics haven't been computed yet, they are computed from the provided logs.
        A prompt is built with the log statistics and the user query, and the model is asked to provide
        a summary. Additionally, simple log statistics are returned.

        Args:
            message (str): The user query.
            logs (list[dict[str, Any]]): A list of log entries.

        Returns:
            tuple[str, dict]: A tuple where the first element is the generated summary as a string,
            and the second element is a dictionary containing simple log statistics.
        """

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
        """
        Evaluate whether known issues should be looked for in the logs based on the user query.

        Constructs a prompt with the user query and instructions on when to detect issues, and expects
        a one-line response in the format "yes: <brief explanation>" or "no: <brief explanation>".

        Args:
            message (str): The user query.

        Returns:
            tuple[bool, str]: A tuple where the first element is a boolean indicating if known issues should be
            searched for, and the second element is a brief explanation provided by the model.
        """

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
        self,
        issue: str,
        details: str | dict,
        message: str,
        similar_logs: list[dict[str, Any]],
    ) -> str:
        """
        Evaluate a known issue against the logs and user query to decide if it should be flagged.

        Constructs a prompt that includes the issue, its details, a set of similar logs, and the user query.
        The model should respond with either a detailed issue summary and resolution in the specified format,
        or an empty string if the issue should not be flagged. Note that if the details JSON does not have a
        'logs' field or it is empty, an empty string should be returned.

        Args:
            issue (str): The title or identifier of the known issue.
            details (str | dict): Details about the issue, can be a JSON string or a dictionary.
            message (str): The user query.
            similar_logs (list[dict[str, Any]]): A list of log entries that are similar to the issue.

        Returns:
            str: A formatted string with the issue summary and resolution if flagged, or an empty string otherwise.
        """

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

    async def decide_filter(
        self, message: str, detected_issues: dict[str, Any]
    ) -> tuple[bool, str]:
        """
        Decide whether a filter should be added to refine the log output based on the user query and detected issues.

        The prompt instructs the model to analyze the user query and the detected issues (with their keywords),
        and decide if a filter is appropriate. The expected response is a single line in the format:
        "yes: <brief explanation>" or "no: <brief explanation>".

        Args:
            message (str): The user query.
            detected_issues (dict[str, Any]): A dictionary of detected issues along with associated keywords.

        Returns:
            tuple[bool, str]: A tuple where the first element indicates if a filter should be added,
            and the second element is the explanation provided by the model.
        """

        prompt = f"""{self.base_prompt}
User Query: {message}

Issues Detected (with their keywords):
{json.dumps(detected_issues, indent=2)}

Should I add a filter to refine the log output?
- If the query implies filtering (e.g. "show only errors", "filter out debug logs") or mentions keywords/regex, respond with: yes: [brief explanation].
- Also, if there are detected issues, there is likely keywords there that can be used for filtering.
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
    async def generate_filter_group(
        self, message: str, detected_issues: dict[str, Any]
    ) -> dict:
        """
        Generate a filter group in JSON format based on the user query and detected issues.

        Constructs a prompt that includes the user query and a JSON representation of detected issues with their keywords.
        The prompt instructs the model to generate a filter group following a specific JSON structure, which includes a title,
        description, and a list of filters. The response is then cleaned and parsed into a dictionary.

        Args:
            message (str): The user query.
            detected_issues (dict[str, Any]): A dictionary of detected issues along with associated keywords.

        Returns:
            dict: A dictionary representing the filter group in the following structure:
                {
                  "title": string,
                  "description": string,
                  "filters": [
                    {
                      "text": string,
                      "regex": boolean,
                      "caseSensitive": boolean,
                      "color": string,
                      "description": string
                    }
                    // Additional filters may be included.
                  ]
                }
            Returns an empty dictionary if the filter group could not be decoded.
        """

        prompt = f"""{self.base_prompt}
User Query: {message}

Issues Detected (with their keywords):
{json.dumps(detected_issues, indent=2)}

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
    - Make sure colors are varied enough to distinguish between different filters.
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
