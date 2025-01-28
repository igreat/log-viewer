import './styles.scss';
import { Trie } from './Trie';
import { Node } from './Trie';

const TOP_K = 5;
const DEFAULT_FILTER_GROUPS = [
  {
    title: 'Error Logs',
    description: 'Filters logs containing "ERROR"',
    filters: [{ regex: false, caseSensitive: false, text: 'ERROR', color: "#ff8282" }]
  },
  {
    title: 'User Alice',
    description: 'Filters logs mentioning user Alice',
    filters: [{ regex: false, caseSensitive: false, text: 'Alice', color: "#ffB6C1" }]
  },
  {
    title: 'ip of shape 192.*.1.2',
    description: 'Filters logs containing ip of shape 192.*.1.2',
    filters: [{ regex: true, caseSensitive: false, text: '192\..*\.1\.2' }]
  }
]

let colorCounter = 0;
const COLORS = [
  "#FFFF99", // Light Yellow
  "#FFD580", // Pale Orange
  "#FFB6C1", // Soft Pink
  "#CCFFCC", // Light Green
  "#ADD8E6", // Sky Blue
  "#FFC0CB", // Pink
  "#FFDAB9", // Peach Puff
  "#FDE74C", // Maize
];

const DEFAULT_HIGHLIGHT_COLOR = "#ffbf00";

let suggestionTrie = new Trie();
let allLogs = [];
let currentFilters = [];
let generalFilter = null // the single search bar filter
let filterGroups = [];

function highlightText(text, filters) {
  let highlighted = text;

  // sort filters by length of text to avoid overlapping highlights
  filters.sort((a, b) => b.text.length - a.text.length);

  filters.forEach(({ text: filterText, regex, caseSensitive, color }) => {
    color = color || DEFAULT_HIGHLIGHT_COLOR; // default to yellow if no color is provided
    if (regex) {
      const pattern = new RegExp(filterText, caseSensitive ? '' : 'i');
      highlighted = highlighted.replace(pattern, (match) => {
        return `<span style="background-color: ${color};">${match}</span>`;
      });
    } else {
      // for safety, escape any special regex characters in the filter text
      const escapedFilterText = filterText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(escapedFilterText, caseSensitive ? '' : 'i');
      highlighted = highlighted.replace(pattern, (match) => {
        return `<span style="background-color: ${color};">${match}</span>`;
      });
    }
  });

  return highlighted;
}

const renderTable = (logs) => {
  const logViewer = document.getElementById("log-viewer");
  if (logs.length === 0) {
    logViewer.innerHTML = `<p class="text-muted">No logs match your search criteria.</p>`;
    return;
  }

  const headers = Object.keys(logs[0]);
  const filters = generalFilter && generalFilter.text ? [generalFilter, ...currentFilters] : currentFilters;
  const tableHTML = `
    <table class="table table-striped table-bordered">
      <thead class="table-dark">
        <tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${logs.map(log => `
          <tr>${headers.map(header => `<td>${highlightText(String(log[header]), filters)}</td>`).join('')}</tr>
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

const updateSearchSuggestions = () => {
  let searchSuggestions = getSearchSuggestions();
  searchSuggestions = searchSuggestions.map(p => p.word);
  console.log("SEARCH SUGGESTIONS: " + searchSuggestions);
  populateSearchSuggestions(searchSuggestions);
}

const updateTextFilter = () => {
  const text = document.getElementById("log-search").value.trim();
  const regex = document.getElementById("use-regex").checked;
  const caseSensitive = document.getElementById("case-sensitive").checked;
  generalFilter = { text, regex, caseSensitive };
  const filters = generalFilter.text ? [...currentFilters, generalFilter] : currentFilters;
  applyFilters(filters);
}

const populateFilterGroups = () => {
  const dropdownMenu = document.querySelector(".dropdown-menu");
  dropdownMenu.innerHTML = ''; // Clear existing items
  filterGroups.forEach((group, index) => {
    const groupHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <div class="form-check flex-grow-1 d-flex">
          <input
            class="form-check-input me-2"
            type="checkbox"
            id="filter-group-${index}"
            value="${index}"
          >
          <label class="form-check-label flex-grow-1" for="filter-group-${index}">
            ${group.title} - ${group.description}
          </label>
        </div>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-sm btn-light edit-filter-group-btn rounded-circle d-flex justify-content-center align-items-center p-1" data-index="${index}">
            <svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
              <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>
            </svg>
          </button>
        </div>
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

  // Attach event listeners to the Delete buttons
  dropdownMenu.querySelectorAll(".delete-filter-group-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const index = parseInt(event.target.getAttribute("data-index"));
      deleteFilterGroup(index);
    });
  });
};

