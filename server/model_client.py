import abc
import asyncio
from typing import Optional
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
import torch
import time
import json
from utils import load_logs, get_log_level_counts, compute_stats


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


class HuggingFaceModelClient(ModelClient):
    def __init__(self, model_id: str):
        quant_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=torch.bfloat16,
        )

        self.model = AutoModelForCausalLM.from_pretrained(
            model_id,
            device_map="auto",
            quantization_config=quant_config,
        )
        self.tokenizer = AutoTokenizer.from_pretrained(model_id)

    async def chat_completion(self, prompt: str, model: Optional[str] = None) -> str:
        # cuda if available, then mps, then cpu
        device = torch.device(
            "cuda"
            if torch.cuda.is_available()
            else "mps"
            if torch.backends.mps.is_available()
            else "cpu"
        )
        print(f"Using device: {device}")

        # Load the tokenizer based on the model's configuration name
        model_inputs = self.tokenizer([prompt], return_tensors="pt").to(device)
        generated_ids = self.model.generate(**model_inputs, max_new_tokens=200)
        return self.tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]

    def get_token_count(self, response: str) -> int:
        tokens = self.tokenizer.tokenize(response)
        return len(tokens)


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
    model_id = "ibm-granite/granite-3.2-8b-instruct"
    client = HuggingFaceModelClient(model_id)
    user_prompt = "Can you help me quickly make sense of the logs?"
    await test_model(client, user_prompt)


if __name__ == "__main__":
    asyncio.run(main())
