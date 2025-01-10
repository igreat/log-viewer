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
let defaultValuesAdded = false;

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
  let filters = window.localStorage.getItem('filters');
  filters = JSON.parse(filters);
  filters.forEach((group, index) => {
    const groupHTML = `
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
    `;
    dropdownMenu.insertAdjacentHTML('beforeend', groupHTML);
  });

  // handle selection of filter groups
  dropdownMenu.addEventListener("change", (event) => {
    if (event.target.classList.contains("form-check-input")) {
      const selectedIndices = Array.from(
        dropdownMenu.querySelectorAll("input:checked")
      ).map(input => parseInt(input.value));
      currentFilters = selectedIndices.flatMap(index => filterGroups[index].filters);
      updateTextFilter(); // in case there is text in the search box
    }
  });
};

const addFilterInput = () => {
  const filterList = document.getElementById("filter-list");
  const filterHTML = `
    <div class="input-group mb-2">
      <input type="text" class="form-control filter-text" placeholder="Filter text">
      <div class="input-group-prepend">
        <div class="input-group-text">
          <input type="checkbox" class="filter-regex" title="Regex"> Regex
        </div>
        <div class="input-group-text">
          <input type="checkbox" class="filter-case-sensitive" title="Case Sensitive"> Case Sensitive
        </div>
      </div>
      <button type="button" class="btn btn-danger remove-filter-btn">Remove</button>
    </div>
  `;
  filterList.insertAdjacentHTML('beforeend', filterHTML);
};

const saveFilterGroup = () => {
  const title = document.getElementById("filter-group-title").value.trim();
  const description = document.getElementById("filter-group-description").value.trim();
  const filters = [];

  // collect all filters
  document.querySelectorAll("#filter-list .input-group").forEach((group) => {
    const text = group.querySelector(".filter-text").value.trim();
    const regex = group.querySelector(".filter-regex").checked;
    const caseSensitive = group.querySelector(".filter-case-sensitive").checked;

    if (text) {
      filters.push({ text, regex, caseSensitive });
    }
  });

  // validate inputs
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

  // add new filter group to filterGroups array
  filterGroups.push({ title, description, filters });
  window.localStorage.setItem('filters', JSON.stringify(filterGroups));
  populateFilterGroups(); // update dropdown
  $('#filterGroupModal').modal('hide'); // close modal
};

const setupDropdown = () => {
  const dropdownButton = document.getElementById("premade-filters-dropdown");
  const dropdownMenu = dropdownButton.nextElementSibling;

  dropdownButton.addEventListener("click", () => {
    const isExpanded = dropdownButton.getAttribute("aria-expanded") === "true";

    // toggle the dropdown menu
    dropdownMenu.classList.toggle("show", !isExpanded);

    // update ARIA attributes for accessibility
    dropdownButton.setAttribute("aria-expanded", !isExpanded);
  });

  // close dropdown if clicked outside
  document.addEventListener("click", (event) => {
    if (!dropdownButton.contains(event.target) && !dropdownMenu.contains(event.target)) {
      dropdownMenu.classList.remove("show");
      dropdownButton.setAttribute("aria-expanded", "false");
    }
  });
};

const initializeApp = () => {
  if (!window.localStorage.getItem('filters')) {
    window.localStorage.setItem('filters', JSON.stringify(filterGroups));
  }
  // attach event listeners for file input
  document.getElementById("log-file-input").value = '';
  document.getElementById("log-file-input").addEventListener("change", handleFileUpload);

  // attach event listeners for text filters
  document.getElementById("log-search").addEventListener("input", updateTextFilter);
  document.getElementById("use-regex").addEventListener("change", updateTextFilter);
  document.getElementById("case-sensitive").addEventListener("change", updateTextFilter);

  // attach event listener for adding filter groups
  document.getElementById("add-filter-group-btn").addEventListener("click", () => {
    document.getElementById("filter-group-title").value = '';
    document.getElementById("filter-group-description").value = '';
    document.getElementById("filter-list").innerHTML = '';
    $('#filterGroupModal').modal('show');
  });

  // attach event listener for dynamically adding filters
  document.getElementById("add-filter-btn").addEventListener("click", addFilterInput);

  // attach event listener for saving filter groups
  document.getElementById("save-filter-group-btn").addEventListener("click", saveFilterGroup);

  // attach event delegation for removing filter rows
  document.getElementById("filter-list").addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-filter-btn")) {
      const inputGroup = e.target.closest(".input-group");
      if (inputGroup) {
        inputGroup.remove();
      }
    }
  });

  // initialize dropdown behavior
  setupDropdown();

  // populate filter groups and load logs
  populateFilterGroups();
  loadLogs();
};

// run the app
initializeApp();
