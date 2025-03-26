import { extendFilterGroups } from "./filterGroup";
import { marked } from "marked";
import { allLogs, currentLogId } from "./logService";

/** @constant {string} API endpoint base URL */
const API_ENDPOINT = "http://localhost:8000";
/** @constant {string} Chat agent streaming endpoint */
const AGENT_ENDPOINT = `${API_ENDPOINT}/chat_stream`;
/** @constant {string} Models endpoint */
const MODELS_ENDPOINT = `${API_ENDPOINT}/models`;

/** @constant {Object} Default issues with descriptions, keywords, and resolutions */
const DEFAULT_ISSUES = {
    "Missing Media Track Error": {
        "description": "A media track could not be retrieved by the Media Track Manager, resulting in a 'No Track!' error. This may indicate a failure in creating or negotiating the required media track for a video call.",
        "context": "This error is logged when the system attempts to retrieve a video track (vid=1) during a media session and finds that no track exists. This might be due to signaling failures, media engine initialization issues, or network problems that prevented proper track creation.",
        "keywords": {
            "media": ["CMediaTrackMgr::GetTrack", "No Track!"],
            "video": ["vid=1"],
        },
        "conditions": "This error typically occurs during call setup or renegotiation and may be accompanied by other signaling errors or warnings in the logs.",
        "resolution": "Investigate preceding log entries for errors in media negotiation or track creation. Ensure that the media engine is properly initialized and that network conditions support the required media streams. Verify configuration settings for media track management.",
    },
};

/** @constant {Object} Default workspaces mapping workspace name to issues */
const DEFAULT_WORKSPACES = {
    "Default Workspace": DEFAULT_ISSUES
};

let workspaces = {};
let currentWorkspace = "Default Workspace";
let currentModel = "gpt-4o";

/**
 * Initialize the chatbot UI and attach event listeners.
 */
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

    // Initialize sample questions above the input field
    initSampleQuestions();

    chatbotForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        // Remove any existing thinking boxes before processing a new query.
        const oldSummaryDecision = document.getElementById("decision-message");
        if (oldSummaryDecision) oldSummaryDecision.remove();
        const oldIssueDecision = document.getElementById("issue-decision-message");
        if (oldIssueDecision) oldIssueDecision.remove();

        const userInput = inputField.value.trim();
        if (!userInput) return;

        // Remove sample questions if present once the conversation has started
        const sampleContainer = document.getElementById("sample-questions-container");
        if (sampleContainer) sampleContainer.remove();

        // Append user message bubble.
        const userMessage = document.createElement("div");
        userMessage.className = "chat-message user";
        userMessage.textContent = userInput;
        messagesContainer.appendChild(userMessage);
        inputField.value = "";

        // Append a placeholder bot message.
        const loadingMessage = document.createElement("div");
        loadingMessage.className = "chat-message bot";
        loadingMessage.textContent = "Waiting for response...";
        messagesContainer.appendChild(loadingMessage);

        try {
            // Call the /chat_stream endpoint with the user message and known issues.
            const response = await fetch(AGENT_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userInput,
                    known_issues: workspaces[currentWorkspace],
                    model: currentModel,
                    logs: allLogs,
                    log_id: currentLogId
                })
            });

            // Process the streaming response.
            processStream(response.body, messagesContainer, loadingMessage);
        } catch (error) {
            console.error("Error fetching chatbot response:", error);
            loadingMessage.textContent = "An error occurred.";
        }
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

    // Attach event listener to the "Add Keyword Category" button.
    const addKeywordCategoryBtn = document.getElementById("add-keyword-category");
    addKeywordCategoryBtn.addEventListener("click", function () {
        addKeywordRow();
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
    populateChatbotModelDropdown();
};

/**
 * Process the streaming response (SSE) from the agent.
 * @param {ReadableStream} stream - The response stream.
 * @param {HTMLElement} messagesContainer - Container for messages.
 * @param {HTMLElement} loadingMessage - The loading message element.
 */
const processStream = async (stream, messagesContainer, loadingMessage) => {
    const decoder = new TextDecoder("utf-8");
    const reader = stream.getReader();
    let buffer = "";
    let doneProcessing = false;

    while (!doneProcessing) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let parts = buffer.split("\n\n");
        // Keep the last incomplete chunk in the buffer.
        buffer = parts.pop();

        for (const part of parts) {
            if (part.startsWith("data: ")) {
                const dataStr = part.substring(6).trim();
                if (dataStr === "[DONE]") {
                    // Final event received; stop processing.
                    processAction({ type: "done" }, messagesContainer);
                    doneProcessing = true;
                    break;
                }
                try {
                    const action = JSON.parse(dataStr);
                    processAction(action, messagesContainer);
                } catch (e) {
                    console.error("Error parsing streamed action", e);
                }
            }
        }
    }
    // Remove the loading message once streaming is complete.
    if (loadingMessage && loadingMessage.parentNode) {
        loadingMessage.remove();
    }
};

