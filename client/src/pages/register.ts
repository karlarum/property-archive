import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/main.css';

const API_URL = 'http://localhost:3000/api';

const form = document.getElementById('register-form') as HTMLFormElement;
const errorDiv = document.getElementById('error-message') as HTMLDivElement;
const successDiv = document.getElementById('success-message') as HTMLDivElement;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const firstName = (document.getElementById('firstName') as HTMLInputElement).value;
  const lastName = (document.getElementById('lastName') as HTMLInputElement).value;
  const email = (document.getElementById('email') as HTMLInputElement).value;
  const password = (document.getElementById('password') as HTMLInputElement).value;
  const confirmPassword = (document.getElementById('confirmPassword') as HTMLInputElement).value;

  // Hide previous messages
  errorDiv.style.display = 'none';
  successDiv.style.display = 'none';

  // Validate passwords match
  if (password !== confirmPassword) {
    errorDiv.textContent = 'Passwords do not match';
    errorDiv.style.display = 'block';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ 
        email, 
        password, 
        firstName: firstName || undefined,
        lastName: lastName || undefined
      })
    });

    const data = await response.json();

    if (response.ok) {
      // Registration successful
      successDiv.textContent = 'Registration successful! Redirecting to dashboard...';
      successDiv.style.display = 'block';
      
      // Redirect after 2 seconds
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 2000);
    } else {
      // Show error message
      errorDiv.textContent = data.error || 'Registration failed';
      errorDiv.style.display = 'block';
    }
  } catch (error) {
    console.error('Registration error:', error);
    errorDiv.textContent = 'An error occurred. Please try again.';
    errorDiv.style.display = 'block';
  }
});