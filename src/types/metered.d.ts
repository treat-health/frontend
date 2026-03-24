/**
 * metered.d.ts
 * Shared structural type declarations for the Metered.ca WebRTC SDK v1.4.6.
 * The SDK is loaded via CDN <script> tag — these types let TypeScript
 * validate call sites without requiring an npm package.
 *
 * Reference: https://www.metered.ca/docs/sdk/javascript/methods
 */

export interface MeteredMeeting {
    /** Join a meeting room — only documented parameters are typed */
    join(options: {
        roomURL: string;
        name: string;
        accessToken?: string;
        receiveVideoStreamType?: 'none' | 'only_individual' | 'only_composed' | 'all';
        receiveAudioStreamType?: 'none' | 'only_individual' | 'only_composed' | 'all';
    }): Promise<void>;

    /** Leave / disconnect from the current room */
    leaveMeeting(): void;

    /** Register an event listener (SDK-level events) */
    on(event: string, handler: (...args: unknown[]) => void): void;

    /** Unregister an event listener */
    off?(event: string, handler: (...args: unknown[]) => void): void;

    /** Retrieve current participant list */
    getParticipants(): Promise<unknown[]>;

    /** Get the local video stream managed by the SDK */
    getLocalVideoStream?(): MediaStream;

    /** Video publishing — start/stop sharing video track to the SFU */
    startVideo(): Promise<void>;
    stopVideo(): void;

    /** Audio publishing — start/stop sharing audio track to the SFU */
    startAudio(): Promise<void>;
    stopAudio(): void;

    /** Audio muting — mute/unmute an ALREADY‑shared audio track (does not unpublish) */
    muteAudio(): void;
    unmuteAudio(): void;

    /** Screen share */
    shareScreen?(): void;
    stopScreenShare?(): void;

    /** Device switching */
    changeVideoInput?(deviceId: string): void;
    changeAudioInput?(deviceId: string): void;
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
