// ========================================
// ENHANCED STOPWATCH WITH ALL FEATURES
// ========================================

// State Management
let currentMode = 'stopwatch'; // 'stopwatch' or 'timer'
let stopwatchTimer;
let stopwatchMilliseconds = 0;
let stopwatchRunning = false;
let timerTimer;
let timerRemainingMs = 0;
let timerRunning = false;
let lapData = [];
let currentStopwatchTab = 0;
let stopwatchTabs = [{ name: 'Stopwatch 1', laps: [], time: 0 }];

// Sound elements
const clickSound = new Audio();
clickSound.src = 'data:audio/wav;base64,UklGRhIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YW4AAAA=';
const alarm = document.getElementById('alarmSound');

// Custom accent color
let accentColor = localStorage.getItem('accentColor') || '#2575fc';

// ========================================
// PWA & SERVICE WORKER
// ========================================
let deferredPrompt;

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.log('❌ Service Worker registration failed:', error);
      });
  });
}

// Capture the install prompt event
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('📱 Install prompt available');
  e.preventDefault();
  deferredPrompt = e;
  showInstallButton();
});

// Show install button
function showInstallButton() {
  const installBtn = document.getElementById('installBtn');
  if (installBtn) {
    installBtn.style.display = 'inline-block';
  }
}

// Handle install button click
function installApp() {
  if (!deferredPrompt) {
    alert('App is already installed or not installable on this device.');
    return;
  }
  
  deferredPrompt.prompt();
  
  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      console.log('✅ User accepted the install prompt');
      showNotification('App installed successfully! 🎉');
    } else {
      console.log('❌ User dismissed the install prompt');
    }
    deferredPrompt = null;
    
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
      installBtn.style.display = 'none';
    }
  });
}

// Check if app is already installed
window.addEventListener('appinstalled', () => {
  console.log('✅ PWA was installed');
  showNotification('Stopwatch installed! Open from your home screen. 📱');
  deferredPrompt = null;
});

// Handle URL parameters for shortcuts
function handleURLParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  if (mode === 'timer') {
    setMode('timer');
  }
}

// ========================================
// INITIALIZATION
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  setupKeyboardShortcuts();
  detectSystemTheme();
  loadFromLocalStorage();
  applyAccentColor();
  renderStopwatchTabs();
  updateDisplay();
  handleURLParams();
});

function initializeApp() {
  // Set initial mode
  setMode('stopwatch');
}

// ========================================
// AUTO DARK/LIGHT MODE DETECTION
// ========================================
function detectSystemTheme() {
  const savedTheme = localStorage.getItem('theme');
  
  if (savedTheme) {
    document.body.classList.toggle('dark', savedTheme === 'dark');
    updateThemeButton();
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('dark');
    updateThemeButton();
  }
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('theme')) {
      document.body.classList.toggle('dark', e.matches);
      updateThemeButton();
    }
  });
}

function updateThemeButton() {
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.textContent = document.body.classList.contains('dark') ? '☀️ Light Mode' : '🌙 Dark Mode';
  }
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeButton();
  playSound();
}

// ========================================
// DISPLAY & ANIMATION
// ========================================
function updateDisplay() {
  const display = document.getElementById('display');
  let timeMs;
  
  if (currentMode === 'stopwatch') {
    timeMs = stopwatchMilliseconds;
  } else {
    timeMs = timerRemainingMs;
  }
  
  const hours = Math.floor(timeMs / 3600000);
  const minutes = Math.floor((timeMs % 3600000) / 60000);
  const seconds = Math.floor((timeMs % 60000) / 1000);
  const ms = Math.floor((timeMs % 1000) / 10);
  
  const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  
  // Animated digits
  if (display.textContent !== timeString) {
    display.classList.add('updating');
    display.textContent = timeString;
    setTimeout(() => display.classList.remove('updating'), 100);
  }
}

