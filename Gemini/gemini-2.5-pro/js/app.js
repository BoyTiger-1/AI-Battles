/**
 * FBLA 2025-2026 Website Coding & Development Project
 * School Lost and Found Website
 * 
 * This script handles all client-side logic:
 * 1.  Manages a simulated database using browser localStorage.
 * 2.  Handles the 'Report Found Item' form submission.
 * 3.  Dynamically renders items on the 'Browse Items' page.
 * 4.  Implements search and filter functionality.
 * 5.  Populates and manages the 'Admin Panel'.
 * 
 * The code is structured to run based on the current page,
 * preventing errors and improving organization.
 */

document.addEventListener('DOMContentLoaded', () => {
    // This is the main entry point. It checks which page is currently loaded
    // and calls the appropriate function to initialize its specific logic.
    const page = window.location.pathname.split("/").pop();

    if (page === 'report.html' || page === 'report') {
        initReportPage();
    }
    if (page === 'browse.html' || page === 'browse' || page === '' || page === 'index.html') {
        // We run browse logic on index too, in case we want to show recent items there later.
        initBrowsePage();
    }
    if (page === 'admin.html' || page === 'admin') {
        initAdminPage();
    }
});


// --- Database Simulation using localStorage ---

/**
 * Retrieves all items from localStorage.
 * @returns {Array} An array of item objects, or an empty array if none exist.
 */
const getItems = () => {
    const items = localStorage.getItem('lostAndFoundItems');
    return items ? JSON.parse(items) : [];
};

/**
 * Saves an array of items to localStorage.
 * @param {Array} items - The array of item objects to save.
 */
const saveItems = (items) => {
    localStorage.setItem('lostAndFoundItems', JSON.stringify(items));
};


// --- Report Page Logic ---

/**
 * Initializes the 'Report Found Item' page.
 * Sets up the form submission handler.
 */
const initReportPage = () => {
    const reportForm = document.getElementById('report-form');
    if (!reportForm) return;

    reportForm.addEventListener('submit', handleReportSubmit);
};

/**
 * Handles the submission of the report form.
 * @param {Event} e - The form submission event.
 */
const handleReportSubmit = (e) => {
    e.preventDefault(); // Prevent the form from actually submitting

    const form = e.target;
    const itemName = form.itemName.value;
    const itemCategory = form.itemCategory.value;
    const locationFound = form.locationFound.value;
    const dateFound = form.dateFound.value;
    const itemDescription = form.itemDescription.value;
    const itemPhoto = form.itemPhoto.files[0];

    // Use FileReader to convert the image to a Base64 string for storage
    const reader = new FileReader();
    reader.onloadend = () => {
        const newItem = {
            id: Date.now(), // Unique ID based on timestamp
            name: itemName,
            category: itemCategory,
            location: locationFound,
            date: dateFound,
            description: itemDescription,
            photo: reader.result, // The Base64 string of the image
            status: 'pending' // All new items need admin approval
        };

        const items = getItems();
        items.push(newItem);
        saveItems(items);

        // Show success message and reset the form
        form.reset();
        const successMessage = document.getElementById('success-message');
        successMessage.style.display = 'block';
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);
    };

    if (itemPhoto) {
        reader.readAsDataURL(itemPhoto);
    }
};


// --- Browse Page Logic ---

/**
 * Initializes the 'Browse Items' page.
 * Fetches items and sets up filter/search event listeners.
 */
const initBrowsePage = () => {
    const searchBar = document.getElementById('search-bar');
    const categoryFilter = document.getElementById('category-filter');

    if (searchBar) {
        searchBar.addEventListener('keyup', renderBrowseItems);
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', renderBrowseItems);
    }

    // Initial render of items when the page loads
    renderBrowseItems();
};

/**
 * Renders the items on the browse page based on current filters.
 */
