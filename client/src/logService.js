import { highlightText } from './utils.js';
import { isWithinDate } from './search.js';

export const ROWS_PER_PAGE = 100; // TODO: make this user configurable

export let allLogs = [];

// Add unique IDs to logs locally for table rendering.
export const getLogsWithIds = (logs) =>
    logs.map((log, index) => ({ id: index + 1, ...log }));

function countLogs(theLogs) {
  const logCount = theLogs.length;
  document.getElementById('log-count').textContent = logCount;
  document.getElementById('filtered-log-count').textContent = logCount;
}
function countFilteredLogs(theFilteredLogs) {
  const filteredLogs = theFilteredLogs.length;
  document.getElementById('filtered-log-count').textContent = filteredLogs;
}

// Function to handle log deletion.
const deleteLogFile = (id) => {
    console.log(`Deleting log file with ID: ${id}`);
    fetch(`http://localhost:8000/table/${id}`, {
        method: "DELETE"
    })
        .then((response) => {
            if (response.ok) {
                // refresh the log files modal
                loadLogFilesModal();
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
    document.getElementById('log-count').textContent = allLogs.length;
    document.getElementById('filtered-log-count').textContent = allLogs.length;
};

export const loadLogFilesModal = () => {
    // Fetch log file metadata from the backend.
    fetch('http://localhost:8000/table')
        .then((response) => {
            if (!response.ok) {
                throw new Error("Failed to fetch log files");
            }
            return response.json();
        })
        .then((data) => {
            const logFilesRow = document.getElementById("logFilesRow");
            logFilesRow.innerHTML = ""; // Clear previous content

            // Data is expected to be an array of objects: { id, title, description }
            data.forEach((logFile) => {
                const cardHtml = `
                    <div class="col-sm-6 col-md-4 mb-3">
                        <div class="card logfile-card h-100" style="cursor: pointer;">
                            <div class="card-body d-flex flex-column">
                                <div class="logfile-info mb-3">
                                    <h5 class="card-title mb-1">${logFile.title}</h5>
                                    <p class="card-text small text-muted">${logFile.description}</p>
                                    <p class="card-text"><small>ID: ${logFile.id}</small></p>
                                </div>
                                <div class="mt-auto d-flex justify-content-between align-items-center">
                                    <button type="button" class="btn btn-sm btn-outline-danger delete-log-btn" data-log-id="${logFile.id}">
                                        <span class="material-symbols-outlined">delete</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                logFilesRow.insertAdjacentHTML('beforeend', cardHtml);
            });
            countLogs(data);

            // Attach click event listeners to each card and delete button.
            document.querySelectorAll(".logfile-card").forEach(card => {
                card.addEventListener("click", function (e) {
                    // Avoid card click if delete button was pressed.
                    if (e.target.closest(".delete-log-btn")) return;
                    const id = card.querySelector("p.card-text small").textContent.replace("ID: ", "").trim();
                    handleFileLoad(id);
                });
            });

            document.querySelectorAll(".delete-log-btn").forEach(btn => {
                btn.addEventListener("click", function (e) {
                    e.stopPropagation();
                    const logId = btn.dataset.logId;
                    deleteLogFile(logId);
                });
            });

            // Finally, show the modal.
            $('#logFilesModal').modal('show');
        })
        .catch((err) => {
            console.error("Error fetching log files:", err);
        });
};

// Reads file locally (parses, renders, and saves logs in 'allLogs').
export const handleFileUploadLocal = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data)) {
                alert("Invalid file format: JSON must be an array of logs.");
                return;
            }
            countLogs(data);
            allLogs = getLogsWithIds(data);
            renderTable(allLogs, "all-logs");
            renderTable(allLogs, "filtered-logs");
            console.log("File loaded locally.");
            document.getElementById('log-count').textContent = allLogs.length;
            document.getElementById('filtered-log-count').textContent = allLogs.length;
        } catch (error) {
            alert("Error parsing the JSON file. Please upload a valid JSON file.");
        }
    };
    reader.readAsText(file);
};

// Uploads the logs (with title and description) to the backend.
export const uploadLogsToDatabase = () => {
    if (!allLogs.length) {
        alert("No logs loaded locally. Please load a file first.");
        return;
    }
    // Prompt user for title and description (you can later replace these with a proper UI)
    const title = prompt("Enter log title", "TITLE") || "TITLE";
    const description = prompt("Enter log description", "DESCRIPTION") || "DESCRIPTION";
    const id = crypto.randomUUID();

    // Build payload: logs plus metadata.
    const payload = {
        logs: allLogs.map(log => log), // or strip out local IDs if necessary
        title: title,
        description: description
    };

    fetch(`http://localhost:8000/table/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    })
        .then((response) => {
            if (!response.ok) throw new Error("Data not loaded");
            return response.json();
        })
        .then((data) => {
            console.log("Elastic Search response:", data);
        })
        .catch((error) => {
            console.error("Upload failed:", error);
        });
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
