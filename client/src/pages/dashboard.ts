import 'bootstrap/dist/css/bootstrap.min.css';
import { Modal } from 'bootstrap';
import '../styles/main.css';
import { requireAuth, handleLogout } from '../ts/auth';

const API_URL = 'http://localhost:3000/api';

// Require authentication
requireAuth();

// Global state
let items: any[] = [];
let categories: any[] = [];

// Modals
let addItemModal: Modal;
let categoriesModal: Modal;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  addItemModal = new Modal(document.getElementById('addItemModal')!);
  categoriesModal = new Modal(document.getElementById('categoriesModal')!);
  
  loadCategories();
  loadItems();
  setupEventListeners();
});

/* Event listeners */
function setupEventListeners(): void {
  // Logout
  document.getElementById('nav-logout')?.addEventListener('click', (e) => {
    e.preventDefault();
    handleLogout();
  });

  // Delete item buttons
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('delete-btn')) {
      const itemId = target.getAttribute('data-item-id');
      if (itemId) {
        deleteItemHandler(itemId);
      }
    }
  });

  // View item buttons
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('view-btn')) {
      const itemId = target.getAttribute('data-item-id');
      if (itemId) {
        viewItemHandler(itemId);
      }
    }
  });

  // Save item
  document.getElementById('save-item')?.addEventListener('click', saveItem);

  // Export CSV
  document.getElementById('export-csv')?.addEventListener('click', exportCSV);

  // Export PDF
  document.getElementById('export-pdf')?.addEventListener('click', exportPDF);

  // Manage categories
  document.getElementById('manage-categories')?.addEventListener('click', () => {
    categoriesModal.show();
  });

  // Add category
  document.getElementById('add-category')?.addEventListener('click', addCategory);

  // Search
  document.getElementById('search-input')?.addEventListener('input', filterItems);
  document.getElementById('category-filter')?.addEventListener('change', filterItems);
}

/* Load items from API */
async function loadItems(): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/items`, {
      credentials: 'include'
    });

    if (response.ok) {
      items = await response.json();
      displayItems(items);
      updateStats();
    } else {
      console.error('Failed to load items');
    }
  } catch (error) {
    console.error('Error loading items:', error);
  }
}

/* Load categories from API */
async function loadCategories(): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/categories`, {
      credentials: 'include'
    });

    if (response.ok) {
      categories = await response.json();
      populateCategorySelects();
    }
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

/* Display items */
function displayItems(itemsToDisplay: any[]): void {
  const container = document.getElementById('items-container');
  if (!container) return;

  if (itemsToDisplay.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <p class="text-muted">No items yet. Click "Add Item" to get started!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = itemsToDisplay.map(item => `
    <div class="col-md-6 col-lg-4">
      <div class="card h-100" data-item-id="${item.id}">
        <button class="delete-btn" data-item-id="${item.id}">×</button>
        <div class="card-body">
          <h5 class="card-title">${escapeHtml(item.name)}</h5>
          ${item.category_name ? `<span class="badge bg-secondary mb-2">${escapeHtml(item.category_name)}</span>` : ''}
          ${item.description ? `<p class="card-text mt-2">${escapeHtml(item.description)}</p>` : ''}
          <div class="text-muted small mt-3">
            ${item.location ? `Vendor: ${escapeHtml(item.location)} | ` : ''}
            ${item.purchase_price ? `Value: $${item.purchase_price} | ` : ''}
            ${item.photo_count > 0 ? `${item.photo_count} photo(s)` : 'No photos'}
          </div>
        </div>
      </div>
    </div>
  `).join('');

  // Add event listeners after rendering
  addCardEventListeners();
}

/* Click handlers to cards and delete buttons */
function addCardEventListeners(): void {
  // Clickable cards (view item)
  document.querySelectorAll('#items-container .card').forEach(card => {
    card.addEventListener('click', (e) => {
      const itemId = (card as HTMLElement).getAttribute('data-item-id');
      if (itemId) {
        window.location.href = `/item-detail.html?id=${itemId}`;
      }
    });
  });

  // Delete button handlers
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent card click
      const itemId = (btn as HTMLElement).getAttribute('data-item-id');
      if (itemId) {
        await deleteItemHandler(itemId);
      }
    });
  });
}

/* Update stats cards */
function updateStats(): void {
  const totalItems = items.length;
  const totalCategories = categories.length;
  const totalPhotos = items.reduce((sum, item) => sum + (item.photo_count || 0), 0);
  const totalValue = items.reduce((sum, item) => sum + (parseFloat(item.purchase_price) || 0), 0);

  document.getElementById('total-items')!.textContent = totalItems.toString();
  document.getElementById('total-categories')!.textContent = totalCategories.toString();
  document.getElementById('total-photos')!.textContent = totalPhotos.toString();
  document.getElementById('total-value')!.textContent = `$${totalValue.toFixed(2)}`;
}

