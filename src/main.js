import './styles.scss';

$(document).ready(function() {
  $("#app").html(`
    <div class="container mt-5">
      <!-- Log Viewer Section -->
      <div class="row justify-content-center">
        <div class="col-md-10">
          <h2 class="mb-4">Logs</h2>
          <div id="log-viewer" class="border p-3 rounded" style="background-color: #f8f9fa; max-height: 500px; overflow-y: auto;">
            <!-- Logs will be displayed here -->
          </div>
        </div>
      </div>
    </div>
  `);

  // load and display logs
  const loadLogs = () => {
    $.ajax({
      url: '../logs.json',
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

        // Dynamically generate table headers based on keys of the first object
        const headers = Object.keys(data[0]);
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
        data.forEach(log => {
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
      },
      error: function(xhr, status, error) {
        console.error("Failed to load logs:", error);
        $("#log-viewer").html(`
          <p class="text-danger">Failed to load logs.</p>
        `);
      }
    });
  };

  loadLogs();
});
