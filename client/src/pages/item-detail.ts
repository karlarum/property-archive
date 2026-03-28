import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/main.css';
import { requireAuth, handleLogout } from '../ts/auth';
import { Modal } from 'bootstrap';

const API_URL = 'http://localhost:3000/api';

// Require authentication
requireAuth();

// Get item ID from URL
const urlParams = new URLSearchParams(window.location.search);
const itemId = urlParams.get('id');
let editItemModal: Modal;
let deleteConfirmModal: Modal;
let currentItem: any = null;
let pendingAction: (() => Promise<void>) | null = null;

// Setup on page load
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  
  if (!itemId) {
    showError();
    return;
  }
  
  loadItemDetails(itemId);
});

function setupEventListeners(): void {
  // Initialize modals
  editItemModal = new Modal(document.getElementById('editItemModal')!);
  deleteConfirmModal = new Modal(document.getElementById('deleteConfirmModal')!);

  // Logout
  document.getElementById('nav-logout')?.addEventListener('click', (e) => {
    e.preventDefault();
    handleLogout();
  });

  // Delete button
  document.getElementById('delete-item-btn')?.addEventListener('click', () => {
    pendingAction = () => deleteItem(itemId!);
    deleteConfirmModal.show();
  });

  // Confirm delete button
  document.getElementById('confirm-delete-btn')?.addEventListener('click', async () => {
    if (pendingAction) {
      await pendingAction();
      pendingAction = null;
    }
    deleteConfirmModal.hide();
  });

  // Edit button
  document.getElementById('edit-btn')?.addEventListener('click', () => {
    openEditModal();
  });

  // Save edit button
  document.getElementById('save-edit-btn')?.addEventListener('click', () => {
    saveEdit();
  });
}

/* Load item details from API */
async function loadItemDetails(id: string): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/items/${id}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      showError();
      return;
    }

    const item = await response.json();
    displayItem(item);
  } catch (error) {
    console.error('Error loading item:', error);
    showError();
  }
}

/* Display item details */
function displayItem(item: any): void {
  // Store current item for editing
  currentItem = item;

  // Hide loading, show content
  document.getElementById('loading')!.style.display = 'none';
  document.getElementById('item-detail')!.style.display = 'block';

  // Set item info
  document.getElementById('item-name')!.textContent = item.name;
  document.getElementById('item-description')!.textContent = item.description || 'No description';
  document.getElementById('item-location')!.textContent = item.location || 'Not specified';
  document.getElementById('item-purchase-date')!.textContent = item.purchase_date 
    ? new Date(item.purchase_date).toLocaleDateString() 
    : 'Not specified';
  document.getElementById('item-purchase-price')!.textContent = item.purchase_price 
    ? `$${item.purchase_price}` 
    : 'Not specified';
  document.getElementById('item-quantity')!.textContent = item.quantity ? item.quantity.toString() : '1';

  // Category badge
  const categoryBadge = document.getElementById('item-category')!;
  if (item.category_name) {
    categoryBadge.textContent = item.category_name;
    categoryBadge.style.display = 'inline-block';
  } else {
    categoryBadge.style.display = 'none';
  }

  // Display photos
  displayPhotos();
  
  // Load categories for edit modal
  loadCategories();
}

/* Display item photos */
function displayPhotos(): void {
  const container = document.getElementById('photos-container');
  if (!container || !currentItem) return;

  if (!currentItem.photoUrls || currentItem.photoUrls.length === 0) {
    container.innerHTML = '<p class="text-muted">No photos</p>';
    return;
  }

  container.innerHTML = currentItem.photoUrls.map((photoUrl: string, index: number) => `
    <div class="col-md-4 mb-3">
      <div class="card">
        <img src="${photoUrl}" class="card-img-top" alt="Item photo ${index + 1}">
        <div class="card-body text-center">
          <button class="btn btn-outline-danger btn-sm remove-photo-btn" data-filename="${currentItem.photos[index]}">
            Remove
          </button>
        </div>
      </div>
    </div>
  `).join('');

  // Event listeners to remove buttons
  document.querySelectorAll('.remove-photo-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const filename = (btn as HTMLElement).getAttribute('data-filename');
      if (filename) {
        await deletePhoto(filename);
      }
    });
  });
}

