"use strict";

const STORAGE_KEY = "daymark.habits.v1";
const THEME_STORAGE_KEY = "daymark.theme.v1";
const elements = {
  themeToggle: document.querySelector("#theme-toggle"),
  themeToggleLabel: document.querySelector("#theme-toggle-label"),
  previousDay: document.querySelector("#previous-day"),
  nextDay: document.querySelector("#next-day"),
  dayName: document.querySelector("#day-name"),
  dateValue: document.querySelector("#date-value"),
  progressRing: document.querySelector("#progress-ring"),
  progressPercent: document.querySelector("#progress-percent"),
  monthLabel: document.querySelector("#month-label"),
  monthCount: document.querySelector("#month-count"),
  monthNote: document.querySelector("#month-note"),
  dayCount: document.querySelector("#day-count"),
  dayNote: document.querySelector("#day-note"),
  rating: document.querySelector("#rating"),
  ratingNote: document.querySelector("#rating-note"),
  habitCount: document.querySelector("#habit-count"),
  habitList: document.querySelector("#habit-list"),
  emptyState: document.querySelector("#empty-state"),
  emptyTitle: document.querySelector("#empty-title"),
  emptyCopy: document.querySelector("#empty-copy"),
  weekChart: document.querySelector("#week-chart"),
  developmentMessage: document.querySelector("#development-message p"),
  form: document.querySelector("#habit-form"),
  nameInput: document.querySelector("#habit-name"),
  frequency: document.querySelector("#frequency"),
  weekday: document.querySelector("#weekday"),
  monthday: document.querySelector("#monthday"),
  weekdayLabel: document.querySelector('label[for="weekday"]'),
  monthdayLabel: document.querySelector('label[for="monthday"]'),
  formPrompt: document.querySelector("#form-prompt"),
  submitHabit: document.querySelector("#submit-habit"),
  openForm: document.querySelector("#open-form"),
  emptyAdd: document.querySelector("#empty-add"),
  cancelForm: document.querySelector("#cancel-form")
};

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function readData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { habits: [], checkins: {} };

    const parsed = JSON.parse(saved);
    if (!parsed || !Array.isArray(parsed.habits) || !parsed.checkins || typeof parsed.checkins !== "object") {
      throw new Error("Saved habit data has an invalid format.");
    }

    const savedHabits = parsed.habits.filter((habit) =>
      habit &&
      typeof habit.id === "string" &&
      typeof habit.name === "string" &&
      ["daily", "weekly", "monthly"].includes(habit.frequency)
    );
    const checkins = {};
    for (const [date, records] of Object.entries(parsed.checkins)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !records || typeof records !== "object") continue;
      checkins[date] = {};
      for (const [id, value] of Object.entries(records)) {
        if (typeof value === "boolean") checkins[date][id] = value;
      }
    }
    const habits = savedHabits.map((habit) => {
      const firstCheckin = Object.keys(checkins)
        .filter((date) => Object.prototype.hasOwnProperty.call(checkins[date], habit.id))
        .sort()[0];
      const createdOn = /^\d{4}-\d{2}-\d{2}$/.test(habit.createdOn || "")
        ? habit.createdOn
        : firstCheckin || dayKey(startOfDay(new Date()));
      return { ...habit, createdOn };
    });
    return { habits, checkins };
  } catch (error) {
    console.error("Could not read saved habits.", error);
    return { habits: [], checkins: {} };
  }
}

let data = readData();
let selectedDate = startOfDay(new Date());
let editingHabitId = null;

function getSavedTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch (error) {
    console.error("Could not read saved theme.", error);
    return "light";
  }
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  elements.themeToggle.setAttribute("aria-pressed", String(isDark));
  elements.themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
  elements.themeToggleLabel.textContent = isDark ? "Light mode" : "Dark mode";
  document.querySelector('meta[name="theme-color"]').content = isDark ? "#171d19" : "#f5f6f1";
}

function toggleTheme() {
  const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.error("Could not save theme preference.", error);
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Could not save habit data.", error);
    window.alert("Your changes could not be saved in this browser. Check that browser storage is available.");
  }
}

