import asyncio
from model_client.model_client import ModelClient
from openai import OpenAI


class OpenAIModelClient(ModelClient):
    def __init__(self, api_key: str, model: str):
        # Import locally so that other clients need not require openai package.

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
