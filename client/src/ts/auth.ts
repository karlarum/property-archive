const API_URL = 'http://localhost:3000/api';

/* Check if user is authenticated */
export async function checkAuth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      credentials: 'include'
    });
    
    const isAuthenticated = response.ok;
    updateNavigation(isAuthenticated);
    return isAuthenticated;
  } catch (error) {
    console.error('Auth check failed:', error);
    updateNavigation(false);
    return false;
  }
}

/* Update navigation based on auth status */
function updateNavigation(isAuthenticated: boolean): void {
  const loginItem = document.getElementById('nav-login-item');
  const registerItem = document.getElementById('nav-register-item');
  const dashboardItem = document.getElementById('nav-dashboard-item');
  const logoutItem = document.getElementById('nav-logout-item');

  if (isAuthenticated) {
    loginItem?.setAttribute('style', 'display: none;');
    registerItem?.setAttribute('style', 'display: none;');
    dashboardItem?.setAttribute('style', 'display: block;');
    logoutItem?.setAttribute('style', 'display: block;');
  } else {
    loginItem?.setAttribute('style', 'display: block;');
    registerItem?.setAttribute('style', 'display: block;');
    dashboardItem?.setAttribute('style', 'display: none;');
    logoutItem?.setAttribute('style', 'display: none;');
  }
}

/* Logout */
export async function handleLogout(): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });

    if (response.ok) {
      window.location.href = '/';
    } else {
      alert('Logout failed. Please try again.');
    }
  } catch (error) {
    console.error('Logout error:', error);
    alert('Logout failed. Please try again.');
  }
}

/* Redirect to login if not authenticated */
export async function requireAuth(): Promise<void> {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) {
    window.location.href = '/login.html';
  }
}