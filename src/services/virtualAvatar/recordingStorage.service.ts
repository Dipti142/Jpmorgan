import FormData from "form-data";
import { fileServiceApi } from "../../config/axios.config";
import { Env } from "../../config/env.config";
import { IStoredRecording } from "../../interfaces/IMeeting.interface";


/** One upload. A recording over the bucket's cap is several of these - see storeInParts. */
export const storeRecording = async (
    file: Buffer,
    fileName: string,
): Promise<Omit<IStoredRecording, "parts">> => {
    if (
        !Env.virtualAvatar.VA_FILE_SERVICE_URL ||
        !Env.virtualAvatar.VA_FILE_SERVICE_API_KEY ||
        !Env.virtualAvatar.VA_FILE_SERVICE_BUCKET
    ) {
        throw new Error(
            "Recording storage is not configured - set VA_FILE_SERVICE_URL, VA_FILE_SERVICE_API_KEY and VA_FILE_SERVICE_BUCKET",
        );
    }

    const form = new FormData();
    // knownLength so the body carries a Content-Length - the gateway rejects a chunked upload.
    form.append("file", file, {
        filename: fileName,
        contentType: "video/mp4",
        knownLength: file.length,
    });
    form.append("wordCount", "false");
    form.append("destinationPath", Env.virtualAvatar.VA_FILE_SERVICE_PATH);

    const { data } = await fileServiceApi.post<{ data: { filePath: string; fileName: string } }>(
        "/files/upload",
        form,
        {
            headers: { ...form.getHeaders(), "Content-Length": String(form.getLengthSync()) },
            timeout: 600_000,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
        },
    );

    if (!data?.data?.filePath) {
        throw new Error("upload response carried no filePath");
    }

    return {
        storageKind: "gateway",
        storagePath: data.data.filePath,
        storageUrl: null,
        fileName: data.data.fileName ?? fileName,
        sizeBytes: file.length,
    };
};

/** The returned link is relative to the file service, and expires. Minted per request, never stored. */
export const presignStoredRecording = async (
    stored: { storage_kind: string | null; storage_path: string | null },
    expiresInSeconds: number = Env.virtualAvatar.VA_RECORDING_URL_TTL_SECONDS,
): Promise<{ url: string; expiresAt: number | null }> => {
    if (stored.storage_kind !== "gateway" || !stored.storage_path) {
        throw new Error("No stored object for this recording");
    }

    const { data } = await fileServiceApi.post<{ data: { url: string; expiresAt?: number } }>(
        "/files/get-presigned-url",
        { key: stored.storage_path, expiresInSeconds },
    );

    if (!data?.data?.url) {
        throw new Error("presign response carried no url");
    }
    return {
        url: `${Env.virtualAvatar.VA_FILE_SERVICE_URL}${data.data.url}`,
        expiresAt: data.data.expiresAt ?? null,
    };
};