function addFilterGroup() {
  const filterList = document.getElementById("filter-list");
  const filterHTML = `
    <div class="input-group mb-2 d-flex align-items-center">
      <input type="text" class="form-control filter-text" placeholder="Filter text">
      <div class="input-group-prepend mr-2">
        <div class="input-group-text">
          <input type="checkbox" class="filter-regex mr-1" title="Regex"> <span>Regex</span>
        </div>
        <div class="input-group-text">
          <input type="checkbox" class="filter-case-sensitive mr-1" title="Match Case"> <span>Match Case</span>
        </div>
        <div class="input-group-text rounded-right" style="background-color: transparent;">
          <input type="color" class="filter-color" value="${COLORS[colorCounter]}" title="Pick a color">
        </div>
      </div>
      <input type="text" class="form-control filter-description mr-2" placeholder="Filter description">
      <button type="button" class="btn btn-danger remove-filter-btn d-flex justify-content-center align-items-center">
        <svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="white">
          <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/>
        </svg>
      </button>
    </div>
  `;
  colorCounter = (colorCounter + 1) % COLORS.length;
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
      <div class="input-group mb-2 d-flex align-items-center">
        <input type="text" class="form-control filter-text" placeholder="Filter text" value="${filter.text}">
        <div class="input-group-prepend mr-2">
          <div class="input-group-text">
            <input type="checkbox" class="filter-regex mr-1" title="Regex" ${filter.regex ? "checked" : ""}> <span>Regex</span>
          </div>
          <div class="input-group-text">
            <input type="checkbox" class="filter-case-sensitive mr-1" title="Match Case" ${filter.caseSensitive ? "checked" : ""}> <span>Match Case</span>
          </div>
          <div class="input-group-text rounded-right" style="background-color: transparent;">
            <input type="color" class="filter-color" value="${filter.color ? filter.color : DEFAULT_HIGHLIGHT_COLOR}" title="Pick a color">
          </div>
        </div>
        <input type="text" class="form-control filter-description mr-2" placeholder="Filter description" value="${filter.description || ''}">
        <button type="button" class="btn btn-danger remove-filter-btn d-flex justify-content-center align-items-center">
          <svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="white">
            <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/>
          </svg>
        </button>
      </div>
    `;
    filterList.insertAdjacentHTML("beforeend", filterHTML);
  });

  // Set up modal footer buttons
  const modalFooter = document.querySelector("#filterGroupModal .modal-footer");
  modalFooter.innerHTML = `
    <div class="d-flex justify-content-between w-100 align-items-center">
      <button type="button" id="add-filter-btn" class="btn btn-primary">Add Filter</button>
      <div class="d-flex gap-2">
        <button type="button" id="save-filter-group-btn" class="btn btn-success">Save</button>
        <button type="button" id="delete-filter-group-btn" class="btn btn-danger">Delete</button>
      </div>
    </div>
  `;

  // Attach event listener for adding new filters dynamically
  document.getElementById("add-filter-btn").addEventListener("click", addFilterGroup);

  // Attach event listener for saving the filter group
  document.getElementById("save-filter-group-btn").onclick = () => saveFilterGroup(index);

  // Attach event listener for deleting the filter group
  document.getElementById("delete-filter-group-btn").addEventListener("click", () => {
    deleteFilterGroup(index);
    $('#filterGroupModal').modal('hide'); // Close the modal after deletion
  });

  // Show the modal
  $('#filterGroupModal').modal('show');
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
    const color = group.querySelector(".filter-color").value;
    const filterDescription = group.querySelector(".filter-description").value.trim();

    if (text) {
      filters.push({ text, regex, caseSensitive, color, description: filterDescription });
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

  // Defines whether the saving process is for an add or edit process 
  if (index === null) {
    // Add new filter group
    filterGroups.push({ title, description, filters });
  } else {
    // Edit existing filter group
    filterGroups[index] = { title, description, filters };
  }
  window.localStorage.setItem('filterGroups', JSON.stringify(filterGroups));
  // After saving, the filtered output table should automatically update without unchecking any boxes for current filtered groups options in the dropdown list
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
  const filterToApply = generalFilter && generalFilter.text ? [generalFilter, ...currentFilters] : currentFilters;
  applyFilters(filterToApply);
  
  // Automatically close the dropdown menu after saving
  const dropdownMenu = document.querySelector(".dropdown-menu");
  dropdownMenu.classList.remove("show");
  const dropdownButton = document.getElementById("premade-filters-dropdown");
  dropdownButton.setAttribute("aria-expanded", "false");

  // Close the modal
  $('#filterGroupModal').modal('hide');
};

const deleteFilterGroup = (index) => {
  const confirmDelete = confirm("Are you sure you want to delete this filter group?");
  if (!confirmDelete) return;

  // Preserve the current state of selected checkboxes
  const selectedIndices = Array.from(
    document.querySelectorAll(".dropdown-menu .form-check-input:checked")
  ).map((input) => parseInt(input.value));

  // Remove the selected filter group from the filterGroups array
  filterGroups.splice(index, 1);
  window.localStorage.setItem("filterGroups", JSON.stringify(filterGroups));
  // Refresh the dropdown while preserving the checked state
  populateFilterGroups();

  // Re-check the previously selected checkboxes (adjust indices if necessary)
  selectedIndices
    .filter((i) => i !== index) // Exclude the deleted index
    .forEach((i) => {
      const adjustedIndex = i > index ? i - 1 : i; // Adjust index for subsequent elements
      const checkbox = document.querySelector(`#filter-group-${adjustedIndex}`);
      if (checkbox) checkbox.checked = true;
    });

  // Update the current filters and apply them to the table
  const activeFilterIndices = Array.from(
    document.querySelectorAll(".dropdown-menu .form-check-input:checked")
  ).map((input) => parseInt(input.value));
  currentFilters = activeFilterIndices.flatMap((i) => filterGroups[i].filters);
  applyFilters(currentFilters);
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

