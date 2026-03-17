/**
 * metered.d.ts
 * Shared structural type declarations for the Metered.ca WebRTC SDK.
 * The SDK is loaded via CDN <script> tag — these types let TypeScript
 * validate call sites without requiring an npm package.
 */

export interface MeteredMeeting {
    /** Join a meeting room */
    join(options: {
        roomURL: string;
        participantName?: string;
        accessToken?: string;
        meetingToken?: string;
        video?: boolean;
        audio?: boolean;
    }): Promise<void>;
    /** Leave / disconnect from the current room */
    leaveMeeting?: () => void;
    /** Register an event listener (SDK-level events) */
    on(event: string, handler: (...args: unknown[]) => void): void;
    /** Retrieve current participant list */
    getParticipants?: () => Promise<unknown[]>;
    /** Audio controls */
    muteAudio?: () => void;
    unmuteAudio?: () => void;
    /** Video controls */
    stopVideo?: () => void;
    startVideo?: () => void;
    /** Screen share */
    shareScreen?: () => void;
    stopScreenShare?: () => void;
}

export interface MeteredSDK {
    Meeting: new () => MeteredMeeting;
}

declare global {
    interface Window {
        /** Metered.ca WebRTC SDK — populated by the CDN <script> tag */
        Metered: MeteredSDK;
    }
}