/* Delete the entire item */
async function deleteItem(id: string): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/items/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (response.ok) {
      window.location.href = '/dashboard.html';
    } else {
      alert('Failed to delete item');
    }
  } catch (error) {
    console.error('Error deleting item:', error);
    alert('Failed to delete item');
  }
}

/* Delete a single photo */
async function deletePhoto(filename: string): Promise<void> {
  if (!itemId) return;

  pendingAction = async () => {
    try {
      const response = await fetch(`${API_URL}/items/${itemId}/photos/${filename}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        await loadItemDetails(itemId!);
        displayPhotos();
      } else {
        alert('Failed to delete photo');
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
      alert('Failed to delete photo');
    }
  };

  deleteConfirmModal.show();
}

/* Load categories for the edit form */
async function loadCategories(): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/categories`, {
      credentials: 'include'
    });

    if (response.ok) {
      const categories = await response.json();
      const select = document.getElementById('edit-item-category') as HTMLSelectElement;
      
      select.innerHTML = '<option value="">No Category</option>';
      categories.forEach((cat: any) => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        select.appendChild(option);
      });

      // Set the current item's category now that options exist
      if (currentItem?.category_id) {
        select.value = currentItem.category_id;
      }
    }
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

/* Open edit modal with current item data */
function openEditModal(): void {
  if (!currentItem) return;

  (document.getElementById('edit-item-name') as HTMLInputElement).value = currentItem.name;
  (document.getElementById('edit-item-description') as HTMLTextAreaElement).value = currentItem.description || '';
  (document.getElementById('edit-item-location') as HTMLInputElement).value = currentItem.location || '';
  (document.getElementById('edit-item-purchase-date') as HTMLInputElement).value = currentItem.purchase_date 
    ? new Date(currentItem.purchase_date).toISOString().split('T')[0] 
    : '';
  (document.getElementById('edit-item-purchase-price') as HTMLInputElement).value = currentItem.purchase_price || '';
  (document.getElementById('edit-item-quantity') as HTMLInputElement).value = currentItem.quantity || '1';

  loadCategories();
  editItemModal.show();
}

/* Save edited item */
async function saveEdit(): Promise<void> {
  if (!itemId) return;

  const name = (document.getElementById('edit-item-name') as HTMLInputElement).value;
  const description = (document.getElementById('edit-item-description') as HTMLTextAreaElement).value;
  const categoryId = (document.getElementById('edit-item-category') as HTMLSelectElement).value;
  const location = (document.getElementById('edit-item-location') as HTMLInputElement).value;
  const purchaseDate = (document.getElementById('edit-item-purchase-date') as HTMLInputElement).value;
  const purchasePrice = (document.getElementById('edit-item-purchase-price') as HTMLInputElement).value;
  const quantity = (document.getElementById('edit-item-quantity') as HTMLInputElement).value;
  const photosInput = document.getElementById('edit-item-photos') as HTMLInputElement;

  try {
    // Update item details
    const response = await fetch(`${API_URL}/items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name,
        description: description || undefined,
        categoryId: categoryId || undefined,
        location: location || undefined,
        purchaseDate: purchaseDate || undefined,
        purchasePrice: purchasePrice || undefined,
        quantity: quantity ? parseInt(quantity) : 1
      })
    });

    if (!response.ok) {
      alert('Failed to update item');
      return;
    }

    // Upload new photos if any
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

    editItemModal.hide();
    // Show updated info
    loadItemDetails(itemId);
  } catch (error) {
    console.error('Error updating item:', error);
    alert('Failed to update item');
  }
}

/* Show error message */
function showError(): void {
  document.getElementById('loading')!.style.display = 'none';
  document.getElementById('error-message')!.style.display = 'block';
}