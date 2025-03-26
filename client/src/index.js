import './styles.scss';
import {
    handleFileUploadLocal,
    uploadLogsToDatabase,
    ROWS_PER_PAGE,
    loadLogFilesModal,
    renderTable,
} from './logService.js';
import {
    populateFilterGroups,
    setupDropdown,
    addFilterGroup,
    saveFilterGroup,
    initFilterGroups
} from './filterGroup.js';
import { initSearch } from './search.js';
import { initChatbot } from './agent.js';
import Split from 'split.js';

/**
 * Initializes the application by setting up event listeners and rendering the initial table.
 */
const initializeApp = () => {
    // --- Initialize Local Storage State for Filter Groups ---
    initFilterGroups();

    // --- File Upload Listener ---
    const logFileInput = document.getElementById("log-file-input");
    logFileInput.value = '';
    logFileInput.addEventListener("change", handleFileUploadLocal);

    // --- Upload to Database Button Listener ---
    const uploadBtn = document.getElementById("upload-to-database-btn");
    uploadBtn.addEventListener("click", uploadLogsToDatabase);

    // --- Search Input Listeners ---
    initSearch();

    // --- Initialize Split Pane ---
    // Initialize the vertical split-pane with Split.js.
    Split(['#all-logs-pane', '#filtered-logs-pane'], {
        direction: 'vertical',
        sizes: [33, 67],
        gutterSize: 15,
        minSize: 0,
        gutter: (index, direction) => {
            const gutter = document.createElement('div');
            gutter.className = `gutter gutter-${direction}`;
            // Increase the actual height for a larger click area
            gutter.style.height = '15px';
            gutter.style.cursor = 'row-resize';
            gutter.style.position = 'relative';

            // Create a child element to show only a 10px line centered vertically
            const line = document.createElement('div');
            line.style.position = 'absolute';
            line.style.top = '50%';
            line.style.left = '0';
            line.style.right = '0';
            line.style.height = '10px';
            line.style.backgroundColor = '#ccc';
            line.style.transform = 'translateY(-50%)';

            gutter.appendChild(line);
            return gutter;
        }
    });

    // -- Render Table ---
    renderTable([], "all-logs");
    renderTable([], "filtered-logs");

    // --- Add Filter Group Modal Setup ---
    const addFilterGroupBtn = document.getElementById("add-filter-group-btn");
    console.log(addFilterGroupBtn);
    addFilterGroupBtn.addEventListener("click", () => {
        // Set modal title and clear previous values
        document.querySelector("#filterGroupModal .modal-title").textContent = "Add Custom Filter Group";
        document.getElementById("filter-group-title").value = '';
        document.getElementById("filter-group-description").value = '';
        document.getElementById("filter-list").innerHTML = '';

        // Add one default filter input row
        addFilterGroup();

        // Set up modal footer buttons
        const modalFooter = document.querySelector("#filterGroupModal .modal-footer");
        modalFooter.innerHTML = `
            <div class="d-flex justify-content-between w-100 align-items-center">
                <button type="button" id="add-filter-btn" class="btn btn-primary">Add Filter</button>
                <button type="button" id="save-filter-group-btn" class="btn btn-success">Save</button>
            </div>
        `;
        document.getElementById("add-filter-btn").addEventListener("click", addFilterGroup);
        document.getElementById("save-filter-group-btn").onclick = () => saveFilterGroup();

        // Show the modal (using jQuery for Bootstrap modal)
        $('#filterGroupModal').modal('show');
    });

    // --- Log File Dropdown Setup ---
    const viewLogFilesBtn = document.getElementById("view-log-files-btn");
    viewLogFilesBtn.addEventListener("click", loadLogFilesModal);

    // --- Delegate Remove-Filter Button in Modal ---
    document.getElementById("filter-list").addEventListener("click", (e) => {
        if (e.target.classList.contains("remove-filter-btn")) {
            const inputGroup = e.target.closest(".input-group");
            if (inputGroup) inputGroup.remove();
            e.stopPropagation();
        }
    });

    // --- Initialize Chatbot ---
    initChatbot();

    // --- Filtered Logs Table Row Click Behavior ---
    const filteredTable = document.getElementById("filtered-logs-table");
    if (filteredTable) {
        filteredTable.addEventListener("click", (e) => {
            // Ensure we get the row element even if a child element is clicked.
            const clickedRow = e.target.closest("tr");
            if (clickedRow && clickedRow.id) {
                const rowId = clickedRow.id; // Expected format "log-<number>"
                const rowNum = parseInt(rowId.replace("log-", ""), 10);
                const targetPage = Math.floor((rowNum - 1) / ROWS_PER_PAGE);

                // If available, update the full logs table pagination to display the proper page.
                if (window.allLogsPageUpdater) {
                    window.allLogsPageUpdater(targetPage);
                }

                // After a brief delay, scroll the corresponding row into view and highlight it.
                setTimeout(() => {
                    const fullRow = document.querySelector(`#all-logs-table tr#${rowId}`);
                    if (fullRow) {
                        fullRow.scrollIntoView({ behavior: "smooth", block: "center" });
                        fullRow.classList.add("highlight");
                        setTimeout(() => fullRow.classList.remove("highlight"), 2000);
                    }
                }, 150);
            }
        });
    }

    // --- Final Initialization Steps ---
    // Set up dropdown behavior for filter groups and then populate them.
    setupDropdown();
    populateFilterGroups();
}

// Initialize the application when the DOM is fully loaded.
document.addEventListener("DOMContentLoaded", initializeApp);