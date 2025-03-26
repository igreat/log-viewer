import abc


class ModelClient(abc.ABC):
    """Abstract base class for model clients."""

    @abc.abstractmethod
    async def chat_completion(self, prompt: str) -> str:
        """
        Asynchronously generate a response for the given prompt.

        Args:
            prompt (str): The input prompt.

        Returns:
            str: The generated response.
        """
        pass
