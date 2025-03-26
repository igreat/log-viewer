import abc


class ModelClient(abc.ABC):
    @abc.abstractmethod
    async def chat_completion(self, prompt: str) -> str:
        """Generate a response given a prompt."""
        pass
