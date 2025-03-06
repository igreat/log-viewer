import abc
import asyncio
from typing import Optional
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
import torch


class ModelClient(abc.ABC):
    @abc.abstractmethod
    async def chat_completion(self, prompt: str, model: Optional[str] = None) -> str:
        """Generate a response given a prompt."""
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
        generated_ids = self.model.generate(**model_inputs, max_new_tokens=10)
        return self.tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]


# run a test to see if the huggerface model client works
async def main():
    import time

    # choose a small model such as
    model_id = "ibm-granite/granite-3.2-2b-instruct"
    client = HuggingFaceModelClient(model_id)
    print("generating response...")
    start = time.time()
    response = await client.chat_completion("Hello, how are you?")
    print(f"Response: {response}")
    print(f"Time taken: {time.time() - start:.2f}s")


if __name__ == "__main__":
    asyncio.run(main())