function isDue(habit, date) {
  if (habit.createdOn && dayKey(date) < habit.createdOn) return false;
  if (habit.frequency === "daily") return true;
  if (habit.frequency === "weekly") return Number(habit.weekday) === date.getDay();
  if (habit.frequency === "monthly") return Number(habit.monthday) === date.getDate();
  return false;
}

function getDueHabits(date) {
  return data.habits.filter((habit) => isDue(habit, date));
}

function getWeekStart(date) {
  const monday = startOfDay(date);
  const dayFromMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - dayFromMonday);
  return monday;
}

function getDayTotals(date) {
  const due = getDueHabits(date);
  const records = data.checkins[dayKey(date)] || {};
  const done = due.filter((habit) => records[habit.id] === true).length;
  const recorded = due.filter((habit) => typeof records[habit.id] === "boolean").length;
  return { due: due.length, done, recorded };
}

function getMonthTotals(date) {
  const cursor = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  let due = 0;
  let done = 0;
  while (cursor <= lastDay) {
    const totals = getDayTotals(cursor);
    due += totals.due;
    done += totals.done;
    cursor.setDate(cursor.getDate() + 1);
  }
  return { due, done };
}

function getPeriodSummary(totals) {
  if (!totals.due) {
    return {
      rating: "Rest day",
      note: "Nothing was scheduled for this date.",
      message: "Taking a planned pause is part of a steady routine."
    };
  }
  const percent = Math.round((totals.done / totals.due) * 100);
  if (percent >= 80) {
    return {
      rating: "Going great",
      note: `${percent}% of due habits completed`,
      message: "You're showing up for yourself. Keep that good rhythm going."
    };
  }
  if (percent >= 50) {
    return {
      rating: "Good progress",
      note: `${percent}% of due habits completed`,
      message: "Good progress comes one check-in at a time. Keep going."
    };
  }
  if (totals.recorded === 0) {
    return {
      rating: "Ready?",
      note: "Your progress will show here",
      message: "Your progress will grow with every check-in."
    };
  }
  return {
    rating: "Could be better",
    note: "A new day is another chance to try",
    message: "Not every day goes to plan. You can start again at your next check-in."
  };
}

function renderDate() {
  const today = startOfDay(new Date());
  const isToday = dayKey(today) === dayKey(selectedDate);
  elements.dayName.textContent = isToday
    ? "Today"
    : selectedDate.toLocaleDateString(undefined, { weekday: "long" });
  elements.dateValue.textContent = selectedDate.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
  elements.nextDay.disabled = selectedDate >= today;
}

function renderOverview() {
  const dailyTotals = getDayTotals(selectedDate);
  const monthTotals = getMonthTotals(selectedDate);
  const monthPercent = monthTotals.due ? Math.round((monthTotals.done / monthTotals.due) * 100) : 0;
  elements.monthLabel.textContent = `${selectedDate.toLocaleDateString(undefined, { month: "long" }).toUpperCase()} OVERVIEW`;
  elements.progressRing.style.setProperty("--progress", `${monthPercent * 3.6}deg`);
  elements.progressRing.setAttribute("aria-label", `${monthPercent}% of scheduled check-ins completed this month`);
  elements.progressPercent.textContent = `${monthPercent}%`;
  elements.monthCount.innerHTML = `${monthTotals.done} <span>/ ${monthTotals.due}</span>`;
  elements.monthNote.textContent = monthTotals.due
    ? "completed out of this month's scheduled tasks"
    : "No scheduled check-ins yet";

  elements.dayCount.innerHTML = `${dailyTotals.done} <span>/ ${dailyTotals.due} done</span>`;
  const remaining = dailyTotals.due - dailyTotals.recorded;
  elements.dayNote.textContent = dailyTotals.due === 0
    ? "Nothing scheduled for this day"
    : remaining
      ? `${remaining} still to check in`
      : "All scheduled habits checked in";

  const summary = getPeriodSummary(dailyTotals);
  elements.rating.textContent = summary.rating;
  elements.ratingNote.textContent = summary.note;
  elements.developmentMessage.textContent = summary.message;
}

