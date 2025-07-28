export interface Meeting {
    id: number;
    title: string;
    audioUrl: string;
    transcript: string;
    summary: {
        summary: string;
        actionItems: {
            title: string;
            content: string;
        }[];
        introduction: string;
        decisionsMade: {
            title: string;
            content: string;
        }[];
        topicsDiscussed: {
            title: string;
            content: string;
        }[];
    };
    base64Audio: string | null;
    uploadPending: boolean;
}

export interface MeetingState {
    meetings: Meeting[];
    loading: boolean;
    error: string | null
    successMessage: string | null
}