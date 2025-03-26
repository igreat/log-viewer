import os
from utils import load_logs, extract_top_rows
import pytest
from agent import ChatAgent
from model_client.openai_model import OpenAIModelClient
from typing import Any

TEST_MODEL = "gpt-4o"


@pytest.fixture
def chat_agent():
    # Get the API key from an environment variable
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        pytest.skip("CHATGPT_API_KEY not set; skipping integration tests.")

    model = OpenAIModelClient(api_key=api_key, model=TEST_MODEL)
    base_prompt = (
        "You are a helpful assistant integrated with a log viewer tool for Cisco engineers. "
        "Your role is to help analyze and filter large log files quickly. "
        "Do not include any additional text."
    )
    return ChatAgent(model=model, base_prompt=base_prompt)


@pytest.fixture
def logs():
    # Load logs from a JSON file
    logs = load_logs()
    if not logs:
        pytest.skip("No logs found; skipping integration tests.")
    return logs


@pytest.fixture
def issue_name():
    return "Missing Media Track Error"


@pytest.fixture
def issue_details():
    details = {
        "description": "A media track could not be retrieved by the Media Track Manager, resulting in a 'No Track!' error. This may indicate a failure in creating or negotiating the required media track for a video call.",
        "context": "This error is logged when the system attempts to retrieve a video track (vid=1) during a media session and finds that no track exists. This might be due to signaling failures, media engine initialization issues, or network problems that prevented proper track creation.",
        "keywords": {
            "media": ["CMediaTrackMgr::GetTrack", "No Track!"],
            "video": ["vid=1"],
        },
        "conditions": "This error typically occurs during call setup or renegotiation and may be accompanied by other signaling errors or warnings in the logs.",
        "resolution": "Investigate preceding log entries for errors in media negotiation or track creation. Ensure that the media engine is properly initialized and that network conditions support the required media streams. Verify configuration settings for media track management.",
    }
    logs = load_logs()
    details["logs"] = extract_top_rows(logs, details["keywords"])
    return details


@pytest.mark.asyncio
async def test_decide_summary_integration_true(
    chat_agent: ChatAgent, logs: list[dict[str, Any]]
):
    message = "Can you generate a summary for my logs?"
    generate_summary, explanation = await chat_agent.decide_summary(message, logs)

    assert generate_summary is True
    assert explanation is not None and explanation != ""


@pytest.mark.asyncio
async def test_decide_summary_integration_false(
    chat_agent: ChatAgent, logs: list[dict[str, Any]]
):
    message = "Filter for debug logs."
    generate_summary, explanation = await chat_agent.decide_summary(message, logs)

    assert generate_summary is False
    assert explanation is not None and explanation != ""


@pytest.mark.asyncio
async def test_generate_summary_integration(
    chat_agent: ChatAgent, logs: list[dict[str, Any]]
):
    message = "Can you generate a summary for my logs?"
    summary, stats = await chat_agent.generate_summary(message, logs)
    most_common_keywords = list(stats["Most Common Keywords"])

    assert summary is not None
    assert stats["Debug"] == 465
    assert stats["Info"] == 3415
    assert stats["Warn"] == 81
    assert stats["Error"] == 39
    assert most_common_keywords == [
        "[]WME:0",
        "=",
        "[cid=3691033875]",
        "::[UTIL]",
        "::[AudioEngine]",
    ]


@pytest.mark.asyncio
async def test_evaluate_decision_integration_true(chat_agent: ChatAgent):
    message = "Can you look for potential issues in my logs?"
    should_check, explanation = await chat_agent.evaluate_decision(message)

    assert should_check is True
    assert explanation is not None and explanation != ""


@pytest.mark.asyncio
async def test_evaluate_decision_integration_false(chat_agent: ChatAgent):
    message = "Can you filter for debug logs?"
    should_check, explanation = await chat_agent.evaluate_decision(message)

    assert should_check is False
    assert explanation is not None


@pytest.mark.asyncio
async def test_evaluate_issue_integration(
    chat_agent: ChatAgent,
    logs: list[dict[str, Any]],
    issue_name: str,
    issue_details: dict[str, Any],
):
    message = "Can you look for potential issues in my logs?"
    issue_text = (
        await chat_agent.evaluate_issue(issue_name, issue_details, message, [])
    ).strip()

    assert issue_text is not None and issue_text != ""
    assert "Issue Summary" in issue_text
    assert "Resolution" in issue_text


@pytest.mark.asyncio
async def test_filter_decision_integration_true(
    chat_agent: ChatAgent, issue_name: str, issue_details: dict[str, Any]
):
    message = "Can you filter for debug logs?"
    should_filter, explanation = await chat_agent.decide_filter(
        message, {issue_name: issue_details}
    )

    assert should_filter is True
    assert explanation is not None and explanation != ""


@pytest.mark.asyncio
async def test_filter_decision_integration_false(
    chat_agent: ChatAgent, issue_name: str, issue_details: dict[str, Any]
):
    message = "Can you look for potential issues in my logs?"
    should_filter, explanation = await chat_agent.decide_filter(message, {})

    assert should_filter is False
    assert explanation is not None and explanation != ""


@pytest.mark.asyncio
async def test_generate_filter_integration(
    chat_agent: ChatAgent, issue_name: str, issue_details: dict[str, Any]
):
    message = "Can you filter for potential issues in my logs?"
    filter_group = await chat_agent.generate_filter_group(
        message, {issue_name: issue_details}
    )

    assert "title" in filter_group
    assert "description" in filter_group
    assert "filters" in filter_group
    assert isinstance(filter_group["filters"], list)
    assert len(filter_group["filters"]) > 0
    assert all(
        "text" in f and "regex" in f and "caseSensitive" in f and "color" in f
        for f in filter_group["filters"]
    )
    assert all("description" in f for f in filter_group["filters"])
    assert filter_group["title"] is not None
    assert filter_group["description"] is not None
    assert filter_group["filters"] is not None
    # I need a filter that includes the keywords in the issue details
    assert any(
        any(kw in f["text"] for kw in issue_details["keywords"]["media"])
        for f in filter_group["filters"]
    )
    assert any(
        any(kw in f["text"] for kw in issue_details["keywords"]["video"])
        for f in filter_group["filters"]
    )