const populateSearchSuggestions = (results) => {
  const suggestionsBox = document.getElementById("search-suggestions");
  suggestionsBox.innerHTML = "";

  if (results.length == 0) {
    suggestionsBox.style.display = "none";
    return;
  }
  results.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    li.addEventListener("click", () => {
      document.getElementById("log-search").value = item;
      updateTextFilter();
      suggestionsBox.style.display = "none";
    });
    suggestionsBox.appendChild(li);
  })
  suggestionsBox.style.display = "block";
}

const updateSearchSugggestionTrie = () => {
  const text = document.getElementById("log-search").value.trim();
  console.log("UPDATE SUGGESTION TRIE: " + text)
  suggestionTrie.insertWord(text);
  console.log("TRIE: " + suggestionTrie.root);
  let trieJSON = trieToJSON();
  window.localStorage.setItem('suggestionTrie', JSON.stringify(trieJSON));
}

const getSearchSuggestions = () => {
  const text = document.getElementById("log-search").value.trim();
  let results = suggestionTrie.collect(text, TOP_K);
  return results;
}

const buildTrieJSON = (node, trieJSON) => {
  if (node == null) {
    return null;
  }
  trieJSON['character'] = node.character;
  trieJSON['freq'] = node.freq;
  if (!trieJSON['left']) {
    trieJSON['left'] = {};
  }
  trieJSON['left'] = buildTrieJSON(node.left, trieJSON['left']);
  if (!trieJSON['middle']) {
    trieJSON['middle'] = {};
  }
  trieJSON['middle'] = buildTrieJSON(node.middle, trieJSON['middle']);
  if (!trieJSON['right']) {
    trieJSON['right'] = {};
  }
  trieJSON['right'] = buildTrieJSON(node.right, trieJSON['right']);
  return trieJSON;
}

const trieToJSON = () => {
  let trieJSON = buildTrieJSON(suggestionTrie.root, {});
  return trieJSON;
}

const buildTrie = (node, trieJSON) => {
  if (trieJSON == null) {
    return null;
  }
  if (node == null) {
    node = new Node();
  }
  node.character = trieJSON['character'];
  node.freq = trieJSON['freq'];
  node.left = buildTrie(node.left, trieJSON['left']);
  node.right = buildTrie(node.right, trieJSON['right']);
  node.middle = buildTrie(node.middle, trieJSON['middle']);
  return node;
}

const trieFromJSON = (trieJSON) => {
  let newTrie = new Trie();
  newTrie.root = buildTrie(newTrie.root, trieJSON);
  return newTrie;
}

const initializeApp = () => {
  if (!window.localStorage.getItem('filterGroups')) {
    window.localStorage.setItem('filterGroups', JSON.stringify(DEFAULT_FILTER_GROUPS));
    filterGroups = DEFAULT_FILTER_GROUPS;
  } else {
    filterGroups = JSON.parse(window.localStorage.getItem('filterGroups'));
  }

  if (!window.localStorage.getItem('suggestionTrie')) {
    window.localStorage.setItem("suggestionTrie", JSON.stringify(trieToJSON(suggestionTrie)));
  } else {
    let trieJSON = JSON.parse(window.localStorage.getItem("suggestionTrie"));
    console.log(JSON.stringify(trieJSON));
    suggestionTrie = trieFromJSON(trieJSON);
    console.log(suggestionTrie.root)
  }

  // Attach event listeners for file input
  document.getElementById("log-file-input").value = '';
  document.getElementById("log-file-input").addEventListener("change", handleFileUpload);

  // Attach event listeners for text filters
  document.getElementById("log-search").addEventListener("input", updateTextFilter);
  document.getElementById("log-search").addEventListener("keydown", (e) => {
    if (e.key == "Enter") {
      updateSearchSugggestionTrie();
    }
  })
  document.getElementById("log-search").addEventListener("input", updateSearchSuggestions);
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
  
    // Add one blank filter by default
    addFilterGroup();
  
    // Set up modal footer buttons
    const modalFooter = document.querySelector("#filterGroupModal .modal-footer");
    modalFooter.innerHTML = `
      <div class="d-flex justify-content-between w-100 align-items-center">
        <button type="button" id="add-filter-btn" class="btn btn-primary">Add Filter</button>
        <button type="button" id="save-filter-group-btn" class="btn btn-success">Save</button>
      </div>
    `;
  
    // Attach event listener for dynamically adding filters in the modal
    document.getElementById("add-filter-btn").addEventListener("click", addFilterGroup);
  
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