import { extendFilterGroups } from "./filterGroup";

const AGENT_ENDPOINT = 'http://localhost:8000/chat';

let knownIssues = {};

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

            // Display the bot's reply if available
            if (data.reply) {
                loadingMessage.innerHTML = `<strong>Bot:</strong> ${data.reply}`;
            } else {
                loadingMessage.innerHTML = `<strong>Bot:</strong> Sorry, I couldn't process that.`;
            }

            // Process each action from the response
            if (data.actions) {
                data.actions.forEach(action => {
                    if (action.type === "add_filter") {
                        extendFilterGroups(action.body.filter_groups);
                        // Confirmation message for adding filter groups
                        const botMessage = document.createElement("div");
                        botMessage.innerHTML = `<strong>Bot:</strong> Added filter groups ${action.body.filter_groups.map(group => group.title).join(", ")} ✅`;
                        messagesContainer.appendChild(botMessage);
                    } else if (action.type === "generate_summary") {
                        // Handle generate_summary action
                        const overview = action.body.overview;
                        const summaryMessage = document.createElement("div");
                        summaryMessage.innerHTML = `<strong>Bot Summary:</strong> ${overview}`;
                        messagesContainer.appendChild(summaryMessage);
                    } else if (action.type === "flag_issue") {
                        const { issue_category, summary_of_issue, resolution } = action.body;
                        const issueMessage = document.createElement("div");
                        issueMessage.innerHTML = `<strong>Bot:</strong> Detected issue: ${issue_category}:<br>${summary_of_issue}<br><br>Resolution: ${resolution}`;
                        messagesContainer.appendChild(issueMessage);
                    }
                    // Can add more actions here...
                });
            }
        } catch (error) {
            console.error('Error fetching chatbot response:', error);
            loadingMessage.innerHTML = `<strong>Bot:</strong> An error occurred.`;
        }

        // Scroll to the bottom of the messages container
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });

    // Global variable for storing known issues; load from localStorage if available.
    knownIssues = JSON.parse(localStorage.getItem("knownIssues")) || {}

    // When the "Add Category" button is clicked, show the issue modal.
    const addCategoryBtn = document.getElementById("add-category-btn");
    addCategoryBtn.addEventListener("click", function () {
        // Show the modal (using Bootstrap's modal method)
        $('#issueModal').modal('show');
    });

    // Handle the issue form submission
    const saveIssueButton = document.getElementById("save-issue-btn");
    saveIssueButton.addEventListener("click", handleSubmitIssue);
};

const handleSubmitIssue = (event) => {
    // Prevent the form from submitting
    event.preventDefault();

    // Get the form element
    const form = document.getElementById("issue-form");

    // Get the form values
    const category = document.getElementById("issue-category").value.trim();
    const description = document.getElementById("issue-description-input").value.trim();
    const context = document.getElementById("issue-context").value.trim();
    const keywordsStr = document.getElementById("issue-keywords").value.trim();
    const conditions = document.getElementById("issue-conditions").value.trim();
    const resolution = document.getElementById("issue-resolution").value.trim();

    // Parse keywords JSON.
    let keywords;
    try {
        keywords = JSON.parse(keywordsStr);
    } catch (error) {
        alert("Invalid JSON for keywords. Please check your format.");
        return;
    }

    // Create the issue object.
    const issueObj = {
        description,
        context,
        keywords,
        conditions: conditions || null,
        resolution: resolution || null
    };

    // Store in the global knownIssues variable.
    knownIssues[category] = issueObj;

    // Save to localStorage.
    localStorage.setItem('knownIssues', JSON.stringify(knownIssues));

    // Close the modal.
    $('#issueModal').modal('hide');

    // Reset the form.
    form.reset();

    // For debugging purposes, log the updated known issues.
    console.log("Known Issues:", knownIssues);
}
