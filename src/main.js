import './styles.scss';

$(document).ready(function () {
  let allLogs = []; 

  $("#app").html(`
    <div class="container mt-5">
      <!-- Log Viewer Section -->
      <div class="row justify-content-center">
        <div class="col-md-10">
          <h2 class="mb-4">Logs</h2>
          <!-- Filters bar: for now simply a text input that will filter records if they contain the input text -->
          <div class="mb-3">
            <input type="text" id="log-search" class="form-control" placeholder="Search logs...">
          </div>

          <!-- Log Viewer -->
          <div id="log-viewer" class="border p-3 rounded" style="background-color: #f8f9fa; max-height: 500px; overflow-y: auto;">
            <!-- Logs will be displayed here -->
          </div>
        </div>
      </div>
    </div>
  `);

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

  const loadLogs = () => {
    $.ajax({
      url: '../logs.json', // Ensure the correct path to logs.json
      dataType: 'json',
      success: function(data) {
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
      error: function(xhr, status, error) {
        console.error("Failed to load logs:", error);
        $("#log-viewer").html(`
          <p class="text-danger">Failed to load logs.</p>
        `);
      }
    });
  };

  const filterLogs = (query) => {
    // If query is empty, show all logs
    if (!query) {
      renderTable(allLogs);
      return;
    }

    // Convert query to lowercase for case-insensitive search
    const lowerCaseQuery = query.toLowerCase();

    // Filter logs where any field contains the query text
    const filtered = allLogs.filter(log => {
      return Object.values(log).some(value => 
        String(value).toLowerCase().includes(lowerCaseQuery)
      );
    });

    // Render the filtered logs
    renderTable(filtered);
  };

  // Attach event listener to the search input for real-time filtering
  $("#log-search").on("input", function() {
    const query = $(this).val();
    filterLogs(query);
  });

  loadLogs();
});
