import { extendFilterGroups } from "./filterGroup";
import { marked } from "marked";
import { allLogs } from "./logService";

const AGENT_ENDPOINT = 'http://localhost:8000/chat_stream';

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

const DEFAULT_WORKSPACES = {
    "Default Workspace": DEFAULT_ISSUES
};

let workspaces = {};
let currentWorkspace = "Default Workspace";
let currentModel = "gpt-4o";

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
                    logs: allLogs
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

// Helper to process streaming response using SSE format.
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

// Helper to start an animated ellipsis on an element.
const startEllipsisAnimation = (element) => {
    let dots = 0;
    const intervalId = setInterval(() => {
        dots = (dots + 1) % 4; // cycles 0, 1, 2, 3
        element.textContent = ".".repeat(dots);
    }, 500);
    // Store the interval id on the element so we can stop it later.
    element.dataset.intervalId = intervalId;
};

// Helper to stop the ellipsis animation.
const stopEllipsisAnimation = (element) => {
    if (element.dataset.intervalId) {
        clearInterval(parseInt(element.dataset.intervalId));
        delete element.dataset.intervalId;
        element.textContent = ""; // Clear the animated text.
    }
};

// Helper to freeze (stop animation on) decision indicators without removing them.
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
};

const processAction = (action, messagesContainer) => {
    if (action.type === "summary_decision") {
        let decisionEl = document.getElementById("decision-message");
        if (!decisionEl) {
            decisionEl = document.createElement("div");
            decisionEl.id = "decision-message";
            decisionEl.className = "chat-message bot thinking";
            decisionEl.style.fontSize = "0.8rem";
            decisionEl.style.padding = "5px 10px";
            decisionEl.style.margin = "8px 0";
            decisionEl.style.backgroundColor = "#ffffff";
            decisionEl.style.border = "1px solid #e0e0e0";
            decisionEl.style.borderRadius = "12px";
            decisionEl.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.1)";

            const header = document.createElement("div");
            header.className = "thinking-header";
            header.style.cursor = "pointer";
            header.style.display = "flex";
            header.style.justifyContent = "space-between";
            header.style.alignItems = "center";

            const titleSpan = document.createElement("span");
            titleSpan.innerHTML = "Agent thinking";
            header.appendChild(titleSpan);

            const ellipsisSpan = document.createElement("span");
            ellipsisSpan.className = "animated-ellipsis";
            header.appendChild(ellipsisSpan);
            startEllipsisAnimation(ellipsisSpan);

            const details = document.createElement("div");
            details.className = "thinking-details";
            details.style.display = "none";
            details.style.marginTop = "8px";
            details.style.fontSize = "0.75rem";
            details.style.color = "#555";
            details.textContent = action.body.explanation;

            header.addEventListener("click", () => {
                details.style.display = details.style.display === "none" ? "block" : "none";
            });

            decisionEl.appendChild(header);
            decisionEl.appendChild(details);
            messagesContainer.appendChild(decisionEl);
        } else {
            const details = decisionEl.querySelector(".thinking-details");
            if (details) {
                details.textContent = action.body.explanation;
            }
        }
        // If the decision is false, remove the element after 3 seconds.
        if (!action.body.generate_summary) {
            if (!decisionEl.dataset.removalScheduled) {
                decisionEl.dataset.removalScheduled = "true";
                setTimeout(() => {
                    const el = document.getElementById("decision-message");
                    if (el) {
                        el.remove();
                    }
                }, 3000);
            }
        }
    } else if (action.type === "issue_decision") {
        let decisionEl = document.getElementById("issue-decision-message");
        if (!decisionEl) {
            decisionEl = document.createElement("div");
            decisionEl.id = "issue-decision-message";
            decisionEl.className = "chat-message bot thinking";
            decisionEl.style.fontSize = "0.8rem";
            decisionEl.style.padding = "5px 10px";
            decisionEl.style.margin = "8px 0";
            decisionEl.style.backgroundColor = "#ffffff";
            decisionEl.style.border = "1px solid #e0e0e0";
            decisionEl.style.borderRadius = "12px";
            decisionEl.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.1)";

            const header = document.createElement("div");
            header.className = "thinking-header";
            header.style.cursor = "pointer";
            header.style.display = "flex";
            header.style.justifyContent = "space-between";
            header.style.alignItems = "center";

            const titleSpan = document.createElement("span");
            titleSpan.innerHTML = "Evaluating issues";
            header.appendChild(titleSpan);

            const ellipsisSpan = document.createElement("span");
            ellipsisSpan.className = "animated-ellipsis";
            header.appendChild(ellipsisSpan);
            startEllipsisAnimation(ellipsisSpan);

            const details = document.createElement("div");
            details.className = "thinking-details";
            details.style.display = "none";
            details.style.marginTop = "8px";
            details.style.fontSize = "0.75rem";
            details.style.color = "#555";
            details.textContent = action.body.explanation;

            header.addEventListener("click", () => {
                details.style.display = details.style.display === "none" ? "block" : "none";
            });

            decisionEl.appendChild(header);
            decisionEl.appendChild(details);
            messagesContainer.appendChild(decisionEl);
        } else {
            const details = decisionEl.querySelector(".thinking-details");
            if (details) {
                details.textContent = action.body.explanation;
            }
        }
        if (!action.body.evaluate_issues) {
            if (!decisionEl.dataset.removalScheduled) {
                decisionEl.dataset.removalScheduled = "true";
                setTimeout(() => {
                    const el = document.getElementById("issue-decision-message");
                    if (el) {
                        el.remove();
                    }
                }, 3000);
            }
        }
    } else if (action.type === "filter_decision") {
        let decisionEl = document.getElementById("filter-decision-message");
        if (!decisionEl) {
            decisionEl = document.createElement("div");
            decisionEl.id = "filter-decision-message";
            decisionEl.className = "chat-message bot thinking";
            decisionEl.style.fontSize = "0.8rem";
            decisionEl.style.padding = "5px 10px";
            decisionEl.style.margin = "8px 0";
            decisionEl.style.backgroundColor = "#ffffff";
            decisionEl.style.border = "1px solid #e0e0e0";
            decisionEl.style.borderRadius = "12px";
            decisionEl.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.1)";

            const header = document.createElement("div");
            header.className = "thinking-header";
            header.style.cursor = "pointer";
            header.style.display = "flex";
            header.style.justifyContent = "space-between";
            header.style.alignItems = "center";

            const titleSpan = document.createElement("span");
            titleSpan.innerHTML = "Filter Decision";
            header.appendChild(titleSpan);

            const ellipsisSpan = document.createElement("span");
            ellipsisSpan.className = "animated-ellipsis";
            header.appendChild(ellipsisSpan);
            startEllipsisAnimation(ellipsisSpan);

            const details = document.createElement("div");
            details.className = "thinking-details";
            details.style.display = "none";
            details.style.marginTop = "8px";
            details.style.fontSize = "0.75rem";
            details.style.color = "#555";
            details.textContent = action.body.explanation;

            header.addEventListener("click", () => {
                details.style.display = details.style.display === "none" ? "block" : "none";
            });

            decisionEl.appendChild(header);
            decisionEl.appendChild(details);
            messagesContainer.appendChild(decisionEl);
        } else {
            const details = decisionEl.querySelector(".thinking-details");
            if (details) {
                details.textContent = action.body.explanation;
            }
        }
        // At this point, once the decision is set, stop the animated ellipsis.
        const ellipsisSpan = decisionEl.querySelector(".animated-ellipsis");
        if (ellipsisSpan) {
            stopEllipsisAnimation(ellipsisSpan);
        }
        // If the filter decision is false, schedule removal.
        if (!action.body.should_add_filter) {
            if (!decisionEl.dataset.removalScheduled) {
                decisionEl.dataset.removalScheduled = "true";
                setTimeout(() => {
                    const el = document.getElementById("filter-decision-message");
                    if (el) {
                        el.remove();
                    }
                }, 3000);
            }
        }
    } else if (action.type === "add_filter") {
        freezeDecisionIndicators();
        if (action.body.filter_group) {
            // Call the function to extend filter groups.
            extendFilterGroups([action.body.filter_group]);
            const filterGroup = action.body.filter_group;
            // Build a markdown string to nicely display the filter group.
            let markdownContent = `**Added Filter Group**\n: ${filterGroup.title}\n\n`;
            markdownContent += `_${filterGroup.description}_\n\n`;
            if (filterGroup.filters && filterGroup.filters.length > 0) {
                markdownContent += `| Text | Description |\n`;
                markdownContent += `| ---- | ----------- |\n`;
                filterGroup.filters.forEach(filter => {
                    markdownContent += `| <span style="background-color: ${filter.color}; padding: 2px 4px;">${filter.text}</span> | ${filter.description} |\n`;
                });
            }
            const botMessage = document.createElement("div");
            botMessage.className = "chat-message bot";
            botMessage.innerHTML = marked.parse(markdownContent);
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
        const { issue, summary, resolution } = action.body;
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
        details.style.display = "none";
        details.style.marginTop = "5px";
        details.style.fontSize = "0.85rem";
        details.style.color = "#555";
        details.innerHTML = marked.parse(summary);
        header.addEventListener("click", () => {
            if (details.style.display === "none") {
                details.style.display = "block";
                arrow.textContent = "expand_less";
            } else {
                details.style.display = "none";
                arrow.textContent = "expand_more";
            }
        });
        botMessage.appendChild(header);
        botMessage.appendChild(details);
        messagesContainer.appendChild(botMessage);
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
};

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

const populateChatbotModelDropdown = () => {
    const modelSelect = document.getElementById("chatbot-model-select");
    modelSelect.innerHTML = ""; // Clear existing options.

    const models = ["gpt-4o", "granite-3.2-2b"];
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

// Initialize the keywords section. Pass an object if editing an existing category.
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

// Helper function to convert stats dictionary to markdown table
const createMarkdownTable = (stats) => {
    let table = "| Stat | Value |\n";
    table += "| --- | --- |\n";
    for (const [key, value] of Object.entries(stats)) {
        table += `| ${key} | ${Array.isArray(value) ? value.join(", ") : value} |\n`;
    }
    return table;
};
