/** One avatar and the voice that belongs to it. Never paired at runtime. */
export interface IAnamAvatarChoice {
    avatarKey: string;
    displayName: string;
    presentation: string | null;
}

/** Anam rejects `neutral`, `brisk` and the cue-only tags as presets. */
export type AnamPresetStyle = "happy" | "warm" | "playful" | "supportive" | "sad" | "angry" | "distressed";

export type AnamDirectorNotes =
    | { presetStyle: AnamPresetStyle; customStylePrompt?: never; expressivity?: number }
    | { customStylePrompt: string; presetStyle?: never; expressivity?: number }
    | { expressivity: number; presetStyle?: never; customStylePrompt?: never };

export interface IAnamPersonaConfig {
    name: string;
    avatarId: string;
    avatarModel: string;
    voiceId: string;
    llmId?: string;
    systemPrompt?: string;
    directorNotes?: AnamDirectorNotes;
    toolIds?: string[];
    uninterruptibleGreeting?: boolean;
    languageCode?: string;
    voiceDetectionOptions?: {
        sttProvider?: "anam" | "deepgram" | "cartesia_ink_2";
        endOfSpeechSensitivity?: number;
        silenceBeforeSkipTurnSeconds?: number;
        silenceBeforeSessionEndSeconds?: number;
        silenceBeforeAutoEndTurnSeconds?: number;
        speechEnhancementLevel?: number;
    }
}

export interface IBuiltPersonaConfig {
    personaConfig: IAnamPersonaConfig;
    toolNames: string[];
}
