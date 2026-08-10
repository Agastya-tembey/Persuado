const STORAGE_KEY = 'persuado-mun-checklist';

const sections = [
  {
    title: 'Research Phase',
    tasks: [
      'Research your country\'s foreign policy',
      'Learn committee mandate',
      'Research major stakeholders',
      'Understand key terminology',
      'Gather statistics and evidence',
    ],
  },
  {
    title: 'Speech Preparation',
    tasks: [
      'Draft opening speech',
      'Prepare moderated caucus talking points',
      'Prepare rebuttals',
      'Prepare closing remarks',
    ],
  },
  {
    title: 'Resolution Preparation',
    tasks: [
      'Identify allies',
      'Identify likely opponents',
      'Draft operative clauses',
      'Draft preambulatory clauses',
      'Review sample resolutions',
    ],
  },
  {
    title: 'Conference Readiness',
    tasks: [
      'Review rules of procedure',
      'Practice speaking',
      'Prepare POIs',
      'Prepare questions for other delegates',
      'Final review completed',
    ],
  },
];

const getSavedState = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};

let state = getSavedState();

const elements = {
  checklistContainer: document.getElementById('checklistContainer'),
  progressValue: document.getElementById('progressValue'),
  progressValueInline: document.getElementById('progressValueInline'),
  progressFill: document.getElementById('progressFill'),
  completedCount: document.getElementById('completedCount'),
  totalCount: document.getElementById('totalCount'),
  statusLabel: document.getElementById('statusLabel'),
  completionMessage: document.getElementById('completionMessage'),
  resetButton: document.getElementById('resetChecklist'),
  resetModal: document.getElementById('resetModal'),
  cancelReset: document.getElementById('cancelReset'),
  confirmReset: document.getElementById('confirmReset'),
};

const buildTaskId = (sectionTitle, taskText) => `${sectionTitle}-${taskText}`.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase();

const saveState = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const getTotalTasks = () => sections.reduce((sum, section) => sum + section.tasks.length, 0);

const getCompletedTasks = () => Object.values(state).filter(Boolean).length;

const getCompletionPercentage = () => {
  const total = getTotalTasks();
  return total === 0 ? 0 : Math.round((getCompletedTasks() / total) * 100);
};

const updateProgress = () => {
  const completed = getCompletedTasks();
  const total = getTotalTasks();
  const percentage = getCompletionPercentage();

  elements.completedCount.textContent = completed;
  elements.totalCount.textContent = total;
  elements.progressValue.textContent = `${percentage}%`;
  elements.progressValueInline.textContent = `${percentage}%`;
  elements.progressFill.style.width = `${percentage}%`;
  elements.statusLabel.textContent = percentage === 100 ? 'Conference Ready' : `${percentage}% complete`;
  elements.statusLabel.className = percentage === 100 ? 'status-pill ready' : 'status-pill in-progress';
  elements.completionMessage.style.display = percentage === 100 ? 'block' : 'none';
};

const renderChecklist = () => {
  elements.checklistContainer.innerHTML = '';

  sections.forEach((section) => {
    const details = document.createElement('details');
    details.className = 'accordion checklist-section';
    details.open = true;

    const summary = document.createElement('summary');
    summary.innerHTML = `<span>${section.title}</span><span>${section.tasks.length} tasks</span>`;

    const list = document.createElement('ul');
    list.className = 'task-list';

    section.tasks.forEach((task) => {
      const id = buildTaskId(section.title, task);
      const isChecked = Boolean(state[id]);

      const item = document.createElement('li');
      item.className = 'task-item';
      item.innerHTML = `
        <label for="${id}">
          <input type="checkbox" id="${id}" data-task="${id}" ${isChecked ? 'checked' : ''}>
          <span>${task}</span>
        </label>
      `;
      list.appendChild(item);
    });

    details.appendChild(summary);
    details.appendChild(list);
    elements.checklistContainer.appendChild(details);
  });
};

const handleCheckboxChange = (event) => {
  const checkbox = event.target;
  if (!checkbox.matches('input[type="checkbox"][data-task]')) return;

  state[checkbox.dataset.task] = checkbox.checked;
  saveState();
  updateProgress();
};

const openResetModal = () => {
  elements.resetModal.classList.remove('hidden');
};

const closeResetModal = () => {
  elements.resetModal.classList.add('hidden');
};

const resetChecklist = () => {
  state = {};
  localStorage.removeItem(STORAGE_KEY);
  renderChecklist();
  updateProgress();
  closeResetModal();
};

const init = () => {
  if (!elements.checklistContainer) return;

  renderChecklist();
  updateProgress();

  elements.checklistContainer.addEventListener('change', handleCheckboxChange);
  elements.resetButton.addEventListener('click', openResetModal);
  elements.cancelReset.addEventListener('click', closeResetModal);
  elements.confirmReset.addEventListener('click', resetChecklist);
  elements.resetModal.addEventListener('click', (event) => {
    if (event.target === elements.resetModal) closeResetModal();
  });
};

init();