// ========================================
// STOPWATCH FUNCTIONS
// ========================================
function startStopwatch() {
  if (!stopwatchRunning) {
    stopwatchRunning = true;
    const startTime = Date.now() - stopwatchMilliseconds;
    
    stopwatchTimer = setInterval(() => {
      stopwatchMilliseconds = Date.now() - startTime;
      updateDisplay();
      saveToLocalStorage();
    }, 10);
    
    playSound();
    vibrateDevice(50);
  }
}

function stopStopwatch() {
  stopwatchRunning = false;
  clearInterval(stopwatchTimer);
  stopwatchTabs[currentStopwatchTab].time = stopwatchMilliseconds;
  saveToLocalStorage();
  playSound();
  vibrateDevice(50);
}

function resetStopwatch() {
  stopStopwatch();
  stopwatchMilliseconds = 0;
  lapData = [];
  stopwatchTabs[currentStopwatchTab].laps = [];
  stopwatchTabs[currentStopwatchTab].time = 0;
  updateDisplay();
  renderLaps();
  saveToLocalStorage();
  playSound();
  vibrateDevice(100);
}

// ========================================
// LAP FUNCTIONS WITH SPLIT TIMES
// ========================================
function recordLap() {
  if (currentMode === 'stopwatch' && stopwatchRunning) {
    const currentTime = stopwatchMilliseconds;
    const previousLapTime = lapData.length > 0 ? lapData[lapData.length - 1].time : 0;
    const splitTime = currentTime - previousLapTime;
    
    const lap = {
      number: lapData.length + 1,
      time: currentTime,
      split: splitTime,
      timestamp: new Date().toLocaleTimeString()
    };
    
    lapData.push(lap);
    stopwatchTabs[currentStopwatchTab].laps = lapData;
    renderLaps();
    saveToLocalStorage();
    playSound();
    vibrateDevice(50);
  }
}

function renderLaps() {
  const lapsContainer = document.getElementById('laps');
  lapsContainer.innerHTML = '';
  
  if (lapData.length === 0) {
    return;
  }
  
  // Find fastest and slowest laps
  const splitTimes = lapData.map(lap => lap.split);
  const fastestSplit = Math.min(...splitTimes);
  const slowestSplit = Math.max(...splitTimes);
  
  lapData.slice().reverse().forEach((lap, index) => {
    const lapDiv = document.createElement('div');
    lapDiv.className = 'lap-item';
    
    // Highlight fastest and slowest
    if (lapData.length > 1) {
      if (lap.split === fastestSplit) lapDiv.classList.add('fastest');
      if (lap.split === slowestSplit) lapDiv.classList.add('slowest');
    }
    
    // Calculate difference from previous lap
    let diffHTML = '';
    if (lap.number > 1) {
      const prevLap = lapData[lap.number - 2];
      const diff = lap.split - prevLap.split;
      const diffFormatted = formatTime(Math.abs(diff));
      const diffClass = diff > 0 ? 'slower' : 'faster';
      const diffSymbol = diff > 0 ? '+' : '-';
      diffHTML = `<span class="lap-diff ${diffClass}">${diffSymbol}${diffFormatted}</span>`;
    }
    
    lapDiv.innerHTML = `
      <div class="lap-info">
        <span class="lap-number">Lap ${lap.number}</span>
        <span class="lap-time">${formatTime(lap.time)}</span>
      </div>
      <div class="lap-details">
        <span class="lap-split">Split: ${formatTime(lap.split)}</span>
        ${diffHTML}
      </div>
      <button class="delete-lap-btn" onclick="deleteLap(${lap.number - 1})" title="Delete lap">🗑️</button>
    `;
    
    lapsContainer.appendChild(lapDiv);
  });
}

function deleteLap(index) {
  lapData.splice(index, 1);
  // Renumber laps
  lapData.forEach((lap, i) => {
    lap.number = i + 1;
  });
  stopwatchTabs[currentStopwatchTab].laps = lapData;
  renderLaps();
  saveToLocalStorage();
  playSound();
}

