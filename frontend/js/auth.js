const API = 'https://healthlog-backend-l0u0.onrender.com/api';

// ── Redirect if already logged-in ──
if (localStorage.getItem('token')) {
  window.location.href = 'dashboard.html';
}

// ── Toggle helpers ──
function showLogin() {
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('btn-login').className  = 'flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 bg-white text-navy-900 shadow-sm';
  document.getElementById('btn-register').className = 'flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 text-gray-400 hover:text-gray-600';
  hideError();
}

function showRegister() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.remove('hidden');
  document.getElementById('btn-register').className = 'flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 bg-white text-navy-900 shadow-sm';
  document.getElementById('btn-login').className    = 'flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 text-gray-400 hover:text-gray-600';
  hideError();
}

function showError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideError() {
  document.getElementById('auth-error').classList.add('hidden');
}

// ── Login ──
document.getElementById('login-submit').addEventListener('click', async () => {
  hideError();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) return showError('Please fill in all fields.');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return showError('Please enter a valid email address.');

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) return showError(data.message || 'Login failed.');
    localStorage.setItem('token', data.token);
    window.location.href = 'dashboard.html';
  } catch (err) {
    showError('Network error — is the server running?');
  }
});

// ── Register ──
document.getElementById('reg-submit').addEventListener('click', async () => {
  hideError();
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  if (!name || !email || !password) return showError('Please fill in all fields.');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return showError('Please enter a valid email address.');
  if (password.length < 6) return showError('Password must be at least 6 characters.');

  try {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) return showError(data.message || 'Registration failed.');
    localStorage.setItem('token', data.token);
    window.location.href = 'dashboard.html';
  } catch (err) {
    showError('Network error — is the server running?');
  }
});
