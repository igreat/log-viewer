import './styles.scss';

$(document).ready(function () {
  let allLogs = [];

  // Filters of shape { regex: boolean, caseSensitive: boolean, text: string, title: string }
  let currentFilters = [];

  const premadeFilters = [
    { title: 'Error Logs', regex: false, caseSensitive: false, text: 'ERROR' },
    { title: 'User Alice', regex: false, caseSensitive: false, text: 'Alice' },
    { title: 'Info Level', regex: false, caseSensitive: false, text: 'INFO' },
    { title: 'Warnings Starting with "WARN"', regex: true, caseSensitive: false, text: '^WARN' }
  ];

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

          <!-- Premade Filters Multi-Select Dropdown with Checkboxes (Bootstrap 4) -->
          <div class="dropdown">
            <button
              id="premade-filters-dropdown"
              class="btn btn-secondary dropdown-toggle w-100"
              type="button"
              data-toggle="dropdown"
              aria-haspopup="true"
              aria-expanded="false"
            >
              Select Premade Filters
            </button>
            <div
              class="dropdown-menu p-3"
              aria-labelledby="premade-filters-dropdown"
              style="max-height: 300px; overflow-y: auto;"
            >
              <!-- Filters populated via JavaScript -->
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

  $("#premade-filters-dropdown").on("click", function () {
    $(this).next(".dropdown-menu").toggleClass("show");
  });

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

  // Populate the Premade Filters Dropdown with Checkboxes
  const populatePremadeFiltersCheckboxes = () => {
    const $dropdownMenu = $("#premade-filters-dropdown").siblings(".dropdown-menu"); // Select the specific dropdown-menu

    premadeFilters.forEach((filter, index) => {
      const checkboxHTML = `
      <div class="form-check">
        <input class="form-check-input" type="checkbox" value="${index}" id="premade-filter-${index}">
        <label class="form-check-label" for="premade-filter-${index}">
          ${filter.title}
        </label>
      </div>
    `;
      $dropdownMenu.append(checkboxHTML);
    });
  };

  // Handle Premade Filters Checkbox Change
  const handlePremadeFiltersCheckboxChange = () => {
    const selectedIndices = [];
    $("#premade-filters-dropdown").siblings(".dropdown-menu").find("input[type='checkbox']:checked").each(function () {
      selectedIndices.push($(this).val());
    });

    // Add selected premade filters to currentFilters
    currentFilters = [];
    selectedIndices.forEach(index => {
      currentFilters.push(premadeFilters[index]);
    });

    // Display active premade filters (optional enhancement)
    displayActivePremadeFilters(selectedIndices);

    // Apply all current filters
    applyFilters(currentFilters);
  };

  // Function to Display Active Premade Filters (Optional)
  const displayActivePremadeFilters = (selectedIndices) => {
    const $activeFilters = $("#active-premade-filters");
    $activeFilters.empty(); // Clear existing active filters

    if (selectedIndices.length === 0) {
      $activeFilters.html(`<p class="text-muted">No premade filters applied.</p>`);
      return;
    }

    selectedIndices.forEach(index => {
      const filterTitle = premadeFilters[index].title;
      const badge = `<span class="badge badge-primary mr-2">${filterTitle}</span>`;
      $activeFilters.append(badge);
    });
  };

  // Initialize Premade Filters Dropdown and Event Listeners
  const initializePremadeFilters = () => {
    populatePremadeFiltersCheckboxes();

    // Attach change event to the checkboxes within the specific dropdown menu
    $("#premade-filters-dropdown").siblings(".dropdown-menu").find("input[type='checkbox']").on("change", handlePremadeFiltersCheckboxChange);
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

  // Function to update currentFilters based on UI inputs (search input and checkboxes)
  const updateFilters = () => {
    const searchText = $("#log-search").val();
    const useRegex = $("#use-regex").is(":checked");
    const caseSensitive = $("#case-sensitive").is(":checked");

    // If search text is not empty, add it as a new filter
    if (searchText.trim() !== "") {
      currentFilters.push({
        regex: useRegex,
        caseSensitive: caseSensitive,
        text: searchText,
      });
    }
    console.log(currentFilters);

    // Apply all current filters
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

  // Initialize Premade Filters after Document is Ready
  initializePremadeFilters();

  // Load logs on page load
  loadLogs();
});
