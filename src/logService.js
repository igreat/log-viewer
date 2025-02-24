import { highlightText } from './utils.js';
import { isWithinDate } from './search.js'

export const ROWS_PER_PAGE = 100; // TODO: make this user configurable

export let allLogs = [];

export const getLogsWithIds = (logs) => logs.map((log, index) => ({ id: index + 1, ...log }));

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

    // only paginate if there are more than one page
    if (totalRows > rowsPerPage) {
        const numPages = Math.ceil(totalRows / rowsPerPage);
        let currentPage = 0;

        function updatePageDisplay(page) {
            currentPage = page;

            // show only rows for current page
            $rows.hide().slice(page * rowsPerPage, (page + 1) * rowsPerPage).show();

            // build the navigation bar html
            const navhtml = `
                <div class="pagination-controls text-center">
                <button class="btn btn-secondary prev-page" ${page === 0 ? "disabled" : ""}>Previous</button>
                <input type="number" class="page-input" value="${page + 1}" min="1" max="${numPages}" 
                        style="width: 60px; text-align: center; margin: 0 10px;">
                <span>of ${numPages}</span>
                <button class="btn btn-secondary next-page" ${page === numPages - 1 ? "disabled" : ""}>Next</button>
                </div>
            `
            // render the navigation bar
            $(paginationContainer).html(navhtml);

            // Attach click handler for Previous button.
            $(paginationContainer).find(".prev-page").off("click").on("click", function (e) {
                e.preventDefault();
                if (currentPage > 0) {
                    updatePageDisplay(currentPage - 1);
                }
            });

            // Attach click handler for Next button.
            $(paginationContainer).find(".next-page").off("click").on("click", function (e) {
                e.preventDefault();
                if (currentPage < numPages - 1) {
                    updatePageDisplay(currentPage + 1);
                }
            });

            // Attach change handler for the page number input.
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

        // If this is the full table, expose the updater globally.
        if (id === "all-logs") {
            window.allLogsPageUpdater = updatePageDisplay;
        }

        // initialize the first page
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

            // Validate the data is an array
            if (!Array.isArray(data)) {
                alert("Invalid file format: JSON must be an array of logs.");
                return;
            }

            // Update allLogs and render the table
            allLogs = getLogsWithIds(data);
            renderTable(allLogs, "all-logs");
            renderTable(allLogs, "filtered-logs");
        } catch (error) {
            alert("Error parsing the JSON file. Please upload a valid JSON file.");
        }
    };
    reader.readAsText(file);
};

export const loadLogs = () => {
    fetch('../logs.json')
        .then(response => response.json())
        .then(data => {
            if (!Array.isArray(data)) {
                document.getElementById("filtered-logs").innerHTML = `<p class="text-danger">Invalid log format.</p>`;
                return;
            }
            allLogs = getLogsWithIds(data);
            renderTable(allLogs, "all-logs");
            renderTable(allLogs, "filtered-logs");
        })
        .catch(err => {
            console.error("Failed to load logs:", err);
            document.getElementById("filtered-logs").innerHTML = `<p class="text-danger">Failed to load logs.</p>`;
        });
};