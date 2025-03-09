import { highlightText } from './utils.js';
import { isWithinDate } from './search.js';

export const ROWS_PER_PAGE = 100; // TODO: make this user configurable

export let allLogs = [];

// Add unique IDs to logs locally for table rendering.
export const getLogsWithIds = (logs) =>
    logs.map((log, index) => ({ id: index + 1, ...log }));

// Dropdown setup
export const setupLogFileDropdown = () => {
    const logfileOptions = document.getElementById("dropdown-log-file-options");
    const logfileMenu = document.getElementById("dropdown-logfiles");

    logfileOptions.addEventListener("click", (e) => {
        const isExpanded = logfileOptions.getAttribute("aria-expanded") === "true";
        // Toggle the dropdown menu
        logfileMenu.style.display = isExpanded ? "none" : "block";
        logfileOptions.setAttribute("aria-expanded", !isExpanded);
        // Prevent dropdown from closing immediately when clicked
        e.stopPropagation();
    });

    logfileMenu.addEventListener("click", (e) => {
        e.stopPropagation();
    });

    document.addEventListener("click", (event) => {
        if (
            !logfileOptions.contains(event.target) &&
            !logfileMenu.contains(event.target)
        ) {
            logfileMenu.style.display = "none";
            logfileOptions.setAttribute("aria-expanded", "false");
        }
    });
};

// Populate the log file dropdown by retrieving log IDs from the server.
export const populateLogFileDropdown = () => {
    const dropdownMenu = document.getElementById("dropdown-logfiles");
    dropdownMenu.innerHTML = '';

    // Fetch the list of log IDs from the server.
    fetch('http://localhost:8000/table')
        .then((response) => {
            if (!response.ok) {
                throw new Error("Failed to fetch log IDs");
            }
            return response.json();
        })
        .then((data) => {
            // Assume that the response is an array of log IDs.
            data.forEach((id) => {
                // Create container for each log item and delete button.
                let itemContainer = document.createElement("div");
                itemContainer.classList.add("dropdown-item-container", "d-flex", "justify-content-between", "align-items-center");

                // Create log item.
                let option = document.createElement("a");
                option.classList.add("dropdown-item", "flex-grow-1");
                option.innerHTML = "LOG: " + id;
                option.id = id;

                // Create delete button.
                let deleteButton = document.createElement("button");
                deleteButton.classList.add("btn", "btn-sm", "btn-danger", "ml-2");
                deleteButton.innerHTML = "×";
                deleteButton.dataset.logId = id;
                deleteButton.addEventListener("click", (e) => {
                    e.stopPropagation(); // Prevent dropdown item from being clicked
                    deleteLogFile(e.target.dataset.logId);
                });

                // Append elements to container.
                itemContainer.appendChild(option);
                itemContainer.appendChild(deleteButton);

                // Add container to dropdown menu.
                dropdownMenu.appendChild(itemContainer);
            });
        })
        .catch((err) => {
            console.error("Error fetching log IDs:", err);
        });
};

// Function to handle log deletion.
const deleteLogFile = (id) => {
    console.log(`Deleting log file with ID: ${id}`);
    fetch(`http://localhost:8000/table/${id}`, {
        method: "DELETE"
    })
        .then((response) => {
            if (response.ok) {
                // Simply refresh the dropdown after deletion.
                populateLogFileDropdown();
            } else {
                console.error("Failed to delete log file:", response.status);
            }
        })
        .catch(error => {
            console.error("Error in deleting log file:", error);
        });
};

