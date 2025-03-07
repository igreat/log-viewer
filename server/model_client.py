import abc
import asyncio
from typing import Optional, Iterator
import time
import json
from utils import load_logs, get_log_level_counts, compute_stats
from llama_cpp import Llama


class ModelClient(abc.ABC):
    @abc.abstractmethod
    async def chat_completion(self, prompt: str, model: Optional[str] = None) -> str:
        """Generate a response given a prompt."""
        pass

    # for testing, I need a way to get the token count of a response, but that depends on the model tokenizer
    @abc.abstractmethod
    def get_token_count(self, response: str) -> int:
        pass


class OpenAIModelClient(ModelClient):
    def __init__(self, api_key: str):
        # Import locally so that other clients need not require openai package.
        from openai import OpenAI

        self.client = OpenAI(api_key=api_key)

    async def chat_completion(self, prompt: str, model: Optional[str] = None) -> str:
        # Wrap the blocking API call in asyncio.to_thread.
        response = await asyncio.to_thread(
            self.client.chat.completions.create,
            model=model or "gpt-4o",
            messages=[{"role": "system", "content": prompt}],
        )
        content = response.choices[0].message.content
        return content if content is not None else ""

    def get_token_count(self, response: str) -> int:
        return len(
            response.split()
        )  # NOTE: I'm not testing for openai, so this is fine
class OfflineModelClient(ModelClient):
    def __init__(self, model_path: str):
        self.model = Llama(
            model_path=model_path,
            n_gpu_layers=-1, # Uncomment to use GPU acceleration
            # seed=1337, # Uncomment to set a specific seed
            n_ctx=2048, # Uncomment to increase the context window
        )

    async def chat_completion(self, prompt: str, model: Optional[str] = None) -> str:
        output = self.model(prompt, max_tokens=200)
        print(output)
        if isinstance(output, Iterator):
            return next(output)["choices"][0]["text"]
        return output["choices"][0]["text"]
    
    def get_token_count(self, response: str) -> int:
        return len(response.split()) # FIXME: fine for now


async def test_model(client: ModelClient, user_prompt: str):
    """
    Test the speed and output quality of the AI agent as it would run in production.
    This function will only test the "generate_summary" part of the agent logic.

    Specifically, this function:
      - Loads logs and computes log statistics.
      - Builds the agent's prompt (using a base prompt, computed statistics, and the user query).
      - Invokes the model and measures inference time.
      - Computes the precise token count using the client's tokenizer.

    Parameters:
        client (ModelClient): An instance of ModelClient.
        user_prompt (str): The user-provided query.

    Returns:
        None. Prints the generated output, elapsed time, and tokens per second.
    """
    # Load logs and compute statistics.
    logs = load_logs()
    level_counts = get_log_level_counts(logs)
    stats = compute_stats(level_counts)  # Compute stats like max, average counts, etc.
    stats_str = json.dumps(stats, default=str, indent=2)

    # Define the base prompt for your AI agent.
    base_prompt = (
        "You are a helpful assistant integrated with a log viewer tool for Cisco engineers. "
        "Your role is to help analyze and filter large log files quickly. Hence, generate a helpful summary rather than a detailed response, unless requested. "
        "You may also try to provide suggestions on next move or where to look in the logs for potential issues. "
        "Do not include any additional text."
    )

    # Construct the full prompt by combining the base prompt, log statistics, and the user query.
    full_prompt = (
        f"{base_prompt}\nLog Statistics:\n{stats_str}\nUser Query: {user_prompt}"
    )

    # Record start time.
    start_time = time.perf_counter()

    # Generate the model output (simulate the agent's response).
    response = await client.chat_completion(full_prompt)

    # Record end time and compute elapsed time.
    end_time = time.perf_counter()
    elapsed = end_time - start_time

    # Compute the precise token count using the client's tokenizer.
    prompt_tokens = client.get_token_count(full_prompt)
    tokens = client.get_token_count(response) - prompt_tokens
    tokens_per_second = tokens / elapsed if elapsed > 0 else 0

    # Output the results.
    print("Model Output:\n", response)
    print(f"\nTime taken: {elapsed:.2f} seconds")
    print(f"Tokens per second: {tokens_per_second:.2f}")


# run a test to see if the huggerface model client works
async def main():
    # choose a small model such as
    model_path = "./models/granite/granite-3.2-8b-instruct-Q3_K_L.gguf"
    client = OfflineModelClient(model_path)
    user_prompt = "Can you help me quickly make sense of the logs?"
    await test_model(client, user_prompt)


if __name__ == "__main__":
    asyncio.run(main())
