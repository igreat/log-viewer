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

const DEFAULT_WORKSPACES = {
    "Default Workspace": DEFAULT_ISSUES
};

let workspaces = {};
let currentWorkspace = "Default Workspace";
// let knownIssues = {};

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
        event.preventDefault(); // Prevent page reload

        const userInput = inputField.value.trim();
        if (!userInput) return;

        // Create and append a user message bubble.
        const userMessage = document.createElement("div");
        userMessage.className = "chat-message user";
        userMessage.textContent = userInput;
        messagesContainer.appendChild(userMessage);
        inputField.value = "";

        // Create a loading bot message bubble.
        const loadingMessage = document.createElement("div");
        loadingMessage.className = "chat-message bot";
        loadingMessage.textContent = "...";
        messagesContainer.appendChild(loadingMessage);

        try {
            // Send the message to your Python backend including known issues.
            const response = await fetch(AGENT_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userInput, known_issues: workspaces[currentWorkspace] })
            });

            const data = await response.json();
            console.log(data);

            // Replace the loading bubble with the bot's reply.
            if (data.reply) {
                loadingMessage.textContent = data.reply;
            } else {
                loadingMessage.textContent = "Sorry, I couldn't process that.";
            }

            // Process each action from the response.
            if (data.actions) {
                data.actions.forEach(action => {
                    if (action.type === "add_filter") {
                        extendFilterGroups(action.body.filter_groups);
                        const botMessage = document.createElement("div");
                        botMessage.className = "chat-message bot";
                        botMessage.textContent = `Added filter groups ${action.body.filter_groups.map(group => group.title).join(", ")}.`;
                        messagesContainer.appendChild(botMessage);
                    } else if (action.type === "generate_summary") {
                        const botMessage = document.createElement("div");
                        botMessage.className = "chat-message bot";
                        botMessage.textContent = action.body.overview;
                        messagesContainer.appendChild(botMessage);
                    } else if (action.type === "flag_issue") {
                        const { issue_category, summary_of_issue, resolution } = action.body;
                        const botMessage = document.createElement("div");
                        botMessage.className = "chat-message bot";
                        botMessage.innerHTML = `Detected issue: ${issue_category}:<br>${summary_of_issue}<br><br>Resolution: ${resolution}`;
                        messagesContainer.appendChild(botMessage);
                    }
                    // Additional actions can be handled here.
                });
            }
        } catch (error) {
            console.error('Error fetching chatbot response:', error);
            loadingMessage.textContent = "An error occurred.";
        }

        // Scroll to the bottom of the messages container.
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });

    // Load workspaces from localStorage or initialize
    workspaces = JSON.parse(localStorage.getItem("workspaces"));
    if (!workspaces) {
        workspaces = DEFAULT_WORKSPACES;
        localStorage.setItem("workspaces", JSON.stringify(workspaces));
    }

    // When the "Add Category" button is clicked, show the issue modal.
    const addCategoryBtn = document.getElementById("add-category-btn");
    addCategoryBtn.addEventListener("click", function () {
        const form = document.getElementById("issue-form");
        form.reset();
        window.currentEditingCategory = null;
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

    populateWorkspaceDropdown();
    populateChatbotWorkspaceDropdown();
    attachWorkspaceSelectListener();
};

// Populate the workspace dropdown with existing workspaces plus an "Add New Workspace" option.
const populateWorkspaceDropdown = () => {
    const workspaceSelect = document.getElementById("workspace-select");
    workspaceSelect.innerHTML = ""; // Clear existing options.

    // Add an option for each workspace.
    for (const ws in workspaces) {
        if (workspaces.hasOwnProperty(ws)) {
            const option = document.createElement("option");
            option.value = ws;
            option.textContent = ws;
            if (ws === currentWorkspace) option.selected = true;
            workspaceSelect.appendChild(option);
        }
    }

    // Add the "Add New Workspace" option at the bottom.
    const addOption = document.createElement("option");
    addOption.value = "ADD_NEW_WORKSPACE";
    addOption.textContent = "Add New Workspace...";
    workspaceSelect.appendChild(addOption);
};

// Populate the workspace dropdown in the chatbot header.
const populateChatbotWorkspaceDropdown = () => {
    const workspaceSelect = document.getElementById("chatbot-workspace-select");
    workspaceSelect.innerHTML = ""; // Clear existing options.

    // Add an option for each workspace.
    for (const ws in workspaces) {
        if (workspaces.hasOwnProperty(ws)) {
            const option = document.createElement("option");
            option.value = ws;
            option.textContent = ws;
            if (ws === currentWorkspace) option.selected = true;
            workspaceSelect.appendChild(option);
        }
    }

    // Add the "Add New Workspace" option.
    const addOption = document.createElement("option");
    addOption.value = "ADD_NEW_WORKSPACE";
    addOption.textContent = "Add New Workspace...";
    workspaceSelect.appendChild(addOption);

    // Attach change event.
    workspaceSelect.addEventListener("change", (e) => {
        if (e.target.value === "ADD_NEW_WORKSPACE") {
            const newWorkspace = prompt("Enter new workspace name:");
            if (newWorkspace) {
                if (!workspaces[newWorkspace]) {
                    workspaces[newWorkspace] = {};
                    localStorage.setItem("workspaces", JSON.stringify(workspaces));
                }
                currentWorkspace = newWorkspace;
                populateChatbotWorkspaceDropdown(); // Refresh dropdown.
                // Optionally, you can update any UI elements dependent on the current workspace.
            } else {
                // Revert to the current workspace.
                workspaceSelect.value = currentWorkspace;
            }
        } else {
            currentWorkspace = e.target.value;
            // Optionally update UI based on new currentWorkspace.
        }
    });
};

// Attach an event listener to handle workspace selection changes.
const attachWorkspaceSelectListener = () => {
    const workspaceSelect = document.getElementById("workspace-select");
    workspaceSelect.addEventListener("change", (e) => {
        if (e.target.value === "ADD_NEW_WORKSPACE") {
            // Prompt the user for a new workspace name.
            const newWorkspace = prompt("Enter new workspace name:");
            if (newWorkspace) {
                // If the new workspace doesn't already exist, add it.
                if (!workspaces[newWorkspace]) {
                    workspaces[newWorkspace] = {};
                    localStorage.setItem("workspaces", JSON.stringify(workspaces));
                }
                currentWorkspace = newWorkspace;
                // Update the dropdown to reflect the new workspace.
                populateWorkspaceDropdown();
                populateChatbotWorkspaceDropdown();
                // Optionally, update any UI that depends on the current workspace.
                loadCategoriesModal();
            } else {
                // If no name was provided, revert to the current workspace.
                workspaceSelect.value = currentWorkspace;
            }
        } else {
            // Otherwise, update the current workspace and reload the categories.
            currentWorkspace = e.target.value;
            loadCategoriesModal();
        }
    });
};


const loadCategoriesModal = () => {
    // Populate workspace dropdown at the top.
    populateWorkspaceDropdown();

    const categoriesRow = document.getElementById("categoriesRow");
    categoriesRow.innerHTML = ""; // Clear existing content.

    // Use issues from the currently selected workspace.
    const issues = workspaces[currentWorkspace] || {};

    for (const category in issues) {
        if (issues.hasOwnProperty(category)) {
            const issue = issues[category];
            const colHtml = `
                <div class="col-sm-6 col-md-4 mb-3">
                <div class="card category-card h-100" style="cursor: pointer;">
                    <div class="card-body d-flex flex-column">
                    <div class="category-info mb-3">
                        <h5 class="card-title mb-1">${category}</h5>
                        <p class="card-text small text-muted">${issue.description}</p>
                    </div>
                    <div class="mt-auto d-flex justify-content-between align-items-center">
                        <div class="form-check">
                        <input type="checkbox" class="form-check-input" id="category-switch-${category}" checked>
                        <label class="form-check-label" for="category-switch-${category}"></label>
                        </div>
                        <button type="button" class="btn btn-sm btn-outline-primary edit-category-btn btn-circle">
                        <span class="material-symbols-outlined">edit</span>
                        </button>
                    </div>
                    </div>
                </div>
                </div>
            `;
            categoriesRow.insertAdjacentHTML('beforeend', colHtml);
        }
    }

    let editFromCategories = false;

    // attach edit button event:
    document.querySelectorAll(".edit-category-btn").forEach(btn => {
        btn.addEventListener("click", function (event) {
            event.stopPropagation(); // Prevent card click event
            const card = btn.closest(".category-card");
            const categoryName = card.querySelector(".card-title").textContent.trim();
            // Set flag so that when the edit modal is closed, the categories modal reopens.
            editFromCategories = true;
            $('#categoriesModal').modal('hide');
            openEditIssueModal(categoryName);
        });
    });

    // When the issue modal is hidden (closed via save or cancel), check the flag.
    $('#issueModal').on('hidden.bs.modal', function () {
        if (editFromCategories) {
            // Refresh the Categories modal content
            loadCategoriesModal();
            $('#categoriesModal').modal('show');
            editFromCategories = false; // Reset the flag.
        }
    });
};

const openEditIssueModal = (category) => {
    const issue = workspaces[currentWorkspace][category];
    document.getElementById("issue-category").value = category;
    document.getElementById("issue-description-input").value = issue.description || "";
    document.getElementById("issue-context").value = issue.context || "";
    document.getElementById("issue-keywords").value = JSON.stringify(issue.keywords, null, 2);
    document.getElementById("issue-conditions").value = issue.conditions || "";
    document.getElementById("issue-resolution").value = issue.resolution || "";

    // Set a global flag for editing.
    window.currentEditingCategory = category;

    // Hide the categories modal and show the edit modal.
    $('#categoriesModal').modal('hide');
    $('#issueModal').modal('show');
};

const handleSubmitIssue = (event) => {
    event.preventDefault();

    const form = document.getElementById("issue-form");
    const newCategory = document.getElementById("issue-category").value.trim();
    const description = document.getElementById("issue-description-input").value.trim();
    const context = document.getElementById("issue-context").value.trim();
    const keywordsStr = document.getElementById("issue-keywords").value.trim();
    const conditions = document.getElementById("issue-conditions").value.trim();
    const resolution = document.getElementById("issue-resolution").value.trim();

    let keywords;
    try {
        keywords = JSON.parse(keywordsStr);
    } catch (error) {
        alert("Invalid JSON for keywords. Please check your format.");
        return;
    }

    const issueObj = {
        description,
        context,
        keywords,
        conditions: conditions || null,
        resolution: resolution || null
    };

    // If editing an existing category, remove old entry if the title has changed.
    if (window.currentEditingCategory) {
        if (window.currentEditingCategory !== newCategory) {
            delete workspaces[currentWorkspace][window.currentEditingCategory];
        }
        workspaces[currentWorkspace][newCategory] = issueObj;
        window.currentEditingCategory = null;
    } else {
        // Add a new issue in the current workspace.
        workspaces[currentWorkspace][newCategory] = issueObj;
    }

    localStorage.setItem('workspaces', JSON.stringify(workspaces));
    $('#issueModal').modal('hide');
    form.reset();

    // Refresh the categories modal UI.
    loadCategoriesModal();
    console.log("Updated Workspaces:", workspaces);
};
