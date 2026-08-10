import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { auth, db, app } from './firebase.js';

// Ensure the user session persists across tabs and browser reloads.
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn('Unable to set persistence:', error);
});

// Utility function to display messages for user feedback.
const showMessage = (element, message, type = 'error') => {
  if (!element) return;
  element.textContent = message;
  element.className = `message-box ${type}`;
  element.classList.remove('hidden');
};

const hideMessage = (element) => {
  if (!element) return;
  element.classList.add('hidden');
};

const getFriendlyErrorMessage = (error, fallback) => {
  if (!error) return fallback;
  const message = String(error.message || error);
  if (message.includes('auth/invalid-credential') || message.includes('auth/user-not-found') || message.includes('auth/wrong-password')) {
    return 'The email or password is incorrect. Please try again.';
  }
  if (message.includes('auth/email-already-in-use')) {
    return 'An account with this email already exists.';
  }
  if (message.includes('auth/weak-password')) {
    return 'Please choose a stronger password.';
  }
  if (message.includes('auth/network-request-failed')) {
    return 'A network issue interrupted the request. Please try again.';
  }
  if (message.includes('auth/too-many-requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  return fallback;
};

const setFormSubmitting = (form, isSubmitting, loadingMessage) => {
  if (!form) return;
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = isSubmitting;
  }
  if (loadingMessage) {
    const message = form.querySelector('.message-box');
    if (message) {
      showMessage(message, loadingMessage, 'info');
    }
  }
};

const setDashboardState = (message, type = 'loading') => {
  const stateElement = document.getElementById('dashboardState');
  if (!stateElement) return;
  if (!message) {
    stateElement.hidden = true;
    return;
  }
  stateElement.hidden = false;
  stateElement.textContent = message;
  stateElement.className = `state-card ${type === 'error' ? 'state-error' : type === 'empty' ? 'state-empty' : 'state-loading'}`;
};

// Redirect the user to a protected page, or to login if not authenticated.
const redirectTo = (url) => {
  window.location.href = url;
};

// Check if user is logged in and protect routes.
const protectRoute = (allowedPages) => {
  const currentPage = window.location.pathname.split('/').pop();

  onAuthStateChanged(auth, (user) => {
    if (user) {
      if (['login.html', 'signup.html', 'forgot-password.html'].includes(currentPage)) {
        redirectTo('index.html');
      }
    } else if (allowedPages.includes(currentPage)) {
      redirectTo('login.html');
    }
  }, (error) => {
    console.error('Unable to verify authentication state:', error);
  });
};

// Manage guest upgrade prompts in index.html when a restricted feature is clicked.
const configureGuestPrompts = () => {
  const buttons = document.querySelectorAll('.restricted-action');
  const promptBox = document.getElementById('upgradePrompt');

  if (!buttons.length || !promptBox) return;

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const feature = button.dataset.feature;
      let text = 'Create a free Persuado account to unlock this feature.';

      switch (feature) {
        case 'notes':
          text = 'Create a free Persuado account to save research notes and access them from any device.';
          break;
        case 'bookmarks':
          text = 'Want to keep track of countries you\'re researching? Create a free account to bookmark countries and build your personal research library.';
          break;
        case 'dashboard':
          text = 'Your personal dashboard helps you organize research, save notes, track preparation progress and manage committees. Sign in or create a free account to continue.';
          break;
      }

      showMessage(promptBox, text, 'success');
    });
  });
};

// Signup form handling with validation and Firebase account creation.
const initSignup = () => {
  const form = document.getElementById('signupForm');
  const message = document.getElementById('signupMessage');

  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessage(message);
    setFormSubmitting(form, true, 'Creating your account…');

    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!fullName || !email || !password || !confirmPassword) {
      showMessage(message, 'Please complete every field before submitting.', 'error');
      setFormSubmitting(form, false);
      return;
    }

    if (password !== confirmPassword) {
      showMessage(message, 'Passwords do not match. Please check and try again.', 'error');
      setFormSubmitting(form, false);
      return;
    }

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      showMessage(message, 'Password should be at least 8 characters long and include a number and an uppercase letter.', 'error');
      setFormSubmitting(form, false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        showMessage(message, 'Account created successfully! Redirecting to Persuado...', 'success');
        setTimeout(() => redirectTo('index.html'), 1200);
      }
    } catch (error) {
      console.error('Signup failed:', error);
      showMessage(message, getFriendlyErrorMessage(error, 'Unable to create account. Please try again.'), 'error');
    } finally {
      setFormSubmitting(form, false);
    }
  });
};

