import './styles.scss';

$(document).ready(function () {
  let allLogs = [];

  // Filters of shape { regex: boolean, caseSensitive: boolean, text: string }
  let currentFilters = [];

  // Inject HTML content into #app using jQuery with Bootstrap classes
  $("#app").html(`
    <div class="container mt-5">
      <!-- Log Viewer Section -->
      <div class="row justify-content-center">
        <div class="col-md-10">
          <h2 class="mb-4">Logs</h2>
          
          <!-- Filters bar: Search input with Regex and Case Sensitive options -->
          <div class="mb-4">
            <div class="row g-3 align-items-center">
              <!-- Search Input -->
              <div class="col-md-8">
                <input type="text" id="log-search" class="form-control" placeholder="Search logs...">
              </div>
              
              <!-- Use Regex Checkbox -->
              <div class="col-md-2 d-flex align-items-center">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="use-regex">
                  <label class="form-check-label" for="use-regex">
                    Use Regex
                  </label>
                </div>
              </div>
              
              <!-- Case Sensitive Checkbox -->
              <div class="col-md-2 d-flex align-items-center">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="case-sensitive">
                  <label class="form-check-label" for="case-sensitive">
                    Case Sensitive
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Log Viewer -->
          <div id="log-viewer" class="border p-3 rounded" style="background-color: #f8f9fa; max-height: 500px; overflow-y: auto;">
            <!-- Logs will be displayed here -->
            <p class="text-muted">Click "Load Logs" to view log data.</p>
          </div>
        </div>
      </div>
    </div>
  `);

  // Function to render the logs table
  const renderTable = (logs) => {
    // Check if logs array is empty
    if (logs.length === 0) {
      $("#log-viewer").html(`
        <p class="text-muted">No logs match your search criteria.</p>
      `);
      return;
    }

    // Dynamically generate table headers based on keys of the first object
    const headers = Object.keys(logs[0]);
    let tableHeaders = '';
    headers.forEach(header => {
      tableHeaders += `<th scope="col">${header.charAt(0).toUpperCase() + header.slice(1)}</th>`;
    });

    // Start building the table
    let tableHTML = [`
      <table class="table table-striped table-bordered">
        <thead class="table-dark">
          <tr>
            ${tableHeaders}
          </tr>
        </thead>
        <tbody>
    `];

    // Populate table rows
    logs.forEach(log => {
      let row = '<tr>';
      headers.forEach(header => {
        row += `<td>${log[header]}</td>`;
      });
      row += '</tr>';
      tableHTML.push(row);
    });

    tableHTML.push(`
        </tbody>
      </table>
    `);

    // Insert the table into the log viewer
    $("#log-viewer").html(tableHTML.join(''));
  };

  // Function to load and display logs
  const loadLogs = () => {
    $.ajax({
      url: '../logs.json', // Ensure the correct path to logs.json
      dataType: 'json',
      success: function (data) {
        // Check if data is an array
        if (!Array.isArray(data)) {
          $("#log-viewer").html(`
            <p class="text-danger">Invalid log format: Expected an array of log entries.</p>
          `);
          return;
        }

        // Check if array is empty
        if (data.length === 0) {
          $("#log-viewer").html(`
            <p class="text-muted">No logs available to display.</p>
          `);
          return;
        }

        // Store all logs
        allLogs = data;

        // Initially render all logs
        renderTable(allLogs);
      },
      error: function (xhr, status, error) {
        console.error("Failed to load logs:", error);
        $("#log-viewer").html(`
          <p class="text-danger">Failed to load logs.</p>
        `);
      }
    });
  };

  // Function to apply all current filters to the logs
  const applyFilters = (filters) => {
    let filteredLogs = allLogs;

    // Iterate over each filter in currentFilters and apply it
    filters.forEach(filter => {
      const { regex, caseSensitive, text } = filter;

      if (regex) {
        let pattern;
        try {
          // Create RegExp object with appropriate flags
          pattern = new RegExp(text, caseSensitive ? '' : 'i');
        } catch (e) {
          console.error("Invalid regex pattern:", e);
          // If regex is invalid, skip this filter
          return;
        }

        // Filter logs using regex
        filteredLogs = filteredLogs.filter(log => {
          return Object.values(log).some(value => pattern.test(String(value)));
        });
      } else {
        // Plain text search
        const searchText = caseSensitive ? text : text.toLowerCase();

        filteredLogs = filteredLogs.filter(log => {
          return Object.values(log).some(value => {
            const field = String(value);
            return caseSensitive ? field.includes(searchText) : field.toLowerCase().includes(searchText);
          });
        });
      }
    });

    // Render the filtered logs
    renderTable(filteredLogs);
  };

  // Function to update currentFilters based on UI inputs
  const updateFilters = () => {
    const searchText = $("#log-search").val();
    const useRegex = $("#use-regex").is(":checked");
    const caseSensitive = $("#case-sensitive").is(":checked");

    // Clear existing filters
    currentFilters = [];

    // If search text is not empty, add it as a filter
    if (searchText.trim() !== "") {
      currentFilters.push({
        regex: useRegex,
        caseSensitive: caseSensitive,
        text: searchText
      });
    }
    console.log(currentFilters);

    // Apply the updated filters
    applyFilters(currentFilters);
  };

  // Attach event listeners to the search input and checkboxes
  $("#log-search").on("input", function () {
    updateFilters();
  });

  $("#use-regex").on("change", function () {
    updateFilters();
  });

  $("#case-sensitive").on("change", function () {
    updateFilters();
  });

  // Load logs on page load
  loadLogs();
});
