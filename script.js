class BabyFeedingTracker {
    constructor() {
        this.initializeVariables();
        this.initializeElements();
        this.setupEventListeners();
        this.initializeDB();
        this.checkOnlineStatus();
    }

    initializeVariables() {
        this.isFeeding = false;
        this.startTime = null;
        this.timer = null;
        this.db = null;
        this.currentAmount = 0;
    }

    initializeElements() {
        this.startButton = document.querySelector('.action-button');
        this.timerDisplay = document.querySelector('.timer');
        this.milkInput = document.querySelector('.milk-input');
        this.amountDisplay = document.querySelector('.amount-display');
        this.saveButton = document.querySelector('.save-button');
        this.historyButton = document.querySelector('.history-button');
        this.adjustButtons = document.querySelectorAll('.amount-adjust');
    }

    setupEventListeners() {
        // Start/Stop button
        this.startButton.addEventListener('click', () => {
            if (this.isFeeding) {
                this.stopFeeding();
            } else {
                this.startFeeding();
            }
        });

        // Amount adjustment buttons
        this.adjustButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const adjustment = parseInt(e.target.dataset.adjust);
                this.updateAmount(adjustment);
                this.vibrate();
            });
        });

        // Save button
        this.saveButton.addEventListener('click', () => {
            this.saveSession();
            this.vibrate();
        });

        // History button
        this.historyButton.addEventListener('click', () => {
            this.toggleHistory();
            this.vibrate();
        });

        // Online/Offline detection
        window.addEventListener('online', () => this.handleOnlineStatus(true));
        window.addEventListener('offline', () => this.handleOnlineStatus(false));
    }

    initializeDB() {
        const request = indexedDB.open('BabyFeedingDB', 1);

        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('sessions')) {
                const store = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
                store.createIndex('startTime', 'startTime');
                store.createIndex('syncStatus', 'syncStatus');
            }
        };

        request.onsuccess = (event) => {
            this.db = event.target.result;
            this.loadHistory();
        };
    }

    startFeeding() {
        this.isFeeding = true;
        this.startTime = new Date();
        this.updateStartButtonUI(true);
        this.startTimer();
        this.vibrate();
    }

    stopFeeding() {
        this.isFeeding = false;
        clearInterval(this.timer);
        this.updateStartButtonUI(false);
        this.showMilkInput();
        this.vibrate();
    }

    startTimer() {
        this.timer = setInterval(() => {
            const elapsed = new Date() - this.startTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            this.timerDisplay.textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    updateStartButtonUI(isFeeding) {
        const button = this.startButton;
        if (isFeeding) {
            button.innerHTML = '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
            button.classList.add('active');
        } else {
            button.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
            button.classList.remove('active');
        }
    }

    updateAmount(adjustment) {
        this.currentAmount = Math.max(0, this.currentAmount + adjustment);
        this.amountDisplay.textContent = this.currentAmount;
    }

    async saveSession() {
        const session = {
            startTime: this.startTime,
            endTime: new Date(),
            duration: new Date() - this.startTime,
            amount: this.currentAmount,
            syncStatus: navigator.onLine ? 'synced' : 'pending'
        };

        try {
            await this.saveToIndexedDB(session);
            this.resetUI();
            this.loadHistory();
            this.showToast('Feeding session saved');
        } catch (error) {
            console.error('Error saving session:', error);
            this.showToast('Error saving session', true);
        }
    }

    async saveToIndexedDB(session) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readwrite');
            const store = transaction.objectStore('sessions');
            const request = store.add(session);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async loadHistory() {
        const transaction = this.db.transaction(['sessions'], 'readonly');
        const store = transaction.objectStore('sessions');
        const request = store.getAll();

        request.onsuccess = () => {
            const sessions = request.result;
            this.updateHistoryUI(sessions);
        };
    }

    updateHistoryUI(sessions) {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;

        historyList.innerHTML = '';
        sessions
            .sort((a, b) => b.startTime - a.startTime)
            .slice(0, 10)
            .forEach(session => {
                const item = document.createElement('div');
                item.className = 'history-item';
                const duration = Math.floor(session.duration / 60000);
                const date = new Date(session.startTime).toLocaleString();
                item.innerHTML = `
                    <div class="history-time">${date}</div>
                    <div class="history-details">
                        ${duration} min | ${session.amount}ml
                        ${session.syncStatus === 'pending' ? '⚠️' : ''}
                    </div>
                `;
                historyList.appendChild(item);
            });
    }

    resetUI() {
        this.timerDisplay.textContent = '00:00';
        this.currentAmount = 0;
        this.amountDisplay.textContent = '0';
        this.milkInput.classList.remove('visible');
        this.updateStartButtonUI(false);
    }

    showMilkInput() {
        this.milkInput.classList.add('visible');
    }

    vibrate() {
        if ('vibrate' in navigator) {
            navigator.vibrate(50);
        }
    }

    showToast(message, isError = false) {
        const toast = document.createElement('div');
        toast.className = `toast ${isError ? 'error' : 'success'}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    handleOnlineStatus(isOnline) {
        const offlineStatus = document.getElementById('offlineStatus');
        if (offlineStatus) {
            offlineStatus.classList.toggle('visible', !isOnline);
        }
        if (isOnline) {
            this.syncPendingSessions();
        }
    }

    checkOnlineStatus() {
        this.handleOnlineStatus(navigator.onLine);
    }

    async syncPendingSessions() {
        const transaction = this.db.transaction(['sessions'], 'readwrite');
        const store = transaction.objectStore('sessions');
        const index = store.index('syncStatus');
        const request = index.getAll('pending');

        request.onsuccess = () => {
            const pendingSessions = request.result;
            pendingSessions.forEach(async session => {
                try {
                    // Here you would typically sync with your backend
                    // For now, we'll just mark it as synced
                    session.syncStatus = 'synced';
                    await this.updateSession(session);
                } catch (error) {
                    console.error('Sync error:', error);
                }
            });
        };
    }

    async updateSession(session) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readwrite');
            const store = transaction.objectStore('sessions');
            const request = store.put(session);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new BabyFeedingTracker();
});