/**
 * Start an animated ellipsis on an element.
 * @param {HTMLElement} element - The element to animate.
 */
const startEllipsisAnimation = (element) => {
    let dots = 0;
    const intervalId = setInterval(() => {
        dots = (dots + 1) % 4; // cycles 0, 1, 2, 3
        element.textContent = ".".repeat(dots);
    }, 500);
    // Store the interval id on the element so we can stop it later.
    element.dataset.intervalId = intervalId;
};


/**
 * Stop the animated ellipsis on an element.
 * @param {HTMLElement} element - The element with the animation.
 */
const stopEllipsisAnimation = (element) => {
    if (element.dataset.intervalId) {
        clearInterval(parseInt(element.dataset.intervalId));
        delete element.dataset.intervalId;
        element.textContent = ""; // Clear the animated text.
    }
};

/**
 * Freeze decision indicator animations.
 */
const freezeDecisionIndicators = () => {
    const summaryDecisionEl = document.getElementById("decision-message");
    if (summaryDecisionEl) {
        const ellipsisSpan = summaryDecisionEl.querySelector(".animated-ellipsis");
        if (ellipsisSpan) {
            stopEllipsisAnimation(ellipsisSpan);
        }
    }
    const issueDecisionEl = document.getElementById("issue-decision-message");
    if (issueDecisionEl) {
        const ellipsisSpan = issueDecisionEl.querySelector(".animated-ellipsis");
        if (ellipsisSpan) {
            stopEllipsisAnimation(ellipsisSpan);
        }
    }

    const filterDecisionEl = document.getElementById("filter-decision-message");
    if (filterDecisionEl) {
        const ellipsisSpan = filterDecisionEl.querySelector(".animated-ellipsis");
        if (ellipsisSpan) {
            stopEllipsisAnimation(ellipsisSpan);
        }
    }
};

/**
 * Create a styled "thinking" message element.
 * @param {string} id - Element ID.
 * @param {string} title - Header title.
 * @param {string} explanation - Explanation text.
 * @returns {HTMLElement} The new element.
 */
function createThinkingElement(id, title, explanation) {
    const elem = document.createElement("div");
    elem.id = id;
    elem.className = "chat-message bot thinking";
    Object.assign(elem.style, {
        fontSize: "0.8rem",
        padding: "5px 10px",
        margin: "8px 0",
        backgroundColor: "#ffffff",
        border: "1px solid #e0e0e0",
        borderRadius: "12px",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
    });

    const header = document.createElement("div");
    header.className = "thinking-header";
    header.style.cursor = "pointer";
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";

    const titleSpan = document.createElement("span");
    titleSpan.innerHTML = title;
    header.appendChild(titleSpan);

    const ellipsisSpan = document.createElement("span");
    ellipsisSpan.className = "animated-ellipsis";
    header.appendChild(ellipsisSpan);
    startEllipsisAnimation(ellipsisSpan);

    const details = document.createElement("div");
    details.className = "thinking-details";
    Object.assign(details.style, {
        display: "none",
        marginTop: "8px",
        fontSize: "0.75rem",
        color: "#555",
    });
    details.textContent = explanation;

    header.addEventListener("click", () => {
        details.style.display = details.style.display === "none" ? "block" : "none";
    });

    elem.appendChild(header);
    elem.appendChild(details);
    return elem;
}

/**
 * Update (or create) a thinking element for a given action.
 * @param {Object} config - Configuration object.
 * @param {string} config.id - The element ID.
 * @param {string} config.title - The header title.
 * @param {boolean} config.removalCondition - When true, schedule removal.
 * @param {string} explanation - The explanation text.
 * @param {HTMLElement} container - Parent container to append the element.
 */
