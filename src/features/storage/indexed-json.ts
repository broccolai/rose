import { createStore, del, get, set } from 'idb-keyval';

const DATABASE_NAME = 'rose-cache-v2';
const STORE_NAME = 'json';

type StoredJson<T> = {
    key: string;
    value: T;
    updatedAt: string;
};

const jsonStore = createStore(DATABASE_NAME, STORE_NAME);

export const readJsonCache = async <T>(key: string): Promise<StoredJson<T> | null> => {
    const cached = await get<StoredJson<T>>(key, jsonStore);
    return cached ?? null;
};

export const writeJsonCache = async <T>(key: string, value: T): Promise<void> => {
    await set(
        key,
        {
            key,
            value,
            updatedAt: new Date().toISOString()
        } satisfies StoredJson<T>,
        jsonStore
    );
};

export const deleteJsonCache = async (key: string): Promise<void> => {
    await del(key, jsonStore);
};
