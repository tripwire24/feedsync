class FeedingTracker {
    constructor() {
        this.initializeVariables();
        this.initializeElements();
        this.setupEventListeners();
        this.setupOfflineSupport();
        this.loadFeedingHistory();
        this.setupThemeSupport();
    }

    initializeVariables() {
        this.isFeeding = false;
        this.startTime = null;
        this.timerInterval = null;
        this.db = null;
        this.initializeDB();
    }

    initializeElements() {
        this.feedButton = document.getElementById('feedButton');
        this.timer = document.getElementById('timer');
        this.milkInput = document.getElementById('milkInput');
        this.milkAmount = document.getElementById('milkAmount');
        this.saveButton = document.getElementById('saveButton');
        this.historyList = document.getElementById('historyList');
        this.offlineStatus = document.getElementById('offlineStatus');
        this.themeToggle = document.getElementById('themeToggle');
    }

    setupEventListeners() {
        this.feedButton.addEventListener('click', () => this.toggleFeeding());
        this.saveButton.addEventListener('click', () => this.saveSession());
        this.themeToggle.addEventListener('click', () => this.cycleTheme());
        
        // Add vibration feedback for buttons if supported
        if ('vibrate' in navigator) {
            const vibrateOnClick = (event) => {
                if (event.target.tagName === 'BUTTON') {
                    navigator.vibrate(50);
                }
            };
            document.addEventListener('click', vibrateOnClick);
        }
    }

    async initializeDB() {
        const request = indexedDB.open('FeedingTrackerDB', 1);

        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const store = db.createObjectStore('feedingSessions', {
                keyPath: 'id',
                autoIncrement: true
            });
            store.createIndex('startTime', 'startTime');
        };

        request.onsuccess = (event) => {
            this.db = event.target.result;
            this.loadFeedingHistory();
        };
    }

    toggleFeeding() {
        if (!this.isFeeding) {
            this.startFeeding();
        } else {
            this.stopFeeding();
        }
    }

    startFeeding() {
        this.isFeeding = true;
        this.startTime = new Date();
        this.feedButton.textContent = 'Stop Feed';
        this.feedButton.classList.add('active');
        
        this.timerInterval = setInterval(() => {
            const duration = new Date() - this.startTime;
            this.updateTimerDisplay(duration);
        }, 1000);
    }

    stopFeeding() {
        this.isFeeding = false;
        clearInterval(this.timerInterval);
        this.feedButton.textContent = 'Start Feed';
        this.feedButton.classList.remove('active');
        this.milkInput.classList.remove('hidden');
    }

    updateTimerDisplay(duration) {
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        this.timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    async saveSession() {
        const session = {
            startTime: this.startTime,
            endTime: new Date(),
            duration: new Date() - this.startTime,
            milkAmount: parseInt(this.milkAmount.value),
            syncStatus: navigator.onLine ? 'synced' : 'pending'
        };

        try {
            await this.saveToIndexedDB(session);
            this.milkInput.classList.add('hidden');
            this.timer.textContent = '00:00';
            this.milkAmount.value = 0;
            this.loadFeedingHistory();
        } catch (error) {
            console.error('Error saving session:', error);
        }
    }

    async saveToIndexedDB(session) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['feedingSessions'], 'readwrite');
            const store = transaction.objectStore('feedingSessions');
            const request = store.add(session);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async loadFeedingHistory() {
        const transaction = this.db.transaction(['feedingSessions'], 'readonly');
        const store = transaction.objectStore('feedingSessions');
        const request = store.getAll();

        request.onsuccess = () => {
            const sessions = request.result;
            this.displayFeedingHistory(sessions);
        };
    }

    displayFeedingHistory(sessions) {
        this.historyList.innerHTML = '';
        sessions.sort((a, b) => b.startTime - a.startTime).slice(0, 10).forEach(session => {
            const item = document.createElement('div');
            item.className = 'history-item';
            const duration = Math.floor(session.duration / 60000);
            const date = new Date(session.startTime).to