function updateThinkingElement(config, explanation, container) {
    let elem = document.getElementById(config.id);
    if (!elem) {
        elem = createThinkingElement(config.id, config.title, explanation);
        container.appendChild(elem);
    } else {
        const details = elem.querySelector(".thinking-details");
        if (details) details.textContent = explanation;
    }
    if (config.removalCondition && !elem.dataset.removalScheduled) {
        elem.dataset.removalScheduled = "true";
        setTimeout(() => {
            const el = document.getElementById(config.id);
            if (el) el.remove();
        }, 3000);
    }
}

/**
 * Process an action from the agent and update the UI.
 * @param {Object} action - The action object from the agent.
 * @param {HTMLElement} messagesContainer - The container for chat messages.
 */
const processAction = (action, messagesContainer) => {
    // Handle "done" type to stop any animations.
    if (action.type === "done") {
        freezeDecisionIndicators();
        return;
    }

    const thinkingConfigs = {
        summary_decision: {
            id: "decision-message",
            title: "Agent thinking",
            removalCondition: !action.body.generate_summary,
        },
        issue_decision: {
            id: "issue-decision-message",
            title: "Evaluating issues",
            removalCondition: !action.body.evaluate_issues,
        },
        filter_decision: {
            id: "filter-decision-message",
            title: "Filter Decision",
            removalCondition: !action.body.should_add_filter,
        },
    };

    if (thinkingConfigs[action.type]) {
        updateThinkingElement(thinkingConfigs[action.type], action.body.explanation, messagesContainer);
    } else if (action.type === "add_filter") {
        freezeDecisionIndicators();
        if (action.body.filter_group) {
            extendFilterGroups([action.body.filter_group]);
            const filterGroup = action.body.filter_group;
            let markdownContent = `**Added Filter Group**\n: ${filterGroup.title}\n\n_${filterGroup.description}_\n\n`;
            let tableHtml = "";
            if (filterGroup.filters && filterGroup.filters.length > 0) {
                tableHtml += `
                    <table style="table-layout: fixed; width: 100%;">
                        <thead>
                            <tr>
                            <th style="white-space: normal; word-break: break-all">Text</th>
                            <th style="white-space: normal; word-break: break-all">Description</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                filterGroup.filters.forEach(filter => {
                    tableHtml += `
                        <tr>
                            <td style="white-space: normal; word-break: break-all">
                                <span style="background-color: ${filter.color}; padding: 2px 4px;">${filter.text}</span>
                            </td>
                            <td style="white-space: normal;">${filter.description}</td>
                        </tr>`;
                });
                tableHtml += `
                    </tbody>
                </table>`;
            }

            const botMessage = document.createElement("div");
            botMessage.className = "chat-message bot";
            const header = document.createElement("div");
            header.innerHTML = marked.parse(markdownContent);
            botMessage.appendChild(header);
            if (tableHtml) {
                const tableDiv = document.createElement("div");
                tableDiv.innerHTML = tableHtml;
                botMessage.appendChild(tableDiv);
            }
            messagesContainer.appendChild(botMessage);
        }
    } else if (action.type === "generate_summary") {
        freezeDecisionIndicators();
        const botMessage = document.createElement("div");
        botMessage.className = "chat-message bot";
        const statsTable = createMarkdownTable(action.body.stats);
        const combinedMarkdown = statsTable + "\n" + action.body.summary;
        botMessage.innerHTML = marked.parse(combinedMarkdown);
        messagesContainer.appendChild(botMessage);
    } else if (action.type === "flag_issue") {
        freezeDecisionIndicators();
        const { issue, summary } = action.body;
        const botMessage = document.createElement("div");
        botMessage.className = "chat-message bot";
        botMessage.style.margin = "8px 0";
        const header = document.createElement("div");
        header.className = "flag-issue-header";
        header.style.cursor = "pointer";
        header.style.display = "flex";
        header.style.alignItems = "center";
        const issueTitleContainer = document.createElement("div");
        issueTitleContainer.innerHTML = marked.parseInline(`Detected issue: **${issue}**`);
        issueTitleContainer.style.color = "#950606";
        header.appendChild(issueTitleContainer);
        const arrow = document.createElement("span");
        arrow.className = "material-icons";
        arrow.textContent = "keyboard_arrow_down";
        arrow.style.marginLeft = "auto";
        header.appendChild(arrow);
        const details = document.createElement("div");
        details.className = "flag-issue-details";
        Object.assign(details.style, {
            display: "none",
            marginTop: "5px",
            fontSize: "0.85rem",
            color: "#555",
        });
        details.innerHTML = marked.parse(summary);
        header.addEventListener("click", () => {
            details.style.display = details.style.display === "none" ? "block" : "none";
            arrow.textContent = details.style.display === "none" ? "keyboard_arrow_down" : "expand_less";
        });
        botMessage.appendChild(header);
        botMessage.appendChild(details);
        messagesContainer.appendChild(botMessage);
    }
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
};

/**
 * Initialize sample questions above the chatbot input.
 */
const initSampleQuestions = () => {
    const sampleQuestions = [
        "Can you generate a summary of the logs for me?",
        "Look for any potential issues in the logs",
        "Show me only the errors and warnings",
    ];
    const chatbotForm = document.getElementById("chatbot-form");
    const inputField = document.getElementById("chatbot-input");

    // Create a container for sample questions with extra spacing.
    const sampleContainer = document.createElement("div");
    sampleContainer.id = "sample-questions-container";
    sampleContainer.style.marginBottom = "30px";
    sampleContainer.style.marginTop = "20px";
    sampleContainer.style.textAlign = "center";

    // Create a card for each sample question.
    sampleQuestions.forEach(question => {
        const card = document.createElement("div");
        card.className = "sample-question px-3";

        // Create card body to hold the question text.
        const cardBody = document.createElement("div");
        cardBody.className = "card-body p-2 text-center";
        cardBody.textContent = question;
        card.appendChild(cardBody);

        // When the card is clicked, insert the question into the input field and submit.
        card.addEventListener("click", () => {
            inputField.value = question;
            chatbotForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        });

        sampleContainer.appendChild(card);
    });

    // Insert the sample questions container above the chatbot form.
    chatbotForm.parentNode.insertBefore(sampleContainer, chatbotForm);
};

/**
 * Populate the workspace dropdown with available workspaces.
 */
const populateWorkspaceDropdown = () => {
    const workspaceSelect = document.getElementById("workspace-select");
    workspaceSelect.innerHTML = ""; // Clear existing options.

    for (const ws in workspaces) {
        if (workspaces.hasOwnProperty(ws)) {
            const option = document.createElement("option");
            option.value = ws;
            option.textContent = ws;
            if (ws === currentWorkspace) option.selected = true;
            workspaceSelect.appendChild(option);
        }
    }

    const addOption = document.createElement("option");
    addOption.value = "ADD_NEW_WORKSPACE";
    addOption.textContent = "Add New Workspace...";
    workspaceSelect.appendChild(addOption);
};

/**
 * Populate the chatbot model dropdown with models from the server.
 */
const populateChatbotModelDropdown = async () => {
    const modelSelect = document.getElementById("chatbot-model-select");
    modelSelect.innerHTML = ""; // Clear existing options.
    const response = await fetch(MODELS_ENDPOINT);
    const models = await response.json();

    for (const model of models) {
        const option = document.createElement("option");
        option.value = model;
        option.textContent = model;
        if (model === currentModel) option.selected = true;
        modelSelect.appendChild(option);
    }

    modelSelect.addEventListener("change", (e) => {
        currentModel = e.target.value;
    });
};

/**
 * Populate the chatbot workspace dropdown.
 */
const populateChatbotWorkspaceDropdown = () => {
    const workspaceSelect = document.getElementById("chatbot-workspace-select");
    workspaceSelect.innerHTML = ""; // Clear existing options.

    for (const ws in workspaces) {
        if (workspaces.hasOwnProperty(ws)) {
            const option = document.createElement("option");
            option.value = ws;
            option.textContent = ws;
            if (ws === currentWorkspace) option.selected = true;
            workspaceSelect.appendChild(option);
        }
    }

    const addOption = document.createElement("option");
    addOption.value = "ADD_NEW_WORKSPACE";
    addOption.textContent = "Add New Workspace...";
    workspaceSelect.appendChild(addOption);

    workspaceSelect.addEventListener("change", (e) => {
        if (e.target.value === "ADD_NEW_WORKSPACE") {
            const newWorkspace = prompt("Enter new workspace name:");
            if (newWorkspace) {
                if (!workspaces[newWorkspace]) {
                    workspaces[newWorkspace] = {};
                    localStorage.setItem("workspaces", JSON.stringify(workspaces));
                }
                currentWorkspace = newWorkspace;
                populateChatbotWorkspaceDropdown();
            } else {
                workspaceSelect.value = currentWorkspace;
            }
        } else {
            currentWorkspace = e.target.value;
        }
    });
};

/**
 * Attach listener to the workspace select dropdown.
 */
const attachWorkspaceSelectListener = () => {
    const workspaceSelect = document.getElementById("workspace-select");
    workspaceSelect.addEventListener("change", (e) => {
        if (e.target.value === "ADD_NEW_WORKSPACE") {
            const newWorkspace = prompt("Enter new workspace name:");
            if (newWorkspace) {
                if (!workspaces[newWorkspace]) {
                    workspaces[newWorkspace] = {};
                    localStorage.setItem("workspaces", JSON.stringify(workspaces));
                }
                currentWorkspace = newWorkspace;
                populateWorkspaceDropdown();
                populateChatbotWorkspaceDropdown();
                loadCategoriesModal();
            } else {
                workspaceSelect.value = currentWorkspace;
            }
        } else {
            currentWorkspace = e.target.value;
            loadCategoriesModal();
        }
    });
};

/**
 * Load categories modal with current workspace issues.
 */
const loadCategoriesModal = () => {
    populateWorkspaceDropdown();

    const categoriesRow = document.getElementById("categoriesRow");
    categoriesRow.innerHTML = ""; // Clear existing content.

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
                                <div class="mt-auto d-flex justify-content-end align-items-center" style="gap: 5px;">
                                    <button type="button" class="btn btn-sm btn-outline-danger delete-category-btn btn-circle" data-category="${category}" 
                                            style="width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ff4d4d; color: #ff4d4d;">
                                    <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-outline-primary edit-category-btn btn-circle" style="width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                        <span class="material-symbols-outlined" style="font-size: 18px;">edit</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            categoriesRow.insertAdjacentHTML('beforeend', colHtml);
        }
    }

    let editFromCategories = false;

    document.querySelectorAll(".edit-category-btn").forEach(btn => {
        btn.addEventListener("click", function (event) {
            event.stopPropagation();
            const card = btn.closest(".category-card");
            const categoryName = card.querySelector(".card-title").textContent.trim();
            editFromCategories = true;
            $('#categoriesModal').modal('hide');
            openEditIssueModal(categoryName);
        });
    });

    document.querySelectorAll(".delete-category-btn").forEach(btn => {
        btn.addEventListener("click", function (e) {
            e.stopPropagation();
            const categoryToDelete = btn.dataset.category;
            if (confirm(`Are you sure you want to delete the category "${categoryToDelete}"?`)) {
                delete workspaces[currentWorkspace][categoryToDelete];
                localStorage.setItem("workspaces", JSON.stringify(workspaces));
                loadCategoriesModal();
            }
        });
    });

    $('#issueModal').on('hidden.bs.modal', function () {
        if (editFromCategories) {
            loadCategoriesModal();
            $('#categoriesModal').modal('show');
            editFromCategories = false;
        }
    });
};

/**
 * Initialize keywords section in the issue modal.
 * @param {Object} [existingKeywords] - Existing keywords mapping.
 */
function initKeywordsSection(existingKeywords) {
    const container = document.getElementById("keywords-container");
    container.innerHTML = ""; // clear previous content
    if (existingKeywords) {
        for (const key in existingKeywords) {
            if (existingKeywords.hasOwnProperty(key)) {
                addKeywordRow(key, existingKeywords[key]);
            }
        }
    }
}

/**
 * Add a keyword row to the keywords section.
 * @param {string} [category=""] - The category name.
 * @param {string[]} [keywordsArray=[]] - Array of keywords.
 */
function addKeywordRow(category = "", keywordsArray = []) {
    const container = document.getElementById("keywords-container");

    // Create a row container with a maximum width for centering.
    const row = document.createElement("div");
    row.className = "input-group mb-2 keyword-row";
    row.style.maxWidth = "500px"; // Limit the width for readability
    row.style.margin = "0 auto";  // Center the row horizontally

    // Category input: make it narrower.
    const catInput = document.createElement("input");
    catInput.type = "text";
    catInput.className = "form-control form-control-sm";
    catInput.placeholder = "Group";
    catInput.value = category;
    catInput.style.flex = "0 0 20%";

    // Keywords input: make it take up the rest
    const keyInput = document.createElement("input");
    keyInput.type = "text";
    keyInput.className = "form-control form-control-sm";
    keyInput.placeholder = "Keywords (comma separated)";
    keyInput.value = keywordsArray.join(", ");
    keyInput.style.flex = "0 0 70%";

    // Remove button container: use flex to center the icon.
    const removeBtnWrapper = document.createElement("div");
    removeBtnWrapper.className = "input-group-append";
    removeBtnWrapper.style.display = "flex";
    removeBtnWrapper.style.alignItems = "center";
    removeBtnWrapper.style.justifyContent = "center";
    removeBtnWrapper.style.flex = "1"; // Allow extra space if needed

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-outline-danger btn-sm";
    // Center the icon in the button using flex.
    removeBtn.style.display = "flex";
    removeBtn.style.alignItems = "center";
    removeBtn.style.justifyContent = "center";
    removeBtn.innerHTML = '<span class="material-icons" style="font-size: 18px;">delete</span>';
    removeBtn.addEventListener("click", () => {
        row.remove();
    });
    removeBtnWrapper.appendChild(removeBtn);

    row.appendChild(catInput);
    row.appendChild(keyInput);
    row.appendChild(removeBtnWrapper);
    container.appendChild(row);
}

/**
 * Open the issue modal for editing a category.
 * @param {string} category - The category to edit.
 */
const openEditIssueModal = (category) => {
    const issue = workspaces[currentWorkspace][category];
    document.getElementById("issue-category").value = category;
    document.getElementById("issue-description-input").value = issue.description || "";
    document.getElementById("issue-context").value = issue.context || "";

    // Initialize the dynamic keywords UI with existing keywords.
    initKeywordsSection(issue.keywords);

    document.getElementById("issue-conditions").value = issue.conditions || "";
    document.getElementById("issue-resolution").value = issue.resolution || "";

    window.currentEditingCategory = category;
    $('#categoriesModal').modal('hide');
    $('#issueModal').modal('show');
};

/**
 * Handle submission of the issue form.
 * @param {Event} event - Form submission event.
 */
const handleSubmitIssue = (event) => {
    event.preventDefault();

    const form = document.getElementById("issue-form");
    const newCategory = document.getElementById("issue-category").value.trim();
    const description = document.getElementById("issue-description-input").value.trim();
    const context = document.getElementById("issue-context").value.trim();
    const conditions = document.getElementById("issue-conditions").value.trim();
    const resolution = document.getElementById("issue-resolution").value.trim();

    // Gather keywords from the dynamic UI.
    const keywords = {};
    const rows = document.querySelectorAll("#keywords-container .keyword-row");
    rows.forEach(row => {
        const inputs = row.querySelectorAll("input");
        const key = inputs[0].value.trim();
        const keysStr = inputs[1].value.trim();
        if (key && keysStr) {
            // Split comma-separated keywords and filter out empty entries.
            keywords[key] = keysStr.split(",").map(s => s.trim()).filter(Boolean);
        }
    });

    const issueObj = {
        description,
        context,
        keywords,  // use the built object
        conditions: conditions || null,
        resolution: resolution || null
    };

    if (window.currentEditingCategory) {
        if (window.currentEditingCategory !== newCategory) {
            delete workspaces[currentWorkspace][window.currentEditingCategory];
        }
        workspaces[currentWorkspace][newCategory] = issueObj;
        window.currentEditingCategory = null;
    } else {
        workspaces[currentWorkspace][newCategory] = issueObj;
    }

    localStorage.setItem('workspaces', JSON.stringify(workspaces));
    $('#issueModal').modal('hide');
    form.reset();

    loadCategoriesModal();
    console.log("Updated Workspaces:", workspaces);
};

/**
 * Convert a stats object to a markdown table.
 * @param {Object} stats - Statistics object.
 * @returns {string} Markdown formatted table.
 */
const createMarkdownTable = (stats) => {
    let table = "| Stat | Value |\n";
    table += "| --- | --- |\n";
    for (const [key, value] of Object.entries(stats)) {
        table += `| ${key} | ${Array.isArray(value) ? value.join(", ") : value} |\n`;
    }
    return table;
};