/* Category select dropdowns */
function populateCategorySelects(): void {
  const selects = [
    document.getElementById('item-category'),
    document.getElementById('category-filter')
  ];

  selects.forEach(select => {
    if (!select) return;
    
    const isFilter = select.id === 'category-filter';
    select.innerHTML = `<option value="">${isFilter ? 'All Categories' : 'No Category'}</option>`;
    
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.name;
      select.appendChild(option);
    });
  });
}

/* Save new item */
async function saveItem(): Promise<void> {
  const name = (document.getElementById('item-name') as HTMLInputElement).value;
  const description = (document.getElementById('item-description') as HTMLTextAreaElement).value;
  const categoryId = (document.getElementById('item-category') as HTMLSelectElement).value;
  const location = (document.getElementById('item-location') as HTMLInputElement).value;
  const purchaseDate = (document.getElementById('item-purchase-date') as HTMLInputElement).value;
  const purchasePrice = (document.getElementById('item-purchase-price') as HTMLInputElement).value;
  const photosInput = document.getElementById('item-photos') as HTMLInputElement;

  try {
    // Create item
    const response = await fetch(`${API_URL}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name,
        description: description || undefined,
        categoryId: categoryId || undefined,
        location: location || undefined,
        purchaseDate: purchaseDate || undefined,
        purchasePrice: purchasePrice || undefined
      })
    });

    if (!response.ok) throw new Error('Failed to create item');

    const data = await response.json();
    const itemId = data.itemId;

    // Upload photos if any (AI will generate description)
    if (photosInput.files && photosInput.files.length > 0) {
      const formData = new FormData();
      Array.from(photosInput.files).forEach(file => {
        formData.append('photos', file);
      });

      await fetch(`${API_URL}/items/${itemId}/photos`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
    }

    // Reload items and close modal
    await loadItems();
    addItemModal.hide();
    
    // Reset form
    (document.getElementById('add-item-form') as HTMLFormElement).reset();
  } catch (error) {
    console.error('Error saving item:', error);
    alert('Failed to save item. Please try again.');
  }
}

/* Delete item handler */
async function deleteItemHandler(itemId: string): Promise<void> {
  if (!confirm('Are you sure you want to delete this item?')) return;

  try {
    const response = await fetch(`${API_URL}/items/${itemId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (response.ok) {
      await loadItems();
    } else {
      alert('Failed to delete item');
    }
  } catch (error) {
    console.error('Error deleting item:', error);
    alert('Failed to delete item');
  }
}

/* View item handler */
function viewItemHandler(itemId: string): void {
  window.location.href = `/item-detail.html?id=${itemId}`;
}

/* Add new category */
async function addCategory(): Promise<void> {
  const nameInput = document.getElementById('new-category-name') as HTMLInputElement;
  const name = nameInput.value.trim();

  if (!name) {
    alert('Please enter a category name');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name })
    });

    if (response.ok) {
      nameInput.value = '';
      await loadCategories();
      await loadItems(); // Refresh to update stats
    } else {
      const data = await response.json();
      alert(data.error || 'Failed to create category');
    }
  } catch (error) {
    console.error('Error creating category:', error);
    alert('Failed to create category');
  }
}

/* Export to CSV */
async function exportCSV(): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/export/csv`, {
      credentials: 'include'
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'inventory.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      alert('Failed to export CSV');
    }
  } catch (error) {
    console.error('Error exporting CSV:', error);
    alert('Failed to export CSV');
  }
}

/* Export to PDF */
async function exportPDF(): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/export/pdf`, {
      credentials: 'include'
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'inventory.pdf';
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      alert('Failed to export PDF');
    }
  } catch (error) {
    console.error('Error exporting PDF:', error);
    alert('Failed to export PDF');
  }
}

/* Filter items based on search and category */
function filterItems(): void {
  const searchTerm = (document.getElementById('search-input') as HTMLInputElement).value.toLowerCase();
  const categoryFilter = (document.getElementById('category-filter') as HTMLSelectElement).value;

  const filtered = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm) ||
                         (item.description || '').toLowerCase().includes(searchTerm);
    
    const itemCategoryId = item.category_id?._id || item.category_id;
    const matchesCategory = !categoryFilter || String(itemCategoryId) === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  displayItems(filtered);
}

/* Escape HTML to prevent XSS */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}