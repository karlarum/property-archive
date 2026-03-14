import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap';
import './styles/main.css';
import { checkAuth, handleLogout } from './ts/auth';

// Check authentication status and update nav
checkAuth();

// Handle logout
const logoutBtn = document.getElementById('nav-logout');
if (logoutBtn) {
  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    handleLogout();
  });
}