function formatTime(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor((ms % 1000) / 10);
  
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}`;
}

// ========================================
// EXPORT FUNCTIONS (CSV & COPY)
// ========================================
function exportLaps() {
  if (lapData.length === 0) {
    alert('No laps to export!');
    return;
  }
  
  // Create CSV content
  let csv = 'Lap Number,Total Time,Split Time,Timestamp\n';
  lapData.forEach(lap => {
    csv += `${lap.number},${formatTime(lap.time)},${formatTime(lap.split)},${lap.timestamp}\n`;
  });
  
  // Download CSV
  const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
  link.download = `stopwatch-laps-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  
  playSound();
}

function copyLaps() {
  if (lapData.length === 0) {
    alert('No laps to copy!');
    return;
  }
  
  let text = 'Stopwatch Laps\n\n';
  lapData.forEach(lap => {
    text += `Lap ${lap.number}: ${formatTime(lap.time)} (Split: ${formatTime(lap.split)})\n`;
  });
  
  navigator.clipboard.writeText(text).then(() => {
    showNotification('Laps copied to clipboard!');
    playSound();
  }).catch(err => {
    alert('Failed to copy to clipboard');
  });
}

// ========================================
// TIMER FUNCTIONS
// ========================================
function startTimer() {
  if (timerRunning) return;
  
  if (timerRemainingMs === 0) {
    const h = parseInt(document.getElementById('hoursInput').value) || 0;
    const m = parseInt(document.getElementById('minutesInput').value) || 0;
    const s = parseInt(document.getElementById('secondsInput').value) || 0;
    
    timerRemainingMs = (h * 3600 + m * 60 + s) * 1000;
    
    if (timerRemainingMs <= 0) {
      alert('Please enter a valid time!');
      return;
    }
  }
  
  timerRunning = true;
  const startTime = Date.now();
  const initialTime = timerRemainingMs;
  
  timerTimer = setInterval(() => {
    const elapsed = Date.now() - startTime;
    timerRemainingMs = initialTime - elapsed;
    
    if (timerRemainingMs <= 0) {
      timerRemainingMs = 0;
      updateDisplay();
      clearInterval(timerTimer);
      timerRunning = false;
      alarm.play();
      vibrateDevice(1000);
      showNotification('⏰ Time\'s up!');
    }
    
    updateDisplay();
    saveToLocalStorage();
  }, 10);
  
  playSound();
  vibrateDevice(50);
}

function stopTimer() {
  timerRunning = false;
  clearInterval(timerTimer);
  saveToLocalStorage();
  playSound();
  vibrateDevice(50);
}

function resetTimer() {
  stopTimer();
  timerRemainingMs = 0;
  updateDisplay();
  saveToLocalStorage();
  playSound();
  vibrateDevice(100);
}

// ========================================
// MODE SWITCHING
// ========================================
function setMode(mode) {
  currentMode = mode;
  
  if (mode === 'stopwatch') {
    document.getElementById('stopwatchMode').classList.add('active');
    document.getElementById('timerMode').classList.remove('active');
    document.getElementById('timer-inputs').style.display = 'none';
    document.getElementById('lapBtn').style.display = 'inline-block';
    document.getElementById('exportBtn').style.display = 'inline-block';
    document.getElementById('copyBtn').style.display = 'inline-block';
    document.getElementById('stopwatchTabs').style.display = 'flex';
    document.getElementById('presetsBtn').style.display = 'none';
    document.getElementById('advancedToolbar').style.display = 'flex';
    
    // Load current tab data
    loadStopwatchTab(currentStopwatchTab);
  } else {
    document.getElementById('stopwatchMode').classList.remove('active');
    document.getElementById('timerMode').classList.add('active');
    document.getElementById('timer-inputs').style.display = 'flex';
    document.getElementById('lapBtn').style.display = 'none';
    document.getElementById('exportBtn').style.display = 'none';
    document.getElementById('copyBtn').style.display = 'none';
    document.getElementById('laps').innerHTML = '';
    document.getElementById('stopwatchTabs').style.display = 'none';
    document.getElementById('presetsBtn').style.display = 'inline-block';
    document.getElementById('advancedToolbar').style.display = 'flex';
    
    // Hide stopwatch-specific panels
    document.getElementById('statsPanel').style.display = 'none';
    document.getElementById('chartPanel').style.display = 'none';
  }
  
  updateDisplay();
  playSound();
}

