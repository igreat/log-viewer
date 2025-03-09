import './styles.scss';
import {
    handleFileUploadLocal,
    uploadLogsToDatabase,
    ROWS_PER_PAGE,
    loadLogFilesModal
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

document.addEventListener("DOMContentLoaded", initializeApp);