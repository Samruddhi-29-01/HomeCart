function getToken() {
  return localStorage.getItem('token');
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
}

function getCachedUser() {
  try {
    const raw = localStorage.getItem('currentUser');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedUser(user) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

function renderAuthNav(user) {
  const navLinks = document.querySelector('.nav-links');
  if (!navLinks) return;

  const loginLink = navLinks.querySelector('a[data-auth-role="login"]') || navLinks.querySelector('a[href="login.html"]');
  const registerLink = navLinks.querySelector('a[data-auth-role="register"]') || navLinks.querySelector('a[href="register.html"]');
  const tempLogoutLink = navLinks.querySelector('a[data-auth-role="temp-logout"]');

  if (loginLink) {
    loginLink.setAttribute('data-auth-role', 'login');
  }

  if (registerLink) {
    registerLink.setAttribute('data-auth-role', 'register');
  }

  if (!user) {
    if (loginLink) {
      loginLink.href = 'login.html';
      loginLink.textContent = 'Login';
      loginLink.classList.remove('active-link');
      loginLink.onclick = null;
    }

    if (registerLink) {
      registerLink.href = 'register.html';
      registerLink.textContent = 'Register';
      registerLink.onclick = null;
    }

    if (tempLogoutLink && tempLogoutLink.parentElement) {
      tempLogoutLink.parentElement.remove();
    }

    return;
  }

  if (loginLink) {
    loginLink.href = '#';
    loginLink.textContent = `Hi, ${user.name || 'User'}`;
    loginLink.classList.add('active-link');
    loginLink.onclick = (e) => e.preventDefault();
  }

  if (registerLink) {
    registerLink.href = '#';
    registerLink.textContent = 'Logout';
    registerLink.onclick = (e) => {
      e.preventDefault();
      clearSession();
      window.location.href = 'index.html';
    };
  } else {
    if (!tempLogoutLink) {
      const logoutLi = document.createElement('li');
      logoutLi.innerHTML = '<a href="#" data-auth-role="temp-logout">Logout</a>';
      const logoutAnchor = logoutLi.querySelector('a');
      logoutAnchor.onclick = (e) => {
        e.preventDefault();
        clearSession();
        window.location.href = 'index.html';
      };
      navLinks.appendChild(logoutLi);
    }
  }

  const bar = document.querySelector('.announcement-bar');
  if (bar) {
    bar.textContent = `Logged in as ${user.name || 'User'} | Enjoy personalized deals and faster checkout.`;
  }
}

async function syncAuthUser() {
  const token = getToken();
  if (!token) {
    renderAuthNav(null);
    return;
  }

  const cachedUser = getCachedUser();
  if (cachedUser) {
    renderAuthNav(cachedUser);
  }

  try {
    const res = await fetch('/me', {
      headers: { Authorization: token }
    });

    if (!res.ok) {
      throw new Error('Session expired');
    }

    const user = await res.json();
    setCachedUser(user);
    renderAuthNav(user);
  } catch {
    clearSession();
    renderAuthNav(null);
  }
}

document.addEventListener('DOMContentLoaded', syncAuthUser);
