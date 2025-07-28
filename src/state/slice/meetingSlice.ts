import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { loadAuthData } from './authSlice';
import { Meeting, MeetingState } from '../types/meeting';

const initialState: MeetingState = {
    meetings: [],
    loading: false,
    error: null,
    successMessage: null,
};

const saveMeetingsToStorage = (allMeetings: Meeting[]) => {
    if (chrome && chrome.storage) {
        chrome.storage.local.set({ allMeetings: allMeetings }, () => { });
    }
};

const loadMeetingsFromStorage = async (): Promise<Meeting[]> => {
    try {
        if (chrome && chrome.storage) {
            const result = await chrome.storage.local.get('allMeetings');
            return result.allMeetings || [];
        }
        return [];
    } catch (error) {
        console.error('Error loading meetings from storage:', error);
        return [];
    }
};

export const fetchAllMeetings = createAsyncThunk<
    Meeting[],
    void,
    { rejectValue: string }
>('meeting/fetchAll', async (_, { rejectWithValue }) => {
    const QAPI = process.env.REACT_APP_QAPI_URL;
    const authData = await loadAuthData();
    const url = new URL(`${QAPI}/meetings`);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authData.token}`,
            },
        });

        if (response.status !== 200) {
            throw new Error('Error retrieving meetings');
        }

        const data: Meeting[] = await response.json();
        saveMeetingsToStorage(data);
        return data;
    } catch (error: any) {
        return rejectWithValue(error.message || 'Failed to fetch meetings');
    }
});

export const deleteMeeting = createAsyncThunk<
    void,
    number,
    { rejectValue: string }
>('meeting/delete', async (meetingId: number, { rejectWithValue }) => {
    const QAPI = process.env.REACT_APP_QAPI_URL;
    const authData = await loadAuthData();
    const url = new URL(`${QAPI}/meetings/${meetingId}`);

    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authData.token}`,
            },
        });

        if (response.status !== 200) {
            if (response.status === 404) {
                throw new Error('Meeting not found or does not belong to the user.');
            }
            throw new Error('Failed to delete meeting');
        }

        return;
    } catch (error: any) {
        return rejectWithValue(error.message || 'Failed to delete meeting');
    }
});

export const initializeMeetings = () => async (dispatch: any) => {
    const savedMeetings = await loadMeetingsFromStorage();
    dispatch(setMeetings(savedMeetings));
};

const meetingsSlice = createSlice({
    name: 'meetings',
    initialState,
    reducers: {
        setMeetings: (state, action: PayloadAction<Meeting[]>) => {
            state.meetings = action.payload;
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAllMeetings.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAllMeetings.fulfilled, (state, action: PayloadAction<Meeting[]>) => {
                state.loading = false;
                state.meetings = action.payload;
                state.error = null;
            })
            .addCase(fetchAllMeetings.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || 'An unknown error occurred';
            })
            .addCase(deleteMeeting.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.successMessage = null;
            })
            .addCase(deleteMeeting.fulfilled, (state, action) => {
                state.loading = false;
                state.meetings = state.meetings.filter((meeting) => meeting.id !== action.meta.arg);
                saveMeetingsToStorage(state.meetings);
                state.successMessage = 'Meeting deleted successfully!';
            })
            .addCase(deleteMeeting.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || 'An unknown error occurred';
            });
    },
});

export const { setMeetings } = meetingsSlice.actions;
export default meetingsSlice.reducer;