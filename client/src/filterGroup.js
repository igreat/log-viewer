import {
    DEFAULT_FILTER_GROUPS,
    DEFAULT_HIGHLIGHT_COLOR,
    COLORS
} from './utils.js';
import { generalFilter, updateTextFilter } from './search.js';
import { applyFilters } from './logService.js';

let colorCounter = 0;
let filterGroups = []
export let currentFilters = []

export const initFilterGroups = () => {
    const storedGroups = window.localStorage.getItem('filterGroups');
    if (storedGroups) {
        filterGroups = JSON.parse(storedGroups);
    } else {
        filterGroups = DEFAULT_FILTER_GROUPS;
        window.localStorage.setItem('filterGroups', JSON.stringify(filterGroups));
    }
    populateFilterGroups();
};

export const extendFilterGroups = (newFilterGroups) => {
    filterGroups = [...filterGroups, ...newFilterGroups];

    // update local storage
    window.localStorage.setItem('filterGroups', JSON.stringify(filterGroups));

    // refresh the dropdown
    populateFilterGroups();

    // automatically check the new filter group
    const index = filterGroups.length - 1;
    document.getElementById(`filter-group-${index}`).checked = true;

    // update the current filters and apply them to the table
    currentFilters = filterGroups.flatMap((group, i) => {
        return document.getElementById(`filter-group-${i}`).checked ? group.filters : [];
    });

    const filters = generalFilter && generalFilter.text
        ? [generalFilter, ...currentFilters]
        : currentFilters;

    applyFilters(filters);
    updateTextFilter();
}

export const addFilterGroup = () => {
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

export const editFilterGroup = (index) => {
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

export const saveFilterGroup = (index = null) => {
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
    const filterToApply = generalFilter && generalFilter.text
        ? [generalFilter, ...currentFilters]
        : currentFilters;

    applyFilters(filterToApply);

    // Automatically close the dropdown menu after saving
    const dropdownMenu = document.querySelector(".dropdown-menu");
    dropdownMenu.classList.remove("show");
    const dropdownButton = document.getElementById("premade-filters-dropdown");
    dropdownButton.setAttribute("aria-expanded", "false");

    // Close the modal
    $('#filterGroupModal').modal('hide');
};

export const deleteFilterGroup = (index) => {
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
    const filtersToApply = generalFilter && generalFilter.text
        ? [generalFilter, ...currentFilters]
        : currentFilters;
    applyFilters(filtersToApply);
};

export const setupDropdown = () => {
    const dropdownButton = document.getElementById("premade-filters-dropdown");
    const dropdownMenu = dropdownButton.nextElementSibling;
    console.log(dropdownMenu);

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


export const populateFilterGroups = () => {
    const dropdownMenu = document.querySelector(".dropdown-menu");
    dropdownMenu.innerHTML = ''; // Clear existing items

    filterGroups.forEach((group, index) => {
        const groupHTML = `
            <div class="filter-group-item d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
            <div class="form-check flex-grow-1">
                <input
                class="form-check-input me-2"
                type="checkbox"
                id="filter-group-${index}"
                value="${index}">
                <label class="form-check-label" for="filter-group-${index}">
                <strong>${group.title}</strong>
                <span class="text-muted"> – ${group.description}</span>
                </label>
            </div>
            <button type="button" class="btn btn-sm btn-outline-secondary edit-filter-group-btn rounded-circle p-1" data-index="${index}">
                <svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="#5f6368">
                <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>
                </svg>
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
            // Use dataset to get the proper index
            const index = parseInt(button.getAttribute("data-index"));
            editFilterGroup(index);
        });
    });

    // Attach event listeners to the Delete buttons, if any (if you later add them)
    dropdownMenu.querySelectorAll(".delete-filter-group-btn").forEach((button) => {
        button.addEventListener("click", (event) => {
            const index = parseInt(button.getAttribute("data-index"));
            deleteFilterGroup(index);
        });
    });
};
