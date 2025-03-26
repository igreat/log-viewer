import asyncio
from model_client.model_client import ModelClient
from llama_cpp import Llama
from typing import Iterator


class OfflineModelClient(ModelClient):
    def __init__(self, model_path: str, context_window: int = 1024):
        self.model = Llama(
            model_path=model_path,
            n_gpu_layers=-1,
            n_ctx=context_window,
        )

    async def chat_completion(self, prompt: str) -> str:
        output = await asyncio.to_thread(
            self.model.create_chat_completion,
            messages=[{"role": "system", "content": prompt}],
        )
        print("Output:", output)
        if isinstance(output, Iterator):
            return ""  # FIXME: Handle streaming responses.
        return output["choices"][0]["message"]["content"] or ""
