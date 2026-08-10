import { auth, db, protectRoute } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, getDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const getWorkspaceRef = (workspaceId) => doc(db, 'workspaces', workspaceId);

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

const collectWorkspaceData = ({ titleInput, committeeInput, countryInput, notesInput, speechesInput, poisInput, resolutionsInput }) => ({
  name: titleInput.value.trim(),
  committee: committeeInput.value.trim(),
  country: countryInput.value.trim(),
  researchNotes: notesInput.value,
  speeches: speechesInput.value,
  pois: poisInput.value,
  resolutions: resolutionsInput.value,
});

const mergeDocumentData = (workspace, elements) => {
  elements.titleInput.value = workspace.name || '';
  elements.committeeInput.value = workspace.committee || '';
  elements.countryInput.value = workspace.country || '';
  elements.notesInput.value = workspace.researchNotes || '';
  elements.speechesInput.value = workspace.speeches || '';
  elements.poisInput.value = workspace.pois || '';
  elements.resolutionsInput.value = workspace.resolutions || '';
};

const ensureCurrentUserOwnsDocument = (workspace) => {
  const currentUserId = auth.currentUser?.uid;
  return workspace && workspace.ownerId === currentUserId;
};

export const initWorkspaceEditorPage = () => {
  protectRoute(['workspace-editor.html']);

  const workspaceId = new URLSearchParams(window.location.search).get('id');
  const titleInput = document.getElementById('workspaceName');
  const committeeInput = document.getElementById('workspaceCommittee');
  const countryInput = document.getElementById('workspaceCountry');
  const notesInput = document.getElementById('researchNotes');
  const speechesInput = document.getElementById('speeches');
  const poisInput = document.getElementById('pois');
  const resolutionsInput = document.getElementById('resolutions');
  const statusLabel = document.getElementById('saveStatus');
  const deleteButton = document.getElementById('deleteWorkspaceButton');
  const messageBox = document.getElementById('workspaceEditorMessage');
  const loadingState = document.getElementById('workspaceLoadingState');

  const setLoadingState = (isLoading, message = 'Loading workspace…') => {
    if (!loadingState) return;
    loadingState.hidden = !isLoading;
    loadingState.textContent = message;
  };

  const setFormEnabled = (enabled) => {
    [titleInput, committeeInput, countryInput, notesInput, speechesInput, poisInput, resolutionsInput].forEach((element) => {
      if (element) element.disabled = !enabled;
    });
    if (deleteButton) deleteButton.disabled = !enabled;
  };

  setLoadingState(true);
  setFormEnabled(false);

  if (!workspaceId) {
    setLoadingState(false);
    setFormEnabled(true);
    showPageMessage(messageBox, 'Workspace ID is missing. Open a workspace from the list.', 'error');
    return;
  }

  if (!titleInput || !committeeInput || !countryInput || !notesInput || !speechesInput || !poisInput || !resolutionsInput || !statusLabel || !deleteButton) {
    setLoadingState(false);
    setFormEnabled(true);
    showPageMessage(messageBox, 'Workspace editor is not fully initialized.', 'error');
    return;
  }

  let saveTimer = null;
  let isDirty = false;
  let hasLoaded = false;
  let unsubscribe = null;

  const workspaceRef = getWorkspaceRef(workspaceId);

  const setSaveStatus = (text) => {
    statusLabel.textContent = text;
  };

  const saveChanges = async () => {
    if (!isDirty) return;
    const updates = collectWorkspaceData({ titleInput, committeeInput, countryInput, notesInput, speechesInput, poisInput, resolutionsInput });
    try {
      await updateDoc(workspaceRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      isDirty = false;
      setSaveStatus(`Last saved ${new Date().toLocaleTimeString()}`);
      showPageMessage(messageBox, 'Workspace saved.', 'success');
    } catch (error) {
      console.error('Workspace save failed:', error);
      setSaveStatus('Save failed');
      showPageMessage(messageBox, getFriendlyErrorMessage(error, 'Unable to save workspace right now.'), 'error');
    }
  };

  const scheduleSave = () => {
    isDirty = true;
    setSaveStatus('Saving...');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveChanges, 1000);
  };

  const attachFieldListeners = () => {
    [titleInput, committeeInput, countryInput, notesInput, speechesInput, poisInput, resolutionsInput].forEach((element) => {
      element.addEventListener('input', scheduleSave);
    });
  };

  deleteButton.addEventListener('click', async () => {
    if (!confirm('Delete this workspace? This action cannot be undone.')) return;
    try {
      await deleteDoc(workspaceRef);
      window.location.href = 'workspaces.html';
    } catch (error) {
      console.error('Workspace deletion failed:', error);
      showPageMessage(messageBox, getFriendlyErrorMessage(error, 'Unable to delete workspace right now.'), 'error');
    }
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setLoadingState(false);
      setFormEnabled(true);
      showPageMessage(messageBox, 'Please sign in to access your workspace.', 'error');
      return;
    }

    unsubscribe = onSnapshot(workspaceRef, (snapshot) => {
      if (!snapshot.exists()) {
        window.location.href = 'workspaces.html';
        return;
      }

      const workspace = snapshot.data();
      if (!ensureCurrentUserOwnsDocument(workspace)) {
        window.location.href = 'workspaces.html';
        return;
      }

      if (!hasLoaded) {
        setLoadingState(false);
        setFormEnabled(true);
        mergeDocumentData(workspace, { titleInput, committeeInput, countryInput, notesInput, speechesInput, poisInput, resolutionsInput });
        setSaveStatus(`Last saved ${formatTimestamp(workspace.updatedAt)}`);
        attachFieldListeners();
        hasLoaded = true;
      } else if (!isDirty) {
        mergeDocumentData(workspace, { titleInput, committeeInput, countryInput, notesInput, speechesInput, poisInput, resolutionsInput });
        setSaveStatus(`Last saved ${formatTimestamp(workspace.updatedAt)}`);
      }
    }, (error) => {
      setLoadingState(false);
      setFormEnabled(true);
      console.error('Unable to load workspace:', error);
      showPageMessage(messageBox, getFriendlyErrorMessage(error, 'Unable to load workspace right now.'), 'error');
    });
  });

  window.addEventListener('beforeunload', saveChanges);
};

const page = window.location.pathname.split('/').pop();
if (page === 'workspace-editor.html') {
  initWorkspaceEditorPage();
}
