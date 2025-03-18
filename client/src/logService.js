import { highlightText } from './utils.js';
import { isWithinDate } from './search.js';

export const ROWS_PER_PAGE = 100; // TODO: make this user configurable

export let allLogs = [];

// Module-level variable to track ongoing rendering/filtering operations.
let currentOperationToken = { "all-logs": 0, "filtered-logs": 0 };

// Add unique IDs to logs locally for table rendering.
export const getLogsWithIds = (logs) =>
    logs.map((log, index) => ({ id: index + 1, ...log }));

export let currentLogId = null;

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

export const renderHeader = (id = "filtered-logs") => {
    const tableContainer = document.getElementById(id + "-table");
    const paginationContainer = document.getElementById(id + "-pagination");

    if (allLogs.length === 0) {
        console.log("No logs to render.");
        tableContainer.innerHTML = `<div class="empty-placeholder">No logs match your search criteria.</div>`;
        paginationContainer.innerHTML = "";
        return;
    }

    const headers = Object.keys(allLogs[0]);
    // simply render the headers
    const headerHTML = `
        <thead class="table-dark">
            <tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr>
        </thead>
    `;

    tableContainer.innerHTML = `
        <table class="table table-striped table-bordered text-nowrap small" id="${id}-table">
            ${headerHTML}
            <tbody id="${id}-tbody"></tbody>
        </table>
        <div id="pagination-${id}" class="pagination-container m-2"></div>
    `;
};