export const renderTable = (logs, id = "filtered-logs", filters = []) => {
    const tableContainer = document.getElementById(id + "-table");
    const paginationContainer = document.getElementById(id + "-pagination");

    if (logs.length === 0) {
        tableContainer.innerHTML = `<p class="text-muted">No logs match your search criteria.</p>`;
        paginationContainer.innerHTML = "";
        return;
    }

    // MAIN TABLE
    const headers = Object.keys(logs[0]);
    tableContainer.innerHTML = `
        <table class="table table-striped table-bordered text-nowrap small" id="${id}-table">
        <thead class="table-dark">
            <tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr>
        </thead>
        <tbody>
            ${logs.map(log => `
            <tr id="log-${log.id}">
                ${headers.map(header => `<td>${highlightText(String(log[header]), filters)}</td>`).join('')}
            </tr>
            `).join('')}
        </tbody>
        </table>
        <div id="pagination-${id}" class="pagination-container mt-2"></div>
    `;

    // TABLE PAGINATION
    const rowsPerPage = ROWS_PER_PAGE;
    const $rows = $(`#${id}-table tbody tr`);
    const totalRows = $rows.length;

    if (totalRows > rowsPerPage) {
        const numPages = Math.ceil(totalRows / rowsPerPage);
        let currentPage = 0;

        function updatePageDisplay(page) {
            currentPage = page;
            $rows.hide().slice(page * rowsPerPage, (page + 1) * rowsPerPage).show();

            const navhtml = `
                <div class="pagination-controls text-center">
                <button class="btn btn-secondary prev-page" ${page === 0 ? "disabled" : ""}>Previous</button>
                <input type="number" class="page-input" value="${page + 1}" min="1" max="${numPages}" 
                        style="width: 60px; text-align: center; margin: 0 10px;">
                <span>of ${numPages}</span>
                <button class="btn btn-secondary next-page" ${page === numPages - 1 ? "disabled" : ""}>Next</button>
                </div>
            `;

            $(paginationContainer).html(navhtml);

            $(paginationContainer).find(".prev-page").off("click").on("click", function (e) {
                e.preventDefault();
                if (currentPage > 0) {
                    updatePageDisplay(currentPage - 1);
                }
            });

            $(paginationContainer).find(".next-page").off("click").on("click", function (e) {
                e.preventDefault();
                if (currentPage < numPages - 1) {
                    updatePageDisplay(currentPage + 1);
                }
            });

            $(paginationContainer).find(".page-input").off("change").on("change", function (e) {
                let newPage = parseInt($(this).val(), 10);
                if (isNaN(newPage) || newPage < 1) {
                    newPage = 1;
                } else if (newPage > numPages) {
                    newPage = numPages;
                }
                updatePageDisplay(newPage - 1);
            });
        }

        if (id === "all-logs") {
            window.allLogsPageUpdater = updatePageDisplay;
        }
        updatePageDisplay(0);
    } else {
        $(paginationContainer).html('');
        $rows.show();
        if (id === "all-logs") {
            window.allLogsPageUpdater = null;
        }
    }
};

export const applyFilters = (filters) => {
    const filteredLogs = allLogs.filter((log) => {
        if (!isWithinDate(log)) return false;
        if (filters.length === 0) return true;
        return filters.some(({ regex, caseSensitive, text }) => {
            return Object.values(log).some((value) => {
                const strValue = String(value);
                if (regex) {
                    const pattern = new RegExp(text, caseSensitive ? '' : 'i');
                    return pattern.test(strValue);
                }
                return caseSensitive
                    ? strValue.includes(text)
                    : strValue.toLowerCase().includes(text.toLowerCase());
            });
        });
    });

    renderTable(allLogs, "all-logs", filters);
    renderTable(filteredLogs, "filtered-logs", filters);
};

export const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            // Validate the data is an array.
            if (!Array.isArray(data)) {
                alert("Invalid file format: JSON must be an array of logs.");
                return;
            }

            // Update logs and render tables.
            allLogs = getLogsWithIds(data);
            renderTable(allLogs, "all-logs");
            renderTable(allLogs, "filtered-logs");

            // Generate a new ID for the log file.
            let id = crypto.randomUUID(); // Using crypto.randomUUID() is enough for uniqueness.

            // Send data to the backend.
            fetch(`http://localhost:8000/table/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })
                .then((response) => {
                    if (!response.ok) throw new Error("Data not loaded");
                    return response.json();
                })
                .then((data) => {
                    console.log("Elastic Search response:", data);
                    // Refresh the dropdown after a successful upload.
                    populateLogFileDropdown();
                    loadLogs();
                })
                .catch((error) => {
                    console.error("Upload failed:", error);
                });
        } catch (error) {
            alert("Error parsing the JSON file. Please upload a valid JSON file.");
        }
    };
    reader.readAsText(file);
};

export const handleFileLoad = (id) => {
    console.log("Loading file with ID:", id);
    fetch(`http://localhost:8000/table/${id}`, {
        method: "GET"
    })
        .then(response => {
            console.log("Response status:", response.status);
            return response.json();
        })
        .then(data => {
            console.log("Full response data:", data);
            if (!data) {
                throw new Error("No data received from server");
            }
            const logs = data.logs || data || [];
            console.log("Logs extracted:", logs);
            if (!Array.isArray(logs)) {
                document.getElementById("filtered-logs").innerHTML = `<p class="text-danger">Invalid log format. Expected array but got ${typeof logs}.</p>`;
                return;
            }
            allLogs = getLogsWithIds(logs);
            renderTable(allLogs, "all-logs");
            renderTable(allLogs, "filtered-logs");
        })
        .catch(err => {
            console.error("Failed to load logs:", err);
            document.getElementById("filtered-logs").innerHTML = `<p class="text-danger">Failed to load logs: ${err.message}</p>`;
        });
};

export const loadLogs = () => {
    const dropdownFiles = document.getElementById("dropdown-logfiles");
    const options = dropdownFiles.querySelectorAll("a");
    options.forEach((item) => {
        item.addEventListener("click", function (event) {
            event.preventDefault();
            handleFileLoad(this.id);
        });
    });
};