const renderBrowseItems = () => {
    const itemGrid = document.getElementById('item-grid');
    if (!itemGrid) return;
    
    const allItems = getItems();
    // Only show items that have been approved by an admin
    let approvedItems = allItems.filter(item => item.status === 'approved');

    // Apply search filter
    const searchTerm = document.getElementById('search-bar')?.value.toLowerCase() || '';
    if (searchTerm) {
        approvedItems = approvedItems.filter(item => 
            item.name.toLowerCase().includes(searchTerm) ||
            item.description.toLowerCase().includes(searchTerm)
        );
    }

    // Apply category filter
    const category = document.getElementById('category-filter')?.value || 'all';
    if (category !== 'all') {
        approvedItems = approvedItems.filter(item => item.category === category);
    }

    // Clear the current grid
    itemGrid.innerHTML = '';
    
    // Display a message if no items are found
    const noItemsMessage = document.getElementById('no-items-message');
    if (approvedItems.length === 0) {
        noItemsMessage.style.display = 'block';
    } else {
        noItemsMessage.style.display = 'none';
        approvedItems.forEach(item => {
            const itemCard = createItemCard(item);
            itemGrid.appendChild(itemCard);
        });
    }
};

/**
 * Creates an HTML element for a single item card.
 * @param {Object} item - The item object.
 * @returns {HTMLElement} The created card element.
 */
const createItemCard = (item) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
        <img src="${item.photo}" alt="${item.name}">
        <h3>${item.name}</h3>
        <p class="category-tag">${item.category}</p>
        <p><strong>Found at:</strong> ${item.location}</p>
        <p><strong>Date Found:</strong> ${item.date}</p>
        <p>${item.description}</p>
        <button class="btn btn-secondary" onclick="handleClaimItem('${item.name}')">Claim Item / Inquire</button>
    `;
    return card;
};

/**
 * Handles the claim/inquiry button click.
 * This is a simple implementation using an alert, as required.
 * A more complex version could open a modal with a form.
 * @param {string} itemName - The name of the item being claimed.
 */
window.handleClaimItem = (itemName) => {
    alert(`To claim the "${itemName}", please visit the main office with your student ID and be prepared to describe the item in more detail. Thank you!`);
};


// --- Admin Page Logic ---

/**
 * Initializes the Admin page.
 * Fetches all items and renders the management table.
 */
const initAdminPage = () => {
    renderAdminTable();
};

/**
 * Renders the table of items on the admin page.
 */
const renderAdminTable = () => {
    const tableBody = document.getElementById('admin-table-body');
    if (!tableBody) return;
    
    const allItems = getItems();
    tableBody.innerHTML = '';

    const noItemsMessage = document.getElementById('no-admin-items-message');
    if (allItems.length === 0) {
        noItemsMessage.style.display = 'block';
    } else {
        noItemsMessage.style.display = 'none';
        // Sort items to show pending ones first
        allItems.sort((a, b) => (a.status === 'pending' ? -1 : 1));

        allItems.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><img src="${item.photo}" alt="${item.name}"></td>
                <td>${item.name}</td>
                <td>${item.date}</td>
                <td><span class="status-${item.status}">${item.status.charAt(0).toUpperCase() + item.status.slice(1)}</span></td>
                <td class="admin-actions">
                    ${item.status === 'pending' ? `<button class="btn btn-approve" data-id="${item.id}">Approve</button>` : ''}
                    <button class="btn btn-delete" data-id="${item.id}">Delete</button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Add event listeners to the new buttons
        addAdminButtonListeners();
    }
};

/**
 * Adds click event listeners to the approve/delete buttons in the admin table.
 * Uses event delegation for efficiency.
 */
const addAdminButtonListeners = () => {
    const tableBody = document.getElementById('admin-table-body');
    if (!tableBody) return;

    tableBody.addEventListener('click', (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (!id) return;

        if (target.classList.contains('btn-approve')) {
            updateItemStatus(parseInt(id), 'approved');
        } else if (target.classList.contains('btn-delete')) {
            if (confirm('Are you sure you want to permanently delete this item?')) {
                deleteItem(parseInt(id));
            }
        }
    });
};

/**
 * Updates the status of an item.
 * @param {number} id - The ID of the item to update.
 * @param {string} newStatus - The new status ('approved').
 */
const updateItemStatus = (id, newStatus) => {
    const items = getItems();
    const itemIndex = items.findIndex(item => item.id === id);
    if (itemIndex > -1) {
        items[itemIndex].status = newStatus;
        saveItems(items);
        renderAdminTable(); // Re-render the table to show the change
    }
};

/**
 * Deletes an item from the database.
 * @param {number} id - The ID of the item to delete.
 */
const deleteItem = (id) => {
    let items = getItems();
    items = items.filter(item => item.id !== id);
    saveItems(items);
    renderAdminTable(); // Re-render the table
};
