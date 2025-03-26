from collections import defaultdict
from datetime import datetime, timedelta
import json
from typing import Any


def load_logs() -> list[dict]:
    """
    Load logs from the 'data/all-logs.json' file.

    Used for testing purposes only.
    """
    with open("data/all-logs.json") as f:
        return json.load(f)


def get_log_level_counts(logs, interval=timedelta(seconds=1)):
    """
    Group log level counts into time intervals.

    Args:
        logs (list[dict]): List of log entries with 'timestamp' and 'level' fields.
        interval (timedelta, optional): Time bucket interval. Defaults to 1 second.

    Returns:
        defaultdict: Mapping of time buckets to dictionaries with log level counts.
    """

    summary = defaultdict(lambda: {"Debug": 0, "Info": 0, "Warn": 0, "Error": 0})
    if not logs:
        return summary
    start_time = datetime.fromisoformat(logs[0]["timestamp"].replace("Z", "+00:00"))
    for log in logs:
        log_time = datetime.fromisoformat(log["timestamp"].replace("Z", "+00:00"))
        bucket = start_time + ((log_time - start_time) // interval) * interval
        summary[bucket][log["level"]] += 1
    return summary


def compute_stats(level_counts: dict[str, dict]):
    """
    Compute summary statistics from log level counts.

    Args:
        level_counts (dict[str, dict]): Mapping of time buckets to log level counts.

    Returns:
        dict: Statistics including max counts per level, overall total, interval count, and average.
    """

    stats = {
        "max_per_level": {},
        "max_total": {"bucket": None, "count": 0},
        "overall_total": 0,
        "count_intervals": len(level_counts),
        "overall_average": 0,
    }
    total_logs = 0
    for level in ["Debug", "Info", "Warn", "Error"]:
        stats["max_per_level"][level] = {"bucket": None, "count": 0}
    for bucket, counts in level_counts.items():
        interval_total = sum(counts.values())
        total_logs += interval_total
        for level, count in counts.items():
            if count > stats["max_per_level"][level]["count"]:
                stats["max_per_level"][level] = {"bucket": bucket, "count": count}
        if interval_total > stats["max_total"]["count"]:
            stats["max_total"] = {"bucket": bucket, "count": interval_total}
    stats["overall_total"] = total_logs
    if stats["count_intervals"] > 0:
        stats["overall_average"] = total_logs / stats["count_intervals"]
    return stats


def extract_top_rows(logs, keywords, top_n=5):
    """
    Extract up to 'top_n' log entries per category that match given keywords and are warnings or errors.

    Args:
        logs (list[dict]): List of log entries.
        keywords (dict): Mapping of category to list of keywords.
        top_n (int, optional): Maximum number of logs to extract per keyword. Defaults to 5.

    Returns:
        dict: Mapping of each category to a list of matching log entries.
    """

    extracted = {}
    for category, kw_list in keywords.items():
        extracted[category] = []
        for kw in kw_list:
            count = 0
            for log in logs:
                message = log.get("messages", "")
                if (
                    message
                    and any(kw in msg for msg in message)
                    and log.get("level", "") in ["Error", "Warn"]
                ):
                    extracted[category].append(log)
                    count += 1
                    if count >= top_n:
                        break
    return extracted


def get_simple_stats(logs):
    """
    Compute overall log level counts and identify the most common keywords.

    Args:
        logs (list[dict]): List of log entries.

    Returns:
        dict: Dictionary with overall counts for each log level and top 5 common keywords.
    """

    # this will simply compute stats like most log level counts, most common keywords, etc.
    # COMPUTE LEVEL COUNTS (not per interval, just overall)
    stats: dict[str, Any] = {"Debug": 0, "Info": 0, "Warn": 0, "Error": 0}
    for log in logs:
        stats[log["level"]] += 1
    # COMPUTE MOST COMMON KEYWORDS
    keywords = defaultdict(int)
    for log in logs:
        for message in log["messages"]:
            for word in message.split():
                keywords[word] += 1
    most_common = sorted(keywords.items(), key=lambda x: x[1], reverse=True)[:5]
    stats["Most Common Keywords"] = map(lambda x: x[0], most_common)
    return stats


def clean_response_content(response_content: str) -> str:
    """
    Remove markdown code block markers from the response content.

    Args:
        response_content (str): The raw response string.

    Returns:
        str: The cleaned response string.
    """

    content = response_content.strip()
    if content.startswith("```"):
        lines = content.splitlines()
        # Remove the first and last lines if they are code block markers.
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        content = "\n".join(lines).strip()
    return content
