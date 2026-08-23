const difficultyXp = {
  easy: 10,
  medium: 25,
  hard: 50
};

const STATE_KEY = "questJournalState";
const XP_KEY = "questJournalLifetimeXp";
const ARCHIVE_KEY = "questJournalArchive";
const LEGACY_KEY = "quests";

const today = getDateKey();
let lifetimeXp = loadLifetimeXp();
let archive = loadArchive();
let state = loadState();

const form = document.getElementById("questForm");
const titleInput = document.getElementById("questTitle");
const difficultyInput = document.getElementById("difficulty");
const questList = document.getElementById("questList");
const progress = document.getElementById("progress");
const restartButton = document.getElementById("restartButton");

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createId() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function normalizeQuests(savedQuests) {
  if (!Array.isArray(savedQuests)) {
    return [];
  }

  return savedQuests
    .filter(quest =>
      quest &&
      typeof quest.title === "string" &&
      difficultyXp[quest.difficulty]
    )
    .map(quest => ({
      id: String(quest.id || createId()),
      title: quest.title,
      difficulty: quest.difficulty,
      xp: difficultyXp[quest.difficulty],
      done: Boolean(quest.done),
      xpAwarded: Boolean(quest.xpAwarded || quest.done)
    }));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATE_KEY));

    if (saved && saved.date === today) {
      return {
        date: today,
        quests: normalizeQuests(saved.quests)
      };
    }

    if (saved && Array.isArray(saved.quests)) {
      archive.push({
        date: saved.date || "unknown",
        quests: normalizeQuests(saved.quests)
      });
    }

    const legacyQuests = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]");

    if (!saved && Array.isArray(legacyQuests)) {
      const oldQuests = normalizeQuests(legacyQuests);

      lifetimeXp += oldQuests
        .filter(quest => quest.done)
        .reduce((sum, quest) => sum + quest.xp, 0);
    }

    saveArchive();

    return {
      date: today,
      quests: []
    };
  } catch {
    return {
      date: today,
      quests: []
    };
  }
}

function loadLifetimeXp() {
  try {
    const saved = Number(localStorage.getItem(XP_KEY));
    return Number.isFinite(saved) && saved >= 0 ? saved : 0;
  } catch {
    return 0;
  }
}

function loadArchive() {
  try {
    const saved = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    localStorage.setItem(XP_KEY, String(lifetimeXp));
  } catch {
    console.warn("Unable to save quest data.");
  }
}

function saveArchive() {
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
  } catch {
    console.warn("Unable to save quest archive.");
  }
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function calculateStreak() {
  const completedDates = new Set(
    archive
      .filter(day => day.quests.some(quest => quest.done))
      .map(day => day.date)
  );

  if (state.quests.some(quest => quest.done)) {
    completedDates.add(today);
  }

  let streak = 0;
  const date = new Date();

  while (completedDates.has(getDateKey(date))) {
    streak++;
    date.setDate(date.getDate() - 1);
  }

  return streak;
}

function render() {
  const completedQuests = state.quests.filter(quest => quest.done);
  const level = Math.floor(lifetimeXp / 100) + 1;
  const currentXp = lifetimeXp % 100;

  document.getElementById("total").textContent = state.quests.length;
  document.getElementById("completed").textContent = completedQuests.length;
  document.getElementById("totalXp").textContent = lifetimeXp;
  document.getElementById("level").textContent = level;
  document.getElementById("xp").textContent = currentXp;
  progress.style.width = `${currentXp}%`;
  document.getElementById("streak").textContent = calculateStreak();

  if (state.quests.length === 0) {
    questList.innerHTML =
      '<div class="empty">No quests yet. Create one to get started!</div>';
    return;
  }

  questList.innerHTML = state.quests.map(quest => `
    <div class="quest ${quest.done ? "completed" : ""}">
      <button
        class="check"
        type="button"
        data-action="toggle"
        data-id="${escapeHtml(quest.id)}"
        aria-label="${quest.done ? "Mark quest incomplete" : "Complete quest"}"
      >
        ${quest.done ? "✓" : ""}
      </button>

      <div class="quest-info">
        <div class="quest-title">${escapeHtml(quest.title)}</div>
        <div class="quest-meta">
          ${quest.difficulty.charAt(0).toUpperCase() + quest.difficulty.slice(1)}
          · ${quest.xp} XP
        </div>
      </div>

      <button
        class="remove"
        type="button"
        data-action="remove"
        data-id="${escapeHtml(quest.id)}"
        aria-label="Remove quest"
      >
        ×
      </button>
    </div>
  `).join("");
}

function toggleQuest(id) {
  state.quests = state.quests.map(quest => {
    if (String(quest.id) !== id) {
      return quest;
    }

    const done = !quest.done;

    if (done && !quest.xpAwarded) {
      lifetimeXp += quest.xp;
      return { ...quest, done, xpAwarded: true };
    }

    return { ...quest, done };
  });

  saveState();
  render();
}

function removeQuest(id) {
  state.quests = state.quests.filter(
    quest => String(quest.id) !== id
  );

  saveState();
  render();
}

function restartJourney() {
  const confirmed = window.confirm(
    "Are you sure you want to restart? Your gained XP won't return."
  );

  if (!confirmed) {
    return;
  }

  lifetimeXp = 0;
  localStorage.setItem(XP_KEY, "0");
  render();
}

form.addEventListener("submit", event => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const difficulty = difficultyInput.value;

  if (!title || !difficultyXp[difficulty]) {
    return;
  }

  state.quests.push({
    id: createId(),
    title,
    difficulty,
    xp: difficultyXp[difficulty],
    done: false,
    xpAwarded: false
  });

  saveState();
  form.reset();
  difficultyInput.value = "medium";
  render();
  titleInput.focus();
});

questList.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  if (button.dataset.action === "toggle") {
    toggleQuest(button.dataset.id);
  } else if (button.dataset.action === "remove") {
    removeQuest(button.dataset.id);
  }
});

restartButton.addEventListener("click", restartJourney);

saveState();
render();
