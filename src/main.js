let allLogs = [];
const premadeFilters = [
  { title: 'Error Logs', regex: false, caseSensitive: false, text: 'ERROR' },
  { title: 'User Alice', regex: false, caseSensitive: false, text: 'Alice' },
  { title: 'Info Level', regex: false, caseSensitive: false, text: 'INFO' },
  { title: 'Warnings Starting with "WARN"', regex: true, caseSensitive: false, text: '^WARN' }
];
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

const applyFilters = () => {
  let filteredLogs = allLogs;
  currentFilters.forEach(filter => {
    const { regex, caseSensitive, text } = filter;
    if (regex) {
      const pattern = new RegExp(text, caseSensitive ? '' : 'i');
      filteredLogs = filteredLogs.filter(log =>
        Object.values(log).some(value => pattern.test(String(value)))
      );
    } else {
      const searchText = caseSensitive ? text : text.toLowerCase();
      filteredLogs = filteredLogs.filter(log =>
        Object.values(log).some(value => {
          const fieldValue = String(value);
          return caseSensitive ? fieldValue.includes(searchText) : fieldValue.toLowerCase().includes(searchText);
        })
      );
    }
  });
  renderTable(filteredLogs);
};

const updateFilters = () => {
  const searchText = document.getElementById("log-search").value.trim();
  const useRegex = document.getElementById("use-regex").checked;
  const caseSensitive = document.getElementById("case-sensitive").checked;

  currentFilters = [];
  if (searchText) {
    currentFilters.push({ regex: useRegex, caseSensitive, text: searchText });
  }
  applyFilters();
};

const populatePremadeFilters = () => {
  const dropdownMenu = document.querySelector(".dropdown-menu");
  premadeFilters.forEach((filter, index) => {
    const filterHTML = `
      <div class="form-check">
        <input class="form-check-input" type="checkbox" id="premade-filter-${index}" value="${index}">
        <label class="form-check-label" for="premade-filter-${index}">${filter.title}</label>
      </div>
    `;
    dropdownMenu.insertAdjacentHTML('beforeend', filterHTML);
  });

  dropdownMenu.addEventListener("change", (event) => {
    if (event.target.classList.contains("form-check-input")) {
      const selectedIndices = Array.from(
        dropdownMenu.querySelectorAll("input:checked")
      ).map(input => parseInt(input.value));
      currentFilters = selectedIndices.map(index => premadeFilters[index]);
      applyFilters();
    }
  });
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

// initialize the App
const initializeApp = () => {
  document.getElementById("log-search").addEventListener("input", updateFilters);
  document.getElementById("use-regex").addEventListener("change", updateFilters);
  document.getElementById("case-sensitive").addEventListener("change", updateFilters);
  populatePremadeFilters();
  setupDropdown();
  loadLogs();
};

// run the app
initializeApp();
