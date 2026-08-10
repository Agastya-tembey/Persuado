import { auth, db, protectRoute } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { collection, doc, addDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const workspacesCollection = collection(db, 'workspaces');

const formatTimestamp = (value) => {
  if (!value) return 'Unknown';
  if (value.toDate) return value.toDate().toLocaleString();
  if (value.seconds) return new Date(value.seconds * 1000).toLocaleString();
  return String(value);
};

const showPageMessage = (element, message, type = 'info') => {
  if (!element) return;
  element.textContent = message;
  element.className = `message-box ${type}`;
};

const hidePageMessage = (element) => {
  if (!element) return;
  element.textContent = '';
  element.className = 'message-box hidden';
};

const getFriendlyErrorMessage = (error, fallback) => {
  if (!error) return fallback;
  const message = String(error.message || error);
  if (message.includes('auth')) {
    return 'Your session needs to be refreshed. Please sign in again and try once more.';
  }
  if (message.includes('permission')) {
    return 'You do not have permission to access that workspace.';
  }
  return fallback;
};

const ensureAuthenticated = () => {
  const user = auth.currentUser;
  if (!user) throw new Error('Authentication required.');
  return user.uid;
};

const createWorkspaceDoc = async ({ name, committee, country }) => {
  const ownerId = ensureAuthenticated();
  const workspaceData = {
    ownerId,
    name: name.trim() || 'Untitled Workspace',
    committee: committee.trim(),
    country: country.trim(),
    researchNotes: '',
    speeches: '',
    pois: '',
    resolutions: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(workspacesCollection, workspaceData);
  return { id: docRef.id, ...workspaceData };
};

const deleteWorkspaceById = async (workspaceId) => {
  ensureAuthenticated();
  const workspaceRef = doc(workspacesCollection, workspaceId);
  await deleteDoc(workspaceRef);
};

const createListItem = (workspace) => {
  const card = document.createElement('article');
  card.className = 'dashboard-card';
  card.innerHTML = `
    <div>
      <h3>${workspace.name || 'Untitled Workspace'}</h3>
      <p><strong>Committee:</strong> ${workspace.committee || 'None'}</p>
      <p><strong>Country:</strong> ${workspace.country || 'None'}</p>
      <p><strong>Last Updated:</strong> ${formatTimestamp(workspace.updatedAt)}</p>
    </div>
    <div class="workspace-actions">
      <button class="button button-primary open-workspace" data-id="${workspace.id}">Open Workspace</button>
      <button class="button delete-workspace" data-id="${workspace.id}">Delete</button>
    </div>
  `;
  return card;
};

const clearCreateForm = () => {
  document.getElementById('newWorkspaceName').value = '';
  document.getElementById('newWorkspaceCommittee').value = '';
  document.getElementById('newWorkspaceCountry').value = '';
};

export const initWorkspacesPage = () => {
  protectRoute(['workspaces.html']);

  const listContainer = document.getElementById('workspaceList');
  const messageBox = document.getElementById('workspaceMessage');
  const createButton = document.getElementById('createWorkspaceButton');
  const createForm = document.getElementById('createWorkspaceForm');
  const cancelButton = document.getElementById('cancelCreateWorkspace');
  const submitButton = document.getElementById('submitCreateWorkspace');
  const nameInput = document.getElementById('newWorkspaceName');
  const committeeInput = document.getElementById('newWorkspaceCommittee');
  const countryInput = document.getElementById('newWorkspaceCountry');
  const emptyState = document.getElementById('workspaceEmpty');
  const loadingState = document.getElementById('workspaceLoading');

  const setLoadingState = (isLoading) => {
    if (loadingState) {
      loadingState.hidden = !isLoading;
    }
  };

  if (!listContainer || !createButton || !createForm || !cancelButton || !submitButton || !nameInput || !committeeInput || !countryInput) return;

  setLoadingState(true);

  const showCreateForm = () => {
    createForm.style.display = 'block';
    hidePageMessage(messageBox);
    createButton.disabled = true;
    nameInput.focus();
  };

  const hideCreateForm = () => {
    createForm.style.display = 'none';
    createButton.disabled = false;
    clearCreateForm();
  };

  createButton.addEventListener('click', () => {
    showCreateForm();
  });

  cancelButton.addEventListener('click', () => {
    hideCreateForm();
  });

  submitButton.addEventListener('click', async () => {
    hidePageMessage(messageBox);
    const name = nameInput.value.trim();
    const committee = committeeInput.value.trim();
    const country = countryInput.value.trim();

    if (!name) {
      showPageMessage(messageBox, 'Please enter a workspace name.', 'error');
      return;
    }

    try {
      const workspace = await createWorkspaceDoc({ name, committee, country });
      window.location.href = `workspace-editor.html?id=${workspace.id}`;
    } catch (error) {
      console.error('Workspace creation failed:', error);
      showPageMessage(messageBox, getFriendlyErrorMessage(error, 'Unable to create workspace right now.'), 'error');
    }
  });

  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (!user) {
      setLoadingState(false);
      emptyState.style.display = 'none';
      showPageMessage(messageBox, 'Please sign in to view your workspaces.', 'error');
      return;
    }

    const q = query(workspacesCollection, where('ownerId', '==', user.uid), orderBy('updatedAt', 'desc'));
    const stop = onSnapshot(q, (snapshot) => {
      setLoadingState(false);
      listContainer.innerHTML = '';
      if (snapshot.empty) {
        emptyState.style.display = 'block';
      } else {
        emptyState.style.display = 'none';
      }

      snapshot.docs.forEach((docSnapshot) => {
        const workspace = { id: docSnapshot.id, ...docSnapshot.data() };
        const card = createListItem(workspace);
        listContainer.appendChild(card);
      });

      listContainer.querySelectorAll('.open-workspace').forEach((button) => {
        button.addEventListener('click', () => {
          window.location.href = `workspace-editor.html?id=${button.dataset.id}`;
        });
      });

      listContainer.querySelectorAll('.delete-workspace').forEach((button) => {
        button.addEventListener('click', async () => {
          const workspaceId = button.dataset.id;
          if (!confirm('Delete this workspace? This action cannot be undone.')) return;
          try {
            await deleteWorkspaceById(workspaceId);
            showPageMessage(messageBox, 'Workspace deleted successfully.', 'success');
          } catch (error) {
            console.error('Workspace deletion failed:', error);
            showPageMessage(messageBox, getFriendlyErrorMessage(error, 'Unable to delete workspace right now.'), 'error');
          }
        });
      });
    }, (error) => {
      setLoadingState(false);
      console.error('Unable to load workspaces:', error);
      showPageMessage(messageBox, getFriendlyErrorMessage(error, 'Unable to load your workspaces right now.'), 'error');
    });

    window.addEventListener('beforeunload', () => {
      if (typeof stop === 'function') stop();
    });
  });
};

const page = window.location.pathname.split('/').pop();
if (page === 'workspaces.html') {
  initWorkspacesPage();
}