// ========================================
// UNIFIED CONTROL FUNCTIONS
// ========================================
function startStopwatchOrTimer() {
  if (currentMode === 'stopwatch') {
    startStopwatch();
  } else {
    startTimer();
  }
}

function stopStopwatchOrTimer() {
  if (currentMode === 'stopwatch') {
    stopStopwatch();
  } else {
    stopTimer();
  }
}

function resetStopwatchOrTimer() {
  if (currentMode === 'stopwatch') {
    resetStopwatch();
  } else {
    resetTimer();
  }
}

// ========================================
// MULTIPLE STOPWATCH TABS
// ========================================
function renderStopwatchTabs() {
  const container = document.getElementById('stopwatchTabs');
  container.innerHTML = '';
  
  stopwatchTabs.forEach((tab, index) => {
    const tabBtn = document.createElement('button');
    tabBtn.className = 'tab-btn' + (index === currentStopwatchTab ? ' active' : '');
    tabBtn.textContent = tab.name;
    tabBtn.onclick = () => switchStopwatchTab(index);
    
    const deleteBtn = document.createElement('span');
    deleteBtn.className = 'tab-delete';
    deleteBtn.textContent = '×';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteStopwatchTab(index);
    };
    
    if (stopwatchTabs.length > 1) {
      tabBtn.appendChild(deleteBtn);
    }
    
    container.appendChild(tabBtn);
  });
  
  // Add new tab button
  const addBtn = document.createElement('button');
  addBtn.className = 'tab-btn add-tab-btn';
  addBtn.textContent = '+ Add';
  addBtn.onclick = addStopwatchTab;
  container.appendChild(addBtn);
}

function switchStopwatchTab(index) {
  if (stopwatchRunning) {
    stopStopwatch();
  }
  
  // Save current tab state
  stopwatchTabs[currentStopwatchTab].laps = lapData;
  stopwatchTabs[currentStopwatchTab].time = stopwatchMilliseconds;
  
  currentStopwatchTab = index;
  loadStopwatchTab(index);
  renderStopwatchTabs();
  saveToLocalStorage();
  playSound();
}

function loadStopwatchTab(index) {
  const tab = stopwatchTabs[index];
  stopwatchMilliseconds = tab.time || 0;
  lapData = tab.laps || [];
  updateDisplay();
  renderLaps();
}

function addStopwatchTab() {
  const name = prompt('Enter stopwatch name:', `Stopwatch ${stopwatchTabs.length + 1}`);
  if (name) {
    stopwatchTabs.push({ name, laps: [], time: 0 });
    renderStopwatchTabs();
    saveToLocalStorage();
    playSound();
  }
}

function deleteStopwatchTab(index) {
  if (stopwatchTabs.length <= 1) {
    alert('Cannot delete the last stopwatch!');
    return;
  }
  
  if (confirm(`Delete "${stopwatchTabs[index].name}"?`)) {
    stopwatchTabs.splice(index, 1);
    if (currentStopwatchTab >= stopwatchTabs.length) {
      currentStopwatchTab = stopwatchTabs.length - 1;
    }
    loadStopwatchTab(currentStopwatchTab);
    renderStopwatchTabs();
    saveToLocalStorage();
    playSound();
  }
}

// ========================================
// KEYBOARD SHORTCUTS
// ========================================
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in input
    if (e.target.tagName === 'INPUT') return;
    
    switch(e.code) {
      case 'Space':
        e.preventDefault();
        if (currentMode === 'stopwatch') {
          if (stopwatchRunning) {
            stopStopwatch();
          } else {
            startStopwatch();
          }
        } else {
          if (timerRunning) {
            stopTimer();
          } else {
            startTimer();
          }
        }
        break;
      case 'KeyL':
        if (currentMode === 'stopwatch') {
          recordLap();
        }
        break;
      case 'KeyR':
        if (currentMode === 'stopwatch') {
          resetStopwatch();
        } else {
          resetTimer();
        }
        break;
      case 'KeyF':
        e.preventDefault();
        toggleFullscreen();
        break;
    }
  });
}

