import { extendFilterGroups } from "./filterGroup";

const AGENT_ENDPOINT = 'http://localhost:8000/chat';

export const initChatbot = () => {
    // Attach event listener for toggling the chatbot panel
    const toggleBtn = document.getElementById("chatbot-toggle-btn");
    const chatbotContainer = document.getElementById("chatbot-container");
    const mainContent = document.getElementById("main-content");

    toggleBtn.addEventListener("click", function () {
        if (chatbotContainer.classList.contains("d-none")) {
            // Show chatbot panel and adjust layout
            chatbotContainer.classList.remove("d-none");
            chatbotContainer.classList.add("col-md-4");
            mainContent.classList.remove("col-md-12");
            mainContent.classList.add("col-md-8");
        } else {
            // Hide chatbot panel and expand main content
            chatbotContainer.classList.remove("col-md-4");
            chatbotContainer.classList.add("d-none");
            mainContent.classList.remove("col-md-8");
            mainContent.classList.add("col-md-12");
        }
    });

    // Attach event listener for sending chatbot messages
    const chatbotForm = document.getElementById("chatbot-form");
    const inputField = document.getElementById("chatbot-input");
    const messagesContainer = document.getElementById("chatbot-messages");

    chatbotForm.addEventListener("submit", async function (event) {
        event.preventDefault(); // Prevent the page from reloading

        const userInput = inputField.value.trim();
        if (!userInput) return;

        // Append the user's message to the chat area
        const userMessage = document.createElement("div");
        userMessage.innerHTML = `<strong>You:</strong> ${userInput}`;
        messagesContainer.appendChild(userMessage);
        inputField.value = "";

        // Append a temporary "loading" message
        const loadingMessage = document.createElement("div");
        loadingMessage.innerHTML = `<strong>Bot:</strong> ...`;
        messagesContainer.appendChild(loadingMessage);

        try {
            // Send the message to your Python backend
            const response = await fetch(AGENT_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: userInput })
            });

            const data = await response.json();

            console.log(data);
            if (data.reply) {
                loadingMessage.innerHTML = `<strong>Bot:</strong> ${data.reply}`;
            } else {
                loadingMessage.innerHTML = `<strong>Bot:</strong> Sorry, I couldn't process that.`;
            }

            if (data.actions) {
                data.actions.forEach(action => {
                    if (action.type === "add_filter") {
                        extendFilterGroups(action.body.filter_groups);
                        // confirmation message
                        const botMessage = document.createElement("div");
                        botMessage.innerHTML = `<strong>Bot:</strong> Added filter groups ${action.body.filter_groups.map(group => group.title).join(", ")} ✅`;
                        messagesContainer.appendChild(botMessage);
                    }
                });
            }
        } catch (error) {
            console.error('Error fetching chatbot response:', error);
            loadingMessage.innerHTML = `<strong>Bot:</strong> An error occurred.`;
        }

        // Scroll to the bottom of the messages container
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}