import './styles.scss';

const filterGroups = [
  {
    title: 'Error Logs',
    description: 'Filters logs containing "ERROR"',
    filters: [{ regex: false, caseSensitive: false, text: 'ERROR' }]
  },
  {
    title: 'User Alice',
    description: 'Filters logs mentioning user Alice',
    filters: [{ regex: false, caseSensitive: false, text: 'Alice' }]
  },
  {
    title: 'ip of shape 192.*.1.2',
    description: 'Filters logs containing ip of shape 192.*.1.2',
    filters: [{ regex: true, caseSensitive: false, text: '192\..*\.1\.2' }]
  }
];

let allLogs = [];
let currentFilters = [];

const renderTable = (logs) => {
  const logViewer = document.getElementById("log-viewer");
  if (logs.length === 0) {
    logViewer.innerHTML = `<p class="text-muted">No logs match your search criteria.</p>`;
    return;
  }

  const headers = Object.keys(logs[0]);
  const tableHTML = `
    <table class="table table-striped table-bordered">
      <thead class="table-dark">
        <tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${logs.map(log => `
          <tr>${headers.map(header => `<td>${log[header]}</td>`).join('')}</tr>
        `).join('')}
      </tbody>
    </table>
  `;

  logViewer.innerHTML = tableHTML;
};

const loadLogs = () => {
  fetch('../logs.json')
    .then(response => response.json())
    .then(data => {
      if (!Array.isArray(data)) {
        document.getElementById("log-viewer").innerHTML = `<p class="text-danger">Invalid log format.</p>`;
        return;
      }
      allLogs = data;
      renderTable(allLogs);
    })
    .catch(err => {
      console.error("Failed to load logs:", err);
      document.getElementById("log-viewer").innerHTML = `<p class="text-danger">Failed to load logs.</p>`;
    });
};

const handleFileUpload = (event) => {
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
      allLogs = data;
      renderTable(allLogs);
    } catch (error) {
      alert("Error parsing the JSON file. Please upload a valid JSON file.");
    }
  };
  reader.readAsText(file);
};

const applyFilters = (filters) => {
  if (filters.length === 0) {
    renderTable(allLogs);
    return;
  }

  let filteredLogs = []
  for (let i = 0; i < allLogs.length; i++) {
    const log = allLogs[i];
    if (filters.some(filter => {
      const { regex, caseSensitive, text } = filter;
      if (regex) {
        const pattern = new RegExp(text, caseSensitive ? '' : 'i');
        return Object.values(log).some(value => pattern.test(String(value)));
      } else {
        const searchText = caseSensitive ? text : text.toLowerCase();
        return Object.values(log).some(value => {
          const fieldValue = String(value);
          return caseSensitive ? fieldValue.includes(searchText) : fieldValue.toLowerCase().includes(searchText);
        });
      }
    })) {
      filteredLogs.push(log);
    };
  }
  renderTable(filteredLogs);
};

const updateTextFilter = () => {
  const text = document.getElementById("log-search").value.trim();
  const regex = document.getElementById("use-regex").checked;
  const caseSensitive = document.getElementById("case-sensitive").checked;

  if (text) {
    applyFilters([...currentFilters, { text, regex, caseSensitive }]);
  } else {
    applyFilters(currentFilters);
  }
}

const populateFilterGroups = () => {
  const dropdownMenu = document.querySelector(".dropdown-menu");
  dropdownMenu.innerHTML = ''; // Clear existing items

  filterGroups.forEach((group, index) => {
    const groupHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <div class="form-check">
          <input
            class="form-check-input"
            type="checkbox"
            id="filter-group-${index}"
            value="${index}"
          >
          <label class="form-check-label" for="filter-group-${index}">
            ${group.title} - ${group.description}
          </label>
        </div>
        <button type="button" class="btn btn-sm btn-primary edit-filter-group-btn" data-index="${index}">
          Edit
        </button>
      </div>
    `;
    dropdownMenu.insertAdjacentHTML('beforeend', groupHTML);
  });

  // Attach event listeners to the checkboxes
  dropdownMenu.querySelectorAll(".form-check-input").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const selectedIndices = Array.from(
        dropdownMenu.querySelectorAll("input:checked")
      ).map(input => parseInt(input.value));
      currentFilters = selectedIndices.flatMap(index => filterGroups[index].filters);
      updateTextFilter(); // Update logs based on active filters
    });
  });

  // Attach event listeners to the Edit buttons
  dropdownMenu.querySelectorAll(".edit-filter-group-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const index = parseInt(event.target.getAttribute("data-index"));
      editFilterGroup(index);
    });
  });
};

function addFilterGroup() {
  const filterList = document.getElementById("filter-list");
  const filterHTML = `
    <div class="input-group mb-2">
      <input type="text" class="form-control filter-text" placeholder="Filter text">
      <div class="input-group-prepend">
        <div class="input-group-text">
          <input type="checkbox" class="filter-regex mr-1" title="Regex"> <span>Regex</span>
        </div>
        <div class="input-group-text">
          <input type="checkbox" class="filter-case-sensitive mr-1" title="Match Case"> <span>Match Case</span>
        </div>
      </div>
      <button type="button" class="btn btn-danger remove-filter-btn">Remove</button>
    </div>
  `;
  filterList.insertAdjacentHTML('beforeend', filterHTML);
}

const editFilterGroup = (index) => {
  const group = filterGroups[index];

  // Set the modal title to "Edit Custom Filter Group"
  document.querySelector("#filterGroupModal .modal-title").textContent = "Edit Custom Filter Group";

  // Populate modal fields with the group's current data
  document.getElementById("filter-group-title").value = group.title;
  document.getElementById("filter-group-description").value = group.description;

  // Clear the filter list and populate it with the group's filters
  const filterList = document.getElementById("filter-list");
  filterList.innerHTML = ""; // Clear existing filters
  group.filters.forEach((filter) => {
    const filterHTML = `
      <div class="input-group mb-2">
        <input type="text" class="form-control filter-text" placeholder="Filter text" value="${filter.text}">
        <div class="input-group-prepend">
          <div class="input-group-text">
            <input type="checkbox" class="filter-regex mr-1" title="Regex" ${filter.regex ? "checked" : ""}> <span>Regex</span>
          </div>
          <div class="input-group-text">
            <input type="checkbox" class="filter-case-sensitive mr-1" title="Match Case" ${filter.caseSensitive ? "checked" : ""}> <span>Match Case</span>
          </div>
        </div>
        <button type="button" class="btn btn-danger remove-filter-btn">Remove</button>
      </div>
    `;
    filterList.insertAdjacentHTML("beforeend", filterHTML);
  });

  // Show the modal and bind the save button to save with the index
  $('#filterGroupModal').modal('show');
  document.getElementById("save-filter-group-btn").onclick = () => saveFilterGroup(index);
};

const saveFilterGroup = (index = null) => {
  const title = document.getElementById("filter-group-title").value.trim();
  const description = document.getElementById("filter-group-description").value.trim();
  const filters = [];

  // Collect all filters
  document.querySelectorAll("#filter-list .input-group").forEach((group) => {
    const text = group.querySelector(".filter-text").value.trim();
    const regex = group.querySelector(".filter-regex").checked;
    const caseSensitive = group.querySelector(".filter-case-sensitive").checked;

    if (text) {
      filters.push({ text, regex, caseSensitive });
    }
  });

  // Validate inputs
  if (!title) {
    alert("Please provide a title for the filter group.");
    return;
  }
  if (!description) {
    alert("Please provide a description for the filter group.");
    return;
  }
  if (filters.length === 0) {
    alert("Please add at least one filter.");
    return;
  }

  //Defines whether the saving pross is for an add or edit process 
  if (index === null) {
    // Add new filter group
    filterGroups.push({ title, description, filters });
  } else {
    // Edit existing filter group
    filterGroups[index] = { title, description, filters };
  }

  // After saving, the filtered output table should should automatically updates without unchecking any boxes for current filtered groups options in the drop down list
  // Preserve the state of selected checkboxes
  const selectedIndices = Array.from(
    document.querySelectorAll(".dropdown-menu .form-check-input:checked")
  ).map((input) => parseInt(input.value));

  // Refresh the dropdown while preserving checked state
  populateFilterGroups();

  // Re-check the previously selected checkboxes
  selectedIndices.forEach((index) => {
    const checkbox = document.querySelector(`#filter-group-${index}`);
    if (checkbox) checkbox.checked = true;
  });

  // Update the current filters and apply them to the table
  currentFilters = selectedIndices.flatMap((index) => filterGroups[index].filters);
  applyFilters(currentFilters);

  // Close the modal
  $('#filterGroupModal').modal('hide');
};