// ========================================
// FULLSCREEN MODE
// ========================================
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.log('Fullscreen error:', err);
    });
    showNotification('Fullscreen enabled (Press F to exit)');
  } else {
    document.exitFullscreen();
    showNotification('Fullscreen disabled');
  }
  playSound();
}

// ========================================
// CUSTOM ACCENT COLOR
// ========================================
function openColorPicker() {
  const color = prompt('Enter accent color (e.g., #ff0000 or red):', accentColor);
  if (color) {
    accentColor = color;
    localStorage.setItem('accentColor', color);
    applyAccentColor();
    playSound();
  }
}

function applyAccentColor() {
  document.documentElement.style.setProperty('--accent-color', accentColor);
}

// ========================================
// SOUND & VIBRATION FEEDBACK
// ========================================
function playSound() {
  if (document.getElementById('soundToggle').checked) {
    clickSound.currentTime = 0;
    clickSound.play().catch(() => {});
  }
}

function vibrateDevice(duration) {
  if (navigator.vibrate && document.getElementById('vibrateToggle').checked) {
    navigator.vibrate(duration);
  }
}

// ========================================
// LOCAL STORAGE
// ========================================
function saveToLocalStorage() {
  const data = {
    stopwatchTabs,
    currentStopwatchTab,
    timerRemainingMs,
    accentColor,
    theme: document.body.classList.contains('dark') ? 'dark' : 'light'
  };
  localStorage.setItem('stopwatchData', JSON.stringify(data));
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem('stopwatchData');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      stopwatchTabs = data.stopwatchTabs || stopwatchTabs;
      currentStopwatchTab = data.currentStopwatchTab || 0;
      timerRemainingMs = data.timerRemainingMs || 0;
      
      if (data.accentColor) {
        accentColor = data.accentColor;
      }
      
      loadStopwatchTab(currentStopwatchTab);
    } catch (e) {
      console.error('Error loading from localStorage:', e);
    }
  }
}

// ========================================
// NOTIFICATIONS
// ========================================
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.classList.add('show'), 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// ========================================
// LAP STATISTICS
// ========================================
function calculateLapStats() {
  if (lapData.length === 0) return null;
  
  const splits = lapData.map(lap => lap.split);
  const total = lapData[lapData.length - 1].time;
  const average = splits.reduce((a, b) => a + b, 0) / splits.length;
  const fastest = Math.min(...splits);
  const slowest = Math.max(...splits);
  
  return {
    totalLaps: lapData.length,
    totalTime: total,
    averageSplit: average,
    fastestSplit: fastest,
    slowestSplit: slowest
  };
}

function toggleStats() {
  const statsPanel = document.getElementById('statsPanel');
  const isVisible = statsPanel.style.display !== 'none';
  
  if (isVisible) {
    statsPanel.style.display = 'none';
  } else {
    updateStatsDisplay();
    statsPanel.style.display = 'block';
  }
  playSound();
}

function updateStatsDisplay() {
  const stats = calculateLapStats();
  const statsContent = document.getElementById('statsContent');
  
  if (!stats) {
    statsContent.innerHTML = '<p class="no-data">No lap data available</p>';
    return;
  }
  
  statsContent.innerHTML = `
    <div class="stat-item">
      <span class="stat-label">Total Laps:</span>
      <span class="stat-value">${stats.totalLaps}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Total Time:</span>
      <span class="stat-value">${formatTime(stats.totalTime)}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Average Split:</span>
      <span class="stat-value">${formatTime(stats.averageSplit)}</span>
    </div>
    <div class="stat-item highlight-green">
      <span class="stat-label">⚡ Fastest Split:</span>
      <span class="stat-value">${formatTime(stats.fastestSplit)}</span>
    </div>
    <div class="stat-item highlight-red">
      <span class="stat-label">🐌 Slowest Split:</span>
      <span class="stat-value">${formatTime(stats.slowestSplit)}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Consistency:</span>
      <span class="stat-value">${calculateConsistency(stats)}%</span>
    </div>
  `;
}

