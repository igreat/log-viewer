import asyncio
from model_client.model_client import ModelClient
from llama_cpp import Llama
from typing import Iterator


class OfflineModelClient(ModelClient):
    """
    Offline model client using llama_cpp.
    """

    def __init__(self, model_path: str, context_window: int = 1024):
        """
        Initialize the offline model.

        Args:
            model_path (str): Path to the model file.
            context_window (int, optional): Context window size. Defaults to 1024.
        """
        self.model = Llama(
            model_path=model_path,
            n_gpu_layers=-1,
            n_ctx=context_window,
        )

    async def chat_completion(self, prompt: str) -> str:
        """
        Asynchronously generate a chat response using the offline model.

        Args:
            prompt (str): The input prompt.

        Returns:
            str: The generated response.
        """
        
        output = await asyncio.to_thread(
            self.model.create_chat_completion,
            messages=[{"role": "system", "content": prompt}],
        )
        if isinstance(output, Iterator):
            return ""
        return output["choices"][0]["message"]["content"] or ""