export const renderPagination = (id = "filtered-logs") => {
    const paginationContainer = document.getElementById(id + "-pagination");
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
                <div class="pagination-controls d-flex align-items-center justify-content-center">
                    <button 
                        class="btn btn-sm btn-secondary prev-page rounded-pill px-3 me-2"
                        ${page === 0 ? "disabled" : ""}
                    >
                        Previous
                    </button>
                    
                    <div class="page-indicator mx-2 d-flex align-items-center">
                        <input 
                            type="number" 
                            class="page-input form-control form-control-sm" 
                            value="${page + 1}" 
                            min="1" 
                            max="${numPages}" 
                            style="width: 50px; text-align: center; -moz-appearance: textfield; appearance: textfield;"
                        >
                        <span class="ms-2">/ ${numPages}</span>
                    </div>
                    
                    <button 
                        class="btn btn-sm btn-secondary next-page rounded-pill px-3 ms-2"
                        ${page === numPages - 1 ? "disabled" : ""}
                    >
                        Next
                    </button>
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

const scheduleChunk = (callback) => {
    if (window.requestIdleCallback) {
        const id = requestIdleCallback(callback);
    } else {
        const id = setTimeout(callback, 0);
    }
};

export const renderChunk = (logs, start, end, id = "filtered-logs", filters = []) => {
    if (logs.length === 0) {
        console.log("No logs to render.");
        return;
    }

    const tbody = document.getElementById(`${id}-tbody`);
    const headers = Object.keys(logs[0]);
    const rows = [];
    for (let i = start; i < end; i++) {
        const log = logs[i];
        rows.push(`
            <tr id="log-${log.id}">
                ${headers.map(header => `<td>${highlightText(String(log[header]), filters)}</td>`).join('')}
            </tr>
        `);
    }
    tbody.insertAdjacentHTML('beforeend', rows.join(''));

    renderPagination(id);
}

export const renderTable = (logs, id = "filtered-logs", filters = []) => {
    // Increment the token to cancel any ongoing operation.
    const token = ++currentOperationToken[id];

    const tableContainer = document.getElementById(id + "-table");
    const paginationContainer = document.getElementById(id + "-pagination");

    // Clear any existing content.
    tableContainer.innerHTML = "";
    paginationContainer.innerHTML = "";
    renderHeader(id);

    const rowsPerPage = ROWS_PER_PAGE;
    const totalRows = logs.length;
    const numChunks = Math.ceil(totalRows / rowsPerPage);
    let chunk = 0;

    function processNextChunk() {
        // If this operation has been canceled, abort further processing.
        console.log(token, currentOperationToken[id]);
        if (token !== currentOperationToken[id]) return;

        if (chunk < numChunks) {
            const start = chunk * rowsPerPage;
            const end = Math.min((chunk + 1) * rowsPerPage, totalRows);
            renderChunk(logs, start, end, id, filters);
            chunk++;
            scheduleChunk(processNextChunk);
        } else {
            // Once all chunks are processed, render pagination if not canceled.
            if (token === currentOperationToken[id]) {
                renderPagination(id);
            }
        }
    }

    processNextChunk();
};


export const applyFilters = (filters) => {
    // Increment token to cancel any ongoing operation.
    const token = ++currentOperationToken["all-logs"];
    currentOperationToken["filtered-logs"] = token;

    // Clear tables and render headers.
    document.getElementById("all-logs-table").innerHTML = "";
    document.getElementById("filtered-logs-table").innerHTML = "";
    renderHeader("all-logs");
    renderHeader("filtered-logs");

    const filteredLogs = [];
    const chunkSize = ROWS_PER_PAGE; // adjust as needed
    let lastFilteredRenderIndex = 0;
    let i = 0;

    function processChunk() {
        // If a new operation has started, cancel this one.
        if (
            token !== currentOperationToken["all-logs"] ||
            token !== currentOperationToken["filtered-logs"]
        )
            return;

        const end = Math.min(i + chunkSize, allLogs.length);
        for (; i < end; i++) {
            const log = allLogs[i];
            if (!isWithinDate(log)) continue;

            // Check filters.
            if (
                filters.length === 0 ||
                filters.some(({ regex, caseSensitive, text }) => {
                    return Object.values(log).some((value) => {
                        const strValue = String(value);
                        if (regex) {
                            const pattern = new RegExp(text, caseSensitive ? "" : "i");
                            return pattern.test(strValue);
                        }
                        return caseSensitive
                            ? strValue.includes(text)
                            : strValue.toLowerCase().includes(text.toLowerCase());
                    });
                })
            ) {
                filteredLogs.push(log);
            }

            // Render chunk for all logs.
            if (i !== 0 && i % ROWS_PER_PAGE === 0) {
                renderChunk(allLogs, i - ROWS_PER_PAGE, i, "all-logs", filters);
            }
            if (filteredLogs.length >= lastFilteredRenderIndex + ROWS_PER_PAGE) {
                renderChunk(
                    filteredLogs,
                    lastFilteredRenderIndex,
                    filteredLogs.length,
                    "filtered-logs",
                    filters
                );
                lastFilteredRenderIndex = filteredLogs.length;
            }
        }

        if (i < allLogs.length) {
            scheduleChunk(processChunk);
        } else {
            // Process any remaining logs that don't fill a full page.
            if (allLogs.length % ROWS_PER_PAGE !== 0) {
                renderChunk(allLogs, allLogs.length - (allLogs.length % ROWS_PER_PAGE), allLogs.length, "all-logs", filters);
            }
            if (filteredLogs.length > lastFilteredRenderIndex) {
                renderChunk(filteredLogs, lastFilteredRenderIndex, filteredLogs.length, "filtered-logs", filters);
            }
        }
    }

    processChunk();
};

export const loadLogFilesModal = () => {
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
                        <div class="card logfile-card h-100">
                            <div class="card-body d-flex flex-column">
                                <div class="logfile-info mb-3 text-center">
                                    <h5 class="card-title mb-1" style="font-weight: 600;">${logFile.title}</h5>
                                    <p class="card-text small text-muted">${logFile.description}</p>
                                    <p class="card-text"><small>ID: ${logFile.id}</small></p>
                                </div>
                                <div class="mt-auto d-flex justify-content-center align-items-center">
                                    <button type="button" class="btn btn-sm btn-outline-danger delete-log-btn" data-log-id="${logFile.id}" style="width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                        <span class="material-symbols-outlined" style="font-size: 20px;">delete</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                logFilesRow.insertAdjacentHTML('beforeend', cardHtml);
            });

            document.querySelectorAll(".logfile-card").forEach(card => {
                card.addEventListener("click", function (e) {
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
            allLogs = getLogsWithIds(data);
            renderTable(allLogs, "all-logs");
            renderTable(allLogs, "filtered-logs");
            console.log("File loaded locally.");
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
            currentLogId = id;
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
            currentLogId = id;
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