// Login form handling with Firebase authentication.
const initLogin = () => {
  const form = document.getElementById('loginForm');
  const message = document.getElementById('loginMessage');

  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessage(message);
    setFormSubmitting(form, true, 'Signing you in…');

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
      showMessage(message, 'Enter both email and password to continue.', 'error');
      setFormSubmitting(form, false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      showMessage(message, 'Successfully signed in. Redirecting to Persuado...', 'success');
      setTimeout(() => redirectTo('index.html'), 1000);
    } catch (error) {
      console.error('Login failed:', error);
      showMessage(message, getFriendlyErrorMessage(error, 'Login failed. Check your credentials and try again.'), 'error');
    } finally {
      setFormSubmitting(form, false);
    }
  });
};

// Password reset form handling using Firebase email reset.
const initPasswordReset = () => {
  const form = document.getElementById('resetForm');
  const message = document.getElementById('resetMessage');

  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessage(message);
    setFormSubmitting(form, true, 'Sending reset email…');

    const email = document.getElementById('resetEmail').value.trim();

    if (!email) {
      showMessage(message, 'Please enter your email address.', 'error');
      setFormSubmitting(form, false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      showMessage(message, 'Password reset email sent successfully. Check your inbox.', 'success');
    } catch (error) {
      console.error('Password reset failed:', error);
      showMessage(message, getFriendlyErrorMessage(error, 'Unable to send reset email. Verify the address and try again.'), 'error');
    } finally {
      setFormSubmitting(form, false);
    }
  });
};

// Logout button click handler.
const initLogout = () => {
  const logoutButton = document.getElementById('logoutButton');

  if (!logoutButton) return;

  logoutButton.addEventListener('click', async () => {
    try {
      await signOut(auth);
      redirectTo('login.html');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  });
};

// Automatically update UI based on authentication state and protect restricted pages.
const initAuthState = () => {
  const displayNameElement = document.getElementById('displayName');
  const userEmailElement = document.getElementById('userEmail');
  const authLinks = document.getElementById('navAuthLinks');

  onAuthStateChanged(auth, (user) => {
    if (user) {
      if (displayNameElement) {
        displayNameElement.textContent = user.displayName || user.email.split('@')[0];
      }
      if (userEmailElement) {
        userEmailElement.textContent = user.email;
      }
      if (authLinks) {
        authLinks.innerHTML = '<a class="nav-button" href="dashboard.html">Account</a><a class="nav-button button-secondary" href="#" data-action="logout">Logout</a>';
      }
      setDashboardState('');
    } else {
      if (authLinks) {
        authLinks.innerHTML = '<a class="nav-button" href="login.html">Login</a><a class="nav-button button-secondary" href="signup.html">Create account</a>';
      }
      if (userEmailElement) {
        userEmailElement.textContent = 'Please sign in to view your dashboard.';
      }
      setDashboardState('Please sign in to view your dashboard.', 'empty');
    }
  }, (error) => {
    console.error('Unable to restore authentication state:', error);
    if (userEmailElement) {
      userEmailElement.textContent = 'We could not verify your session right now. Please refresh and try again.';
    }
    setDashboardState('We could not verify your session right now. Please refresh and try again.', 'error');
  });
};

// Add login redirect for logout link in nav if user clicks while signed out.
const initNavAuthRedirects = () => {
  const authLinks = document.getElementById('navAuthLinks');
  if (!authLinks) return;
  authLinks.addEventListener('click', async (event) => {
    const target = event.target;
    if (target.dataset.action === 'logout') {
      event.preventDefault();
      try {
        await signOut(auth);
        redirectTo('index.html');
      } catch (error) {
        console.error('Logout failed:', error);
      }
      return;
    }
    if (target.matches('a[href="login.html"]')) {
      event.preventDefault();
      redirectTo('login.html');
    }
  });
};

// Register page-specific handlers based on the current page.
const initPage = () => {
  const page = window.location.pathname.split('/').pop();

  switch (page) {
    case 'index.html':
      configureGuestPrompts();
      initAuthState();
      break;
    case 'signup.html':
      protectRoute([]);
      initSignup();
      initAuthState();
      break;
    case 'login.html':
      protectRoute([]);
      initLogin();
      initAuthState();
      break;
    case 'forgot-password.html':
      protectRoute([]);
      initPasswordReset();
      initAuthState();
      break;
    case 'dashboard.html':
      protectRoute(['dashboard.html']);
      initLogout();
      initAuthState();
      break;
    default:
      initAuthState();
      break;
  }

  initNavAuthRedirects();
};

export { auth, db, protectRoute };

  initPage();
