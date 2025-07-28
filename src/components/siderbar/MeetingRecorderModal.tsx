import React, { useState, useEffect, useRef } from 'react';
import './MeetingRecorderModal.css';
import { useSelector } from 'react-redux';
import { RootState } from '../../state';

const MeetingRecorderModal: React.FC<{
    handleClose: () => void;
    meetingUrl: string;
    setMeetingUrl: (value: React.SetStateAction<string>) => void;
    setPendingRecorderModal: (value: React.SetStateAction<boolean>) => void;
    setShowRecorderModal: (value: React.SetStateAction<boolean>) => void;
}> = ({ handleClose, meetingUrl, setMeetingUrl, setPendingRecorderModal, setShowRecorderModal }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [showWarning, setShowWarning] = useState(false);
    const [warningMessage, setWarningMessage] = useState<string | null>(null);
    const [showCloseDialog, setShowCloseDialog] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [completedMsg, setCompletedMsg] = useState<string | null>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [position, setPosition] = useState({ x: window.innerWidth - 60, y: window.innerHeight - 80 });
    const { token } = useSelector((state: RootState) => state.auth);
    const dragRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const [hasMoved, setHasMoved] = useState(false);

    useEffect(() => {
        console.log('MeetingRecorderModal.tsx: Querying recording state on mount');
        chrome.storage.local.get(['isMeetingRecording', 'meetingUrl', 'sessionStartTime', 'totalElapsedTime', 'totalPausedTime'], (result) => {
            if (chrome.runtime.lastError) {
                console.error('MeetingRecorderModal.tsx: Error querying recording state:', chrome.runtime.lastError.message);
                return;
            }
            console.log('MeetingRecorderModal.tsx: Received recording state:', result);
            if (result && result.isMeetingRecording && result.meetingUrl === meetingUrl) {
                const currentTime = Math.floor(Date.now() / 1000);
                const sessionStartTime = result.sessionStartTime || 0;
                const sessionElapsedTime = (currentTime - sessionStartTime) - Math.floor((result.totalPausedTime || 0) / 1000);
                const totalElapsedTime = (result.totalElapsedTime || 0) + (sessionElapsedTime > 0 ? sessionElapsedTime : 0);
                setIsRecording(true);
                setIsPaused(false);
                setRecordingTime(totalElapsedTime);
                console.log('MeetingRecorderModal.tsx: Initialized with ongoing recording - isRecording:', true, 'isPaused:', false, 'recordingTime:', totalElapsedTime);
                // Update sessionStartTime to now for the new session
                chrome.storage.local.set({ sessionStartTime: currentTime }, () => {
                    console.log('MeetingRecorderModal.tsx: Updated sessionStartTime:', currentTime);
                });
            } else {
                console.log('MeetingRecorderModal.tsx: No ongoing recording or URL mismatch');
                setRecordingTime(0);
            }
        });
    }, [meetingUrl]);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isMinimized) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setHasMoved(false);
        e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging && dragRef.current && dragStart) {
            const newX = e.clientX - 20;
            const newY = e.clientY - 20;

            const distance = Math.sqrt(
                Math.pow(e.clientX - dragStart.x, 2) + Math.pow(e.clientY - dragStart.y, 2)
            );
            if (distance > 5) {
                setHasMoved(true);
            }

            const boundedX = Math.max(0, Math.min(newX, window.innerWidth - 40));
            const boundedY = Math.max(0, Math.min(newY, window.innerHeight - 40));

            setPosition({ x: boundedX, y: boundedY });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDragStart(null);
    };

    const handleRestore = () => {
        if (!hasMoved) {
            console.log('MeetingRecorderModal.tsx: Restoring modal');
            setIsMinimized(false);
        }
    };

    useEffect(() => {
        if (isMinimized) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isMinimized, isDragging]);

    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (isRecording && !isPaused) {
            console.log('MeetingRecorderModal.tsx: Starting timer');
            timer = setInterval(() => {
                chrome.storage.local.get(['sessionStartTime', 'totalElapsedTime', 'totalPausedTime', 'isMeetingRecording', 'meetingUrl'], (result) => {
                    if (chrome.runtime.lastError) {
                        console.error('MeetingRecorderModal.tsx: Error querying storage:', chrome.runtime.lastError.message);
                        return;
                    }
                    if (result.isMeetingRecording && result.meetingUrl === meetingUrl) {
                        const currentTime = Math.floor(Date.now() / 1000);
                        const sessionStartTime = result.sessionStartTime || 0;
                        const sessionElapsedTime = (currentTime - sessionStartTime) - Math.floor((result.totalPausedTime || 0) / 1000);
                        const totalElapsedTime = (result.totalElapsedTime || 0) + (sessionElapsedTime > 0 ? sessionElapsedTime : 0);
                        setRecordingTime(totalElapsedTime);
                        console.log('MeetingRecorderModal.tsx: Updated recordingTime:', totalElapsedTime);
                    }
                });
            }, 1000);
        }
        return () => {
            console.log('MeetingRecorderModal.tsx: Clearing timer');
            clearInterval(timer);
        };
    }, [isRecording, isPaused, meetingUrl]);

    useEffect(() => {
        let hideWarningTimer: ReturnType<typeof setTimeout>;
        if (showWarning && warningMessage) {
            console.log('MeetingRecorderModal.tsx: Setting 8-second timeout to hide warning');
            hideWarningTimer = setTimeout(() => {
                console.log('MeetingRecorderModal.tsx: Hiding warning after 8 seconds');
                setShowWarning(false);
                setWarningMessage(null);
            }, 8000);
        }
        return () => {
            if (hideWarningTimer) {
                console.log('MeetingRecorderModal.tsx: Clearing hideWarningTimer');
                clearTimeout(hideWarningTimer);
            }
        };
    }, [showWarning, warningMessage]);

    useEffect(() => {
        const handleMessage = (msg: any) => {
            console.log('MeetingRecorderModal.tsx: Received message:', msg);
            if (msg.type === 'WARNING_2_MINUTES') {
                console.log('MeetingRecorderModal.tsx: Setting showWarning to true for 2-minute warning');
                setWarningMessage("Heads-up! Your meeting summary session ends in 2 minutes. Want to keep the recap going? Just click to start a new session and we’ll continue capturing everything for you — easy as that.");
                setShowWarning(true);
            } else if (msg.type === 'WARNING_1_MINUTE') {
                console.log('MeetingRecorderModal.tsx: Setting showWarning to true for 1-minute warning');
                setWarningMessage("Heads-up! Your meeting summary session ends in 1 minute. Want to keep the recap going? Just click to start a new session and we’ll continue capturing everything for you — easy as that.");
                setShowWarning(true);
            } else if (msg.type === 'RECORDING_ERROR') {
                console.log('MeetingRecorderModal.tsx: Recording error:', msg.error);
                setError(`Recording failed: ${msg.error}`);
                setIsRecording(false);
                setIsPaused(false);
                setRecordingTime(0);
                setShowWarning(false);
                setWarningMessage(null);
                setIsMinimized(false);
                chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: msg.error });
            } else if (msg.type === 'recordingComplete') {
                setCompletedMsg('File downloaded! Sending to server...');
                console.log('MeetingRecorderModal.tsx: File downloaded! Sending to server...');
                setIsRecording(false);
                setIsPaused(false);
                setRecordingTime(0);
                setShowWarning(false);
                setWarningMessage(null);
                setIsMinimized(false);
            } else if (msg.type === 'uploadComplete') {
                setCompletedMsg('Summary saved and sent to your email.');
                console.log('MeetingRecorderModal.tsx: Summary saved and sent to your email.');
                setIsRecording(false);
                setIsPaused(false);
                setRecordingTime(0);
                setShowWarning(false);
                setWarningMessage(null);
                setIsMinimized(false);
                setTimeout(() => {
                    setCompletedMsg('Your meeting summary session just wrapped up. Want to keep the recap going? Feel free to start a new session anytime—it’s just one click away.');
                    setMeetingUrl('');
                    setPendingRecorderModal(false);
                }, 6000);
            } else if (msg.type === 'CLOSE_CONSENT_MODAL') {
                setShowRecorderModal(false);
            }
        };
        chrome.runtime.onMessage.addListener(handleMessage);
        return () => {
            console.log('MeetingRecorderModal.tsx: Removing message listener');
            chrome.runtime.onMessage.removeListener(handleMessage);
        };
    }, [handleClose, setMeetingUrl, setPendingRecorderModal, setShowRecorderModal]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const handleStartRecording = async () => {
        console.log('MeetingRecorderModal.tsx: Start recording');
        setCompletedMsg(null);
        setWarningMessage(null);
        setShowWarning(false);

        // Step 1: Send mic activation request
        const micActivationResponse = await new Promise<boolean>((resolve) => {
            const listener = (message: any, sender: chrome.runtime.MessageSender) => {
                if (message.type === 'MICROPHONE_ACTIVATED') {
                    chrome.runtime.onMessage.removeListener(listener);
                    resolve(true);
                } else if (message.type === 'MICROPHONE_ERROR') {
                    chrome.runtime.onMessage.removeListener(listener);
                    console.error('Mic activation error:', message.error);
                    chrome.runtime.sendMessage({
                        type: 'RECORDING_ERROR',
                        error: message.error,
                    });
                    resolve(false);
                }
            };
            chrome.runtime.onMessage.addListener(listener);
            chrome.runtime.sendMessage({ type: 'ACTIVATE_MICROPHONE' });
        });

        if (!micActivationResponse) {
            console.warn('MeetingRecorderModal.tsx: Microphone activation failed. Aborting recording.');
            return;
        }

        // Step 2: Continue to recording
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];

        if (!activeTab || !activeTab.url || !activeTab.id) {
            chrome.runtime.sendMessage({
                type: 'RECORDING_ERROR',
                error: 'Error: No active tab found or URL missing. Please ensure you are on a meeting page.',
            });
            return;
        }

        console.log('MeetingRecorderModal.tsx: Attempting to record from Tab ID:', activeTab.id, 'URL:', activeTab.url);

        const nonCapturableProtocols = ['chrome:', 'chrome-extension:', 'about:', 'file:'];
        let urlObject: URL;
        try {
            urlObject = new URL(activeTab.url);
        } catch (e) {
            chrome.runtime.sendMessage({
                type: 'RECORDING_ERROR',
                error: 'Error: Invalid tab URL.',
            });
            console.error('MeetingRecorderModal.tsx: Invalid URL:', activeTab.url, e);
            return;
        }

        if (nonCapturableProtocols.includes(urlObject.protocol)) {
            chrome.runtime.sendMessage({
                type: 'RECORDING_ERROR',
                error: `Error: Cannot capture audio from '${urlObject.protocol}' pages. Please navigate to a regular website.`,
            });
            console.error('MeetingRecorderModal.tsx: Attempted to capture non-capturable URL:', activeTab.url);
            return;
        }

        console.log('MeetingRecorderModal.tsx: Sending START_RECORDING to background.js...');
        chrome.runtime.sendMessage({
            type: 'START_RECORDING',
            url: meetingUrl,
            token,
            tabId: activeTab.id,
        });

        setIsRecording(true);
    };

    const handlePauseResume = () => {
        if (isPaused) {
            console.log('MeetingRecorderModal.tsx: Resume recording');
            chrome.runtime.sendMessage({ type: 'RESUME_RECORDING', url: meetingUrl });
            setIsPaused(false);
        } else {
            console.log('MeetingRecorderModal.tsx: Pause recording');
            chrome.runtime.sendMessage({ type: 'PAUSE_RECORDING', url: meetingUrl });
            setIsPaused(true);
        }
    };

    const handleSave = () => {
        console.log('MeetingRecorderModal.tsx: Saving recording...');
        chrome.runtime.sendMessage({ type: 'SAVE_RECORDING', url: meetingUrl, token });
        setIsRecording(false);
        setIsPaused(false);
        setRecordingTime(0);
        setShowWarning(false);
        setWarningMessage(null);
        setIsMinimized(false);
    };

    const handleCloseClick = () => {
        if (isRecording) {
            console.log('MeetingRecorderModal.tsx: Close clicked during recording, showing dialog');
            setShowCloseDialog(true);
        } else {
            console.log('MeetingRecorderModal.tsx: Close clicked, no recording active');
            handleClose();
        }
    };

    const confirmClose = () => {
        console.log('MeetingRecorderModal.tsx: Confirming close, saving recording');
        handleSave();
        setShowCloseDialog(false);
        handleClose();
    };

    const cancelClose = () => {
        console.log('MeetingRecorderModal.tsx: Canceling close');
        setShowCloseDialog(false);
    };

    const handleMinimize = () => {
        console.log('MeetingRecorderModal.tsx: Minimizing modal');
        setIsMinimized(true);
    };

    return (
        <>
            {isMinimized ? (
                <div
                    ref={dragRef}
                    className="recorder-minimized"
                    onMouseDown={handleMouseDown}
                    onClick={handleRestore}
                    style={{ left: `${position.x}px`, top: `${position.y}px` }}
                >
                    <span className="recorder-icon">🎙️</span>
                    {isRecording && !isPaused && (
                        <span className="pulse-indicator minimized">
                            <span className="pulse"></span>
                            {formatTime(recordingTime)}
                        </span>
                    )}
                    {isRecording && isPaused && (
                        <span className="pulse-indicator paused minimized">
                            Paused
                        </span>
                    )}
                </div>
            ) : (
                <div className="recorder-modal-overlay">
                    <div className="recorder-modal-content">
                        <div className="modal-header">
                            <img src="images/minimize.svg" className="minimize-button"
                                alt="minimize" onClick={handleMinimize} />
                            <button className="close-button" onClick={handleCloseClick}>
                                ✕
                            </button>
                        </div>
                        <h3>Smart Summary Generator</h3>
                        <div className="recorder-status">
                            {error && (
                                <div className="error-message">
                                    {error}
                                </div>
                            )}
                            {completedMsg && (
                                <div className="completed-message">
                                    {completedMsg}
                                </div>
                            )}
                            {isRecording && (
                                <div className="pulse-indicator">
                                    <span className="pulse"></span> Generating Notes
                                </div>
                            )}
                            {isRecording && isPaused && (
                                <div className="pulse-indicator paused">
                                    Paused
                                </div>
                            )}
                            {isRecording && (
                                <div className="timer">
                                    {formatTime(recordingTime)}
                                </div>
                            )}
                            {showWarning && warningMessage && (
                                <div className="warning">
                                    {warningMessage}
                                </div>
                            )}
                        </div>
                        <div className="overlay-buttons">
                            {!isRecording ? (
                                <button onClick={handleStartRecording}>Start Summarizing</button>
                            ) : (
                                <>
                                    <button onClick={handlePauseResume}>
                                        {isPaused ? 'Resume' : 'Pause'}
                                    </button>
                                    <button onClick={handleSave}>Save</button>
                                </>
                            )}
                        </div>
                    </div>
                    {showCloseDialog && (
                        <div className="recorder-modal-overlay">
                            <div className="recorder-modal-content">
                                <h3>Save Generated Notes?</h3>
                                <p>Closing now will save the current generated notes. Continue?</p>
                                <div className="overlay-buttons">
                                    <button onClick={confirmClose}>Save and Close</button>
                                    <button onClick={cancelClose}>Cancel</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default MeetingRecorderModal;