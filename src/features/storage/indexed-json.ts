const DATABASE_NAME = 'rose-cache';
const DATABASE_VERSION = 1;
const STORE_NAME = 'json';

type StoredJson<T> = {
    key: string;
    value: T;
    updatedAt: string;
};

function openDatabase() {
    return new Promise<IDBDatabase>((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB is not available in this environment.'));
            return;
        }

        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

        request.onupgradeneeded = () => {
            request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
    });
}

export async function readJsonCache<T>(key: string) {
    const database = await openDatabase();

    try {
        return await new Promise<StoredJson<T> | null>((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onsuccess = () => resolve((request.result as StoredJson<T> | undefined) ?? null);
            request.onerror = () => reject(request.error ?? new Error(`Failed to read cache entry ${key}.`));
        });
    } finally {
        database.close();
    }
}

export async function writeJsonCache<T>(key: string, value: T) {
    const database = await openDatabase();

    try {
        await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put({
                key,
                value,
                updatedAt: new Date().toISOString()
            } satisfies StoredJson<T>);

            request.onerror = () => reject(request.error ?? new Error(`Failed to write cache entry ${key}.`));
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error ?? new Error(`Failed to commit cache entry ${key}.`));
        });
    } finally {
        database.close();
    }
}

export async function deleteJsonCache(key: string) {
    const database = await openDatabase();

    try {
        await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(key);

            request.onerror = () => reject(request.error ?? new Error(`Failed to delete cache entry ${key}.`));
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error ?? new Error(`Failed to commit cache deletion ${key}.`));
        });
    } finally {
        database.close();
    }
}