function renderWeekChart() {
  elements.weekChart.replaceChildren();
  const weekStart = getWeekStart(selectedDate);
  const today = startOfDay(new Date());

  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + offset);
    const totals = getDayTotals(date);
    const percent = totals.due ? Math.round((totals.done / totals.due) * 100) : 0;
    const day = document.createElement("div");
    day.className = "chart-day";
    const track = document.createElement("div");
    track.className = "chart-track";
    track.setAttribute("aria-hidden", "true");
    const fill = document.createElement("div");
    fill.className = "chart-fill";
    fill.style.height = `${percent}%`;
    track.append(fill);
    const label = document.createElement("span");
    label.className = "chart-label";
    label.textContent = date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
    const isSelected = dayKey(date) === dayKey(selectedDate);
    label.classList.toggle("is-selected", isSelected);
    day.append(track, label);
    day.title = `${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}: ${totals.done} of ${totals.due} completed`;
    if (date > selectedDate || date > today) day.classList.add("is-future");
    elements.weekChart.append(day);
  }

  const start = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 6);
  elements.weekChart.setAttribute("aria-label", `Habit progress from ${start} to ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`);
}

function getFrequencyLabel(habit) {
  if (habit.frequency === "daily") return "Every day";
  if (habit.frequency === "weekly") return `Every ${weekdays[Number(habit.weekday)]}`;
  return `Every month on the ${habit.monthday}${[11, 12, 13].includes(Number(habit.monthday)) ? "th" : Number(habit.monthday) % 10 === 1 ? "st" : Number(habit.monthday) % 10 === 2 ? "nd" : Number(habit.monthday) % 10 === 3 ? "rd" : "th"}`;
}

function renderHabits() {
  elements.habitList.replaceChildren();
  const dueHabits = getDueHabits(selectedDate);
  const records = data.checkins[dayKey(selectedDate)] || {};
  const isFuture = selectedDate > startOfDay(new Date());

  for (const habit of dueHabits) {
    const row = document.querySelector("#habit-template").content.firstElementChild.cloneNode(true);
    const didButton = row.querySelector(".did-button");
    const notButton = row.querySelector(".not-button");
    const status = records[habit.id];
    row.querySelector(".habit-copy h3").textContent = habit.name;
    row.querySelector(".habit-frequency").textContent = getFrequencyLabel(habit);
    didButton.classList.toggle("is-selected", status === true);
    notButton.classList.toggle("is-selected", status === false);
    didButton.setAttribute("aria-pressed", String(status === true));
    notButton.setAttribute("aria-pressed", String(status === false));
    didButton.setAttribute("aria-label", `Mark ${habit.name} as done`);
    notButton.setAttribute("aria-label", `Mark ${habit.name} as not done`);
    didButton.disabled = isFuture;
    notButton.disabled = isFuture;
    const editButton = row.querySelector(".edit-button");
    const deleteButton = row.querySelector(".delete-button");
    editButton.setAttribute("aria-label", `Edit ${habit.name}`);
    deleteButton.setAttribute("aria-label", `Delete ${habit.name}`);
    didButton.addEventListener("click", () => setCheckin(habit.id, true));
    notButton.addEventListener("click", () => setCheckin(habit.id, false));
    editButton.addEventListener("click", () => openEditForm(habit.id));
    deleteButton.addEventListener("click", () => deleteHabit(habit.id));
    elements.habitList.append(row);
  }

  elements.habitCount.textContent = dueHabits.length;
  const hasHabits = data.habits.length > 0;
  elements.habitList.hidden = dueHabits.length === 0;
  elements.emptyState.hidden = dueHabits.length > 0;
  if (!hasHabits) {
    elements.emptyTitle.textContent = "A fresh start, whenever you are";
    elements.emptyCopy.textContent = "Start with one small thing you want to make time for.";
    elements.emptyAdd.textContent = "Add your first habit →";
  } else if (dueHabits.length === 0) {
    elements.emptyTitle.textContent = "Nothing scheduled for this day";
    elements.emptyCopy.textContent = "Your next habit will appear on its scheduled day.";
    elements.emptyAdd.textContent = "Add another habit →";
  }
  elements.emptyAdd.hidden = false;
}

function render() {
  renderDate();
  renderOverview();
  renderWeekChart();
  renderHabits();
}

function setCheckin(habitId, didComplete) {
  const key = dayKey(selectedDate);
  if (!data.checkins[key]) data.checkins[key] = {};
  data.checkins[key][habitId] = didComplete;
  saveData();
  render();
}

