import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/main.css';

const API_URL = 'http://localhost:3000/api';

const form = document.getElementById('login-form') as HTMLFormElement;
const errorDiv = document.getElementById('error-message') as HTMLDivElement;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = (document.getElementById('email') as HTMLInputElement).value;
  const password = (document.getElementById('password') as HTMLInputElement).value;

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      // Login successful, redirect to dashboard
      window.location.href = '/dashboard.html';
    } else {
      // Show error message
      errorDiv.textContent = data.error || 'Login failed';
      errorDiv.style.display = 'block';
    }
  } catch (error) {
    console.error('Login error:', error);
    errorDiv.textContent = 'An error occurred. Please try again.';
    errorDiv.style.display = 'block';
  }
});