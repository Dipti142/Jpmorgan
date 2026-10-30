export const acsCall = async <T>(describe: string, run: () => Promise<T>): Promise<T> => {
    try {
        return await run();
    } catch (error: any) {
        // RestError.message already carries the unwrapped body, but it is empty on a 401.
        const reason = error?.message || error?.code || `HTTP ${error?.statusCode ?? "?"}`;
        throw new Error(`ACS ${describe} failed: ${reason}`);
    }
};

