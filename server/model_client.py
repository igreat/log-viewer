import abc
import asyncio
from typing import Iterator
from llama_cpp import Llama


class ModelClient(abc.ABC):
    @abc.abstractmethod
    async def chat_completion(self, prompt: str) -> str:
        """Generate a response given a prompt."""
        pass


class OpenAIModelClient(ModelClient):
    def __init__(self, api_key: str, model: str):
        # Import locally so that other clients need not require openai package.
        from openai import OpenAI

        self.client = OpenAI(api_key=api_key)
        self.model = model

    async def chat_completion(self, prompt: str) -> str:
        # Wrap the blocking API call in asyncio.to_thread.
        response = await asyncio.to_thread(
            self.client.chat.completions.create,
            model=self.model,
            messages=[{"role": "system", "content": prompt}],
        )
        content = response.choices[0].message.content
        return content if content is not None else ""


class OfflineModelClient(ModelClient):
    def __init__(self, model_path: str, context_window: int = 2048):
        self.model = Llama(
            model_path=model_path,
            n_gpu_layers=-1,
            n_ctx=context_window,
        )

    async def chat_completion(self, prompt: str) -> str:
        output = self.model(prompt, max_tokens=1024)
        print(output)
        if isinstance(output, Iterator):
            return next(output)["choices"][0]["text"]
        return output["choices"][0]["text"]