function calculateConsistency(stats) {
  if (stats.totalLaps < 2) return 100;
  const variance = ((stats.slowestSplit - stats.fastestSplit) / stats.averageSplit) * 100;
  const consistency = Math.max(0, 100 - variance);
  return consistency.toFixed(1);
}

// ========================================
// PRESET TIMERS
// ========================================
const presetTimers = [
  { name: '1 min', seconds: 60 },
  { name: '3 min', seconds: 180 },
  { name: '5 min', seconds: 300 },
  { name: '10 min', seconds: 600 },
  { name: '15 min', seconds: 900 },
  { name: '25 min (Pomodoro)', seconds: 1500 },
  { name: '30 min', seconds: 1800 },
  { name: '45 min', seconds: 2700 },
  { name: '1 hour', seconds: 3600 }
];

function setPresetTimer(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  document.getElementById('hoursInput').value = hours || '';
  document.getElementById('minutesInput').value = minutes || '';
  document.getElementById('secondsInput').value = secs || '';
  
  playSound();
  showNotification(`Timer set to ${formatTime(seconds * 1000)}`);
}

function togglePresets() {
  const presetsPanel = document.getElementById('presetsPanel');
  presetsPanel.style.display = presetsPanel.style.display === 'none' ? 'block' : 'none';
  playSound();
}

// ========================================
// THEME PRESETS
// ========================================
const themePresets = {
  default: '#2575fc',
  ocean: '#00b4d8',
  forest: '#52b788',
  sunset: '#ff6b6b',
  purple: '#9d4edd',
  gold: '#f77f00',
  rose: '#e63946',
  mint: '#06ffa5',
  lavender: '#b8a3d6'
};

function applyThemePreset(themeName) {
  accentColor = themePresets[themeName];
  localStorage.setItem('accentColor', accentColor);
  applyAccentColor();
  playSound();
  showNotification(`${themeName.charAt(0).toUpperCase() + themeName.slice(1)} theme applied!`);
}

function toggleThemePicker() {
  const themePanel = document.getElementById('themePickerPanel');
  themePanel.style.display = themePanel.style.display === 'none' ? 'block' : 'none';
  playSound();
}

// ========================================
// SESSION HISTORY
// ========================================
function saveSession() {
  if (lapData.length === 0) {
    alert('No laps to save!');
    return;
  }

  const sessionName = prompt('Enter session name:', `Session ${new Date().toLocaleDateString()}`);
  if (!sessionName) return;
  
  const sessions = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
  const session = {
    id: Date.now(),
    name: sessionName,
    date: new Date().toISOString(),
    laps: lapData,
    stats: calculateLapStats()
  };
  
  sessions.unshift(session);
  // Keep only last 50 sessions
  if (sessions.length > 50) sessions.pop();
  
  localStorage.setItem('sessionHistory', JSON.stringify(sessions));
  playSound();
  showNotification('Session saved!');
}

function viewHistory() {
  const sessions = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
  const historyPanel = document.getElementById('historyPanel');
  const historyContent = document.getElementById('historyContent');
  
  if (sessions.length === 0) {
    historyContent.innerHTML = '<p class="no-data">No saved sessions yet</p>';
  } else {
    historyContent.innerHTML = sessions.map(session => `
      <div class="history-item">
        <div class="history-header">
          <strong>${session.name}</strong>
          <span class="history-date">${new Date(session.date).toLocaleString()}</span>
        </div>
        <div class="history-stats">
          <span>Laps: ${session.stats.totalLaps}</span>
          <span>Best: ${formatTime(session.stats.fastestSplit)}</span>
          <span>Total: ${formatTime(session.stats.totalTime)}</span>
        </div>
        <div class="history-actions">
          <button onclick="loadSession(${session.id})" class="small-btn">Load</button>
          <button onclick="deleteSession(${session.id})" class="small-btn delete-btn">Delete</button>
        </div>
      </div>
    `).join('');
  }
  
  historyPanel.style.display = historyPanel.style.display === 'none' ? 'block' : 'none';
  playSound();
}