function addHabit(name, frequency) {
  const cleanName = name.trim();
  if (!cleanName) return false;
  const habit = {
    id: typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: cleanName,
    frequency,
    createdOn: dayKey(new Date())
  };
  if (frequency === "weekly") habit.weekday = Number(elements.weekday.value);
  if (frequency === "monthly") habit.monthday = Number(elements.monthday.value);
  data.habits.push(habit);
  saveData();
  return true;
}

function updateHabit(habitId, name, frequency) {
  const index = data.habits.findIndex((habit) => habit.id === habitId);
  if (index === -1) return false;

  const updatedHabit = { ...data.habits[index], name: name.trim(), frequency };
  delete updatedHabit.weekday;
  delete updatedHabit.monthday;
  if (frequency === "weekly") updatedHabit.weekday = Number(elements.weekday.value);
  if (frequency === "monthly") updatedHabit.monthday = Number(elements.monthday.value);
  data.habits[index] = updatedHabit;
  saveData();
  return true;
}

function deleteHabit(habitId) {
  const habit = data.habits.find((item) => item.id === habitId);
  if (!habit || !window.confirm(`Delete "${habit.name}" and its check-in history?`)) return;
  data.habits = data.habits.filter((item) => item.id !== habitId);
  for (const records of Object.values(data.checkins)) delete records[habitId];
  saveData();
  render();
}

function updateScheduleFields() {
  const isWeekly = elements.frequency.value === "weekly";
  const isMonthly = elements.frequency.value === "monthly";
  elements.weekday.hidden = !isWeekly;
  elements.weekdayLabel.hidden = !isWeekly;
  elements.monthday.hidden = !isMonthly;
  elements.monthdayLabel.hidden = !isMonthly;
}

function showForm() {
  editingHabitId = null;
  elements.form.reset();
  updateScheduleFields();
  elements.formPrompt.textContent = "What would you like to do?";
  elements.submitHabit.textContent = "Add habit";
  elements.form.hidden = false;
  elements.nameInput.focus();
}

function openEditForm(habitId) {
  const habit = data.habits.find((item) => item.id === habitId);
  if (!habit) return;

  editingHabitId = habit.id;
  elements.nameInput.value = habit.name;
  elements.frequency.value = habit.frequency;
  if (habit.weekday !== undefined) elements.weekday.value = String(habit.weekday);
  if (habit.monthday !== undefined) elements.monthday.value = String(habit.monthday);
  updateScheduleFields();
  elements.formPrompt.textContent = "Update your habit";
  elements.submitHabit.textContent = "Save changes";
  elements.form.hidden = false;
  elements.nameInput.focus();
}

function hideForm() {
  elements.form.hidden = true;
  elements.form.reset();
  editingHabitId = null;
  elements.formPrompt.textContent = "What would you like to do?";
  elements.submitHabit.textContent = "Add habit";
  updateScheduleFields();
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const cleanName = elements.nameInput.value.trim();
  if (!cleanName) {
    elements.nameInput.setCustomValidity("Please enter a habit.");
    elements.nameInput.reportValidity();
    return;
  }
  elements.nameInput.setCustomValidity("");
  const saved = editingHabitId
    ? updateHabit(editingHabitId, cleanName, elements.frequency.value)
    : addHabit(cleanName, elements.frequency.value);
  if (saved) {
    hideForm();
    render();
  }
});
elements.nameInput.addEventListener("input", () => elements.nameInput.setCustomValidity(""));
elements.frequency.addEventListener("change", updateScheduleFields);
elements.openForm.addEventListener("click", showForm);
elements.emptyAdd.addEventListener("click", showForm);
elements.cancelForm.addEventListener("click", hideForm);
elements.previousDay.addEventListener("click", () => {
  selectedDate.setDate(selectedDate.getDate() - 1);
  render();
});
elements.nextDay.addEventListener("click", () => {
  const today = startOfDay(new Date());
  if (selectedDate >= today) return;
  selectedDate.setDate(selectedDate.getDate() + 1);
  render();
});

elements.themeToggle.addEventListener("click", toggleTheme);
applyTheme(getSavedTheme());
updateScheduleFields();
render();
