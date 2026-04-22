import CryptoJS from 'crypto-js';
import api from '../services/api';

const DB_NAME = 'password_manager_backup_db';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'backup_directory_handle';

const SETTINGS_KEY = 'backup_settings';
const LAST_BACKUP_KEY = 'backup_last_run_at';

function openDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function saveDirectoryHandle(handle) {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

export async function getDirectoryHandle() {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(HANDLE_KEY);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

export function loadBackupSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) {
            return {
                interval: 'never',
                directoryName: ''
            };
        }

        const parsed = JSON.parse(raw);
        return {
            interval: parsed.interval || 'never',
            directoryName: parsed.directoryName || ''
        };
    } catch {
        return {
            interval: 'never',
            directoryName: ''
        };
    }
}

export function saveBackupSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getLastBackupAt() {
    return localStorage.getItem(LAST_BACKUP_KEY);
}

export function setLastBackupAt(isoString) {
    localStorage.setItem(LAST_BACKUP_KEY, isoString);
}

export function getIntervalMs(interval) {
    switch (interval) {
        case 'hourly':
            return 60 * 60 * 1000;
        case 'daily':
            return 24 * 60 * 60 * 1000;
        case 'weekly':
            return 7 * 24 * 60 * 60 * 1000;
        case 'monthly':
            return 30 * 24 * 60 * 60 * 1000;
        case 'never':
        default:
            return null;
    }
}

export async function pickBackupDirectory() {
    if (!window.showDirectoryPicker) {
        throw new Error('Ваш браузер не поддерживает выбор папки');
    }

    const handle = await window.showDirectoryPicker({
        mode: 'readwrite'
    });

    await saveDirectoryHandle(handle);
    return handle;
}

export async function ensureDirectoryPermission(handle) {
    if (!handle) return false;

    const readWrite = { mode: 'readwrite' };

    const currentPermission = await handle.queryPermission(readWrite);

    if (currentPermission === 'granted') {
        return true;
    }

    const requestedPermission = await handle.requestPermission(readWrite);

    return requestedPermission === 'granted';
}

function convertToCSV(passwords) {
    const headers = ['site', 'login', 'password', 'group_name'];

    const rows = passwords.map((p) => [
        `"${(p.site || '').replace(/"/g, '""')}"`,
        `"${(p.login || '').replace(/"/g, '""')}"`,
        `"${(p.password || '').replace(/"/g, '""')}"`,
        `"${(p.group_name || '').replace(/"/g, '""')}"`
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

function buildBackupFilename() {
    const now = new Date();
    const safe = now.toISOString().slice(0, 19).replace(/:/g, '-');
    return `passwords_${safe}.csv`;
}

export async function createEncryptedBackup({ showToast = false, toastInstance = null }) {

    const masterPassword = localStorage.getItem('masterPassword');
    if (!masterPassword) {
        throw new Error('Мастер-пароль не найден');
    }

    let directoryHandle = await getDirectoryHandle();

    if (!directoryHandle) {
        directoryHandle = await pickBackupDirectory();
    }

    const hasPermission = await ensureDirectoryPermission(directoryHandle);
    if (!hasPermission) {
        throw new Error('Нет доступа к выбранной папке');
    }

    const response = await api.get('/passwords', {
        params: { master_password: masterPassword }
    });

    const passwords = response.data || [];

    const csvData = convertToCSV(passwords);

    const exportPackage = {
        version: '2.0',
        timestamp: new Date().toISOString(),
        data: csvData
    };

    const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify(exportPackage),
        masterPassword
    ).toString();

    const filename = buildBackupFilename();

    const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();

    await writable.write(encrypted);
    await writable.close();

    const nowIso = new Date().toISOString();
    setLastBackupAt(nowIso);

    const settings = loadBackupSettings();
    saveBackupSettings({
        ...settings,
        directoryName: directoryHandle.name || settings.directoryName || ''
    });

    if (showToast && toastInstance) {
        toastInstance.success('Резервное копирование выполнено');
    }

    return {
        fileName: filename,
        savedAt: nowIso,
        directoryName: directoryHandle.name || ''
    };
}

export async function runScheduledBackupIfNeeded(toastInstance = null) {
    const settings = loadBackupSettings();

    if (!settings || settings.interval === 'never') {
        return false;
    }

    const intervalMs = getIntervalMs(settings.interval);

    if (!intervalMs) return false;

    const lastBackupAt = getLastBackupAt();

    if (!lastBackupAt) {
        await createEncryptedBackup({ showToast: true, toastInstance });
        return true;
    }

    const lastTime = new Date(lastBackupAt).getTime();
    const now = Date.now();
    const diff = now - lastTime;

    if (diff >= intervalMs) {
        await createEncryptedBackup({ showToast: true, toastInstance });
        return true;
    }

    return false;
}