const setupDropdown = () => {
  const dropdownButton = document.getElementById("premade-filters-dropdown");
  const dropdownMenu = dropdownButton.nextElementSibling;

  dropdownButton.addEventListener("click", (event) => {
    const isExpanded = dropdownButton.getAttribute("aria-expanded") === "true";

    // Toggle the dropdown menu
    dropdownMenu.classList.toggle("show", !isExpanded);

    // Update ARIA attributes for accessibility
    dropdownButton.setAttribute("aria-expanded", !isExpanded);

    // Prevent dropdown from closing immediately when clicked
    event.stopPropagation();
  });

  // Prevent dropdown from closing when interacting with its content
  dropdownMenu.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  // Close the dropdown only when clicking outside both the dropdown and modal
  document.addEventListener("click", (event) => {
    if (
      !dropdownButton.contains(event.target) &&
      !dropdownMenu.contains(event.target) &&
      !document.querySelector(".modal").contains(event.target)
    ) {
      dropdownMenu.classList.remove("show");
      dropdownButton.setAttribute("aria-expanded", "false");
    }
  });
};

const initializeApp = () => {
  // Attach event listeners for file input
  document.getElementById("log-file-input").value = '';
  document.getElementById("log-file-input").addEventListener("change", handleFileUpload);

  // Attach event listeners for text filters
  document.getElementById("log-search").addEventListener("input", updateTextFilter);
  document.getElementById("use-regex").addEventListener("change", updateTextFilter);
  document.getElementById("case-sensitive").addEventListener("change", updateTextFilter);

  // Attach event listener for adding new filter groups
  document.getElementById("add-filter-group-btn").addEventListener("click", () => {
    // Set the modal title to "Add Custom Filter Group"
    document.querySelector("#filterGroupModal .modal-title").textContent = "Add Custom Filter Group";

    // Clear modal inputs for creating a new filter group
    document.getElementById("filter-group-title").value = '';
    document.getElementById("filter-group-description").value = '';
    document.getElementById("filter-list").innerHTML = '';

    // Bind saveFilterGroup without index for adding
    document.getElementById("save-filter-group-btn").onclick = () => saveFilterGroup();
    $('#filterGroupModal').modal('show'); // Show the modal
  });

  // Attach event listener for dynamically adding filters in the modal
  document.getElementById("add-filter-btn").addEventListener("click", addFilterGroup);

  // Attach event delegation for removing filter rows in the modal
  document.getElementById("filter-list").addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-filter-btn")) {
      const inputGroup = e.target.closest(".input-group");
      if (inputGroup) {
        inputGroup.remove();
      }
      e.stopPropagation(); // Prevent the event from propagating to other handlers
    }
  });

  // Initialize dropdown behavior for toggling
  setupDropdown();

  // Populate filter groups in the dropdown
  populateFilterGroups();

  // Load logs from the JSON file
  loadLogs();
};

// run the app
initializeApp();
