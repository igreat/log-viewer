import asyncio
from model_client.model_client import ModelClient
from openai import OpenAI


class OpenAIModelClient(ModelClient):
    """
    OpenAI model client that uses the OpenAI API for chat completions.
    """

    def __init__(self, api_key: str, model: str):
        """
        Initialize the OpenAI model client.

        Args:
            api_key (str): API key for accessing OpenAI services.
            model (str): Identifier of the OpenAI model to use.
        """

        self.client = OpenAI(api_key=api_key)
        self.model = model

    async def chat_completion(self, prompt: str) -> str:
        """
        Asynchronously generate a chat response using the OpenAI API.

        Args:
            prompt (str): The prompt for which to generate a response.

        Returns:
            str: The generated chat response.
        """

        response = await asyncio.to_thread(
            self.client.chat.completions.create,
            model=self.model,
            messages=[{"role": "system", "content": prompt}],
        )
        content = response.choices[0].message.content
        return content if content is not None else ""
