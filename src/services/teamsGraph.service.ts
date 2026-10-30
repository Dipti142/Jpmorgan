import { graphApi } from "../config/axios.config";

export const getJson = async <T>(path: string, headers?: Record<string, string>): Promise<T> => {
    const { data } = await graphApi.get<T>(path, { headers });
    return data;
};

export const postJson = async <T>(
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
): Promise<T> => {
    const { data } = await graphApi.post<T>(path, body, { headers });
    return data;
};

export const patchJson = async <T>(path: string, body: unknown): Promise<T> => {
    const { data } = await graphApi.patch<T>(path, body);
    return data;
};

export const del = async (path: string): Promise<void> => {
    await graphApi.delete(path);
};
