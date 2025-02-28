import { extendFilterGroups } from "./filterGroup";

const AGENT_ENDPOINT = 'http://localhost:8000/chat';

const DEFAULT_ISSUES = {
    "Missing Media Track Error": {
        "description": "A media track could not be retrieved by the Media Track Manager, resulting in a 'No Track!' error. This may indicate a failure in creating or negotiating the required media track for a video call.",
        "context": "This error is logged when the system attempts to retrieve a video track (vid=1) during a media session and finds that no track exists. This might be due to signaling failures, media engine initialization issues, or network problems that prevented proper track creation.",
        "keywords": {
            "media": ["CMediaTrackMgr::GetTrack", "No Track!"],
            "video": ["vid=1"],
            "session": ["MediaSession"],
        },
        "conditions": "This error typically occurs during call setup or renegotiation and may be accompanied by other signaling errors or warnings in the logs.",
        "resolution": "Investigate preceding log entries for errors in media negotiation or track creation. Ensure that the media engine is properly initialized and that network conditions support the required media streams. Verify configuration settings for media track management.",
    }
};

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
                body: JSON.stringify({ message: userInput, known_issues: knownIssues })
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
    knownIssues = JSON.parse(localStorage.getItem("knownIssues"));
    if (!knownIssues) {
        knownIssues = DEFAULT_ISSUES;
        localStorage.setItem('knownIssues', JSON.stringify(knownIssues));
    }

    // When the "Add Category" button is clicked, show the issue modal.
    const addCategoryBtn = document.getElementById("add-category-btn");
    addCategoryBtn.addEventListener("click", function () {
        // Show the modal (using Bootstrap's modal method)
        $('#issueModal').modal('show');
    });

    // When the "Search Categories" button is clicked, load known issues into the categories modal and show it.
    const searchCategoriesBtn = document.getElementById("search-categories-btn");
    searchCategoriesBtn.addEventListener("click", function () {
        loadCategoriesModal();
        $('#categoriesModal').modal('show');
    });

    // Handle the issue form submission
    const saveIssueButton = document.getElementById("save-issue-btn");
    saveIssueButton.addEventListener("click", handleSubmitIssue);
};

// Loads all known issues from localStorage (or the global variable) into the categories modal as cards.
const loadCategoriesModal = () => {
    const categoriesContainer = document.getElementById("categoriesContainer");
    categoriesContainer.innerHTML = ""; // Clear existing content.

    for (const category in knownIssues) {
        if (knownIssues.hasOwnProperty(category)) {
            const issue = knownIssues[category];
            const cardHtml = `
                <div class="card category-card mb-3" style="cursor: pointer;">
                    <div class="card-body d-flex justify-content-between align-items-center">
                    <div class="category-info">
                        <h5 class="card-title mb-1">${category}</h5>
                        <p class="card-text small text-muted">${issue.description}</p>
                    </div>
                    <div class="category-actions d-flex align-items-center">
                        <div class="custom-control custom-switch mr-3">
                        <input type="checkbox" class="custom-control-input" id="category-switch-${category}" checked>
                        <label class="custom-control-label" for="category-switch-${category}"></label>
                        </div>
                        <button type="button" class="btn btn-sm btn-outline-primary edit-category-btn">Edit</button>
                    </div>
                    </div>
                </div>
            `;
            categoriesContainer.insertAdjacentHTML('beforeend', cardHtml);
        }
    }
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
