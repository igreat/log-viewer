from collections import defaultdict
from datetime import datetime, timedelta
import json


def load_logs():
    with open("data/all-logs.json") as f:
        return json.load(f)


def get_log_level_counts(logs, interval=timedelta(seconds=1)):
    summary = defaultdict(lambda: {"Debug": 0, "Info": 0, "Warn": 0, "Error": 0})
    if not logs:
        return summary
    start_time = datetime.fromisoformat(logs[0]["timestamp"].replace("Z", "+00:00"))
    for log in logs:
        log_time = datetime.fromisoformat(log["timestamp"].replace("Z", "+00:00"))
        bucket = start_time + ((log_time - start_time) // interval) * interval
        summary[bucket][log["level"]] += 1
    return summary


def compute_stats(level_counts):
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