function loadSession(sessionId) {
  const sessions = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
  const session = sessions.find(s => s.id === sessionId);
  
  if (session) {
    if (confirm(`Load "${session.name}"? This will replace current laps.`)) {
      lapData = session.laps;
      stopwatchMilliseconds = session.laps[session.laps.length - 1].time;
      renderLaps();
      updateDisplay();
      saveToLocalStorage();
      viewHistory(); // Close panel
      showNotification('Session loaded!');
      playSound();
    }
  }
}

function deleteSession(sessionId) {
  let sessions = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
  sessions = sessions.filter(s => s.id !== sessionId);
  localStorage.setItem('sessionHistory', JSON.stringify(sessions));
  viewHistory(); // Refresh display
  showNotification('Session deleted');
  playSound();
}

function clearAllHistory() {
  if (confirm('Delete all saved sessions? This cannot be undone!')) {
    localStorage.removeItem('sessionHistory');
    viewHistory(); // Refresh display
    showNotification('All sessions cleared');
    playSound();
  }
}

// ========================================
// LAP COMPARISON CHART
// ========================================
function toggleChart() {
  const chartPanel = document.getElementById('chartPanel');
  const isVisible = chartPanel.style.display !== 'none';
  
  if (isVisible) {
    chartPanel.style.display = 'none';
  } else {
    renderChart();
    chartPanel.style.display = 'block';
  }
  playSound();
}

function renderChart() {
  const chartContainer = document.getElementById('chartContainer');
  
  if (lapData.length === 0) {
    chartContainer.innerHTML = '<p class="no-data">No lap data to visualize</p>';
    return;
  }
  
  const splits = lapData.map(lap => lap.split);
  const maxSplit = Math.max(...splits);
  const minSplit = Math.min(...splits);
  const avgSplit = splits.reduce((a, b) => a + b, 0) / splits.length;
  
  let chartHTML = '<div class="chart-bars">';
  
  lapData.forEach(lap => {
    const height = (lap.split / maxSplit) * 100;
    let barClass = 'chart-bar';
    if (lap.split === minSplit) barClass += ' fastest-bar';
    if (lap.split === maxSplit) barClass += ' slowest-bar';
    
    chartHTML += `
      <div class="chart-bar-container">
        <div class="${barClass}" style="height: ${height}%;" title="Lap ${lap.number}: ${formatTime(lap.split)}">
          <span class="bar-label">${lap.number}</span>
        </div>
      </div>
    `;
  });
  
  chartHTML += '</div>';
  chartHTML += `
    <div class="chart-legend">
      <div class="legend-item">
        <span class="legend-color fastest-color"></span>
        <span>Fastest: ${formatTime(minSplit)}</span>
      </div>
      <div class="legend-item">
        <span class="legend-color avg-color"></span>
        <span>Average: ${formatTime(avgSplit)}</span>
      </div>
      <div class="legend-item">
        <span class="legend-color slowest-color"></span>
        <span>Slowest: ${formatTime(maxSplit)}</span>
      </div>
    </div>
  `;
  
  chartContainer.innerHTML = chartHTML;
}

// Update renderLaps to also update stats and chart
const originalRecordLap = recordLap;
recordLap = function() {
  originalRecordLap();
  if (document.getElementById('statsPanel').style.display !== 'none') {
    updateStatsDisplay();
  }
  if (document.getElementById('chartPanel').style.display !== 'none') {
    renderChart();
  }
};

// ========================================
// UTILITY FUNCTIONS
// ========================================
function goToRegister() {
  window.location.href = 'register.html';
}
