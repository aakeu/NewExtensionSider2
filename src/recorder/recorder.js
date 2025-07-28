console.log("Offscreen: recorder.js script loaded.");

let mediaRecorder;
let recordedBlobs;
let mediaStream;
let audioContext;
let mediaStreamSource;
let micStream;
let micSource;
let recordingTimeout = null; // Track the MediaRecorder timeout

document.addEventListener('DOMContentLoaded', () => {
    console.log("Offscreen: DOMContentLoaded event fired. Recorder script is ready.");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error("Offscreen: navigator.mediaDevices.getUserMedia is not available in this context.");
        chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: 'MediaDevices API not available in offscreen document.' });
        return;
    }
    console.log("Offscreen: navigator.mediaDevices.getUserMedia is available.");

    chrome.runtime.onMessage.addListener(async (message) => {
        if (message.target !== 'offscreen') return;

        console.log("Offscreen: Received message:", message.type);

        if (message.type === 'startRecording') {
            const { streamId, duration, token, totalPausedTime } = message.data;
            console.log("Offscreen: Handling startRecording message with streamId:", streamId);
            console.log("Offscreen: Recording duration set to:", duration, "milliseconds");
            console.log("Offscreen: Initial totalPausedTime:", totalPausedTime);
            console.log("Offscreen: Token from background.js", token);

            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                console.warn("Offscreen: Stopping previous recorder before starting new one.");
                mediaRecorder.stop();
                if (mediaStream) {
                    mediaStream.getTracks().forEach(track => track.stop());
                }
                if (micStream) {
                    micStream.getTracks().forEach(track => track.stop());
                }
                if (audioContext) {
                    audioContext.close();
                }
            }

            recordedBlobs = [];

            console.log("Offscreen: Attempting to get tab audio with streamId:", streamId);
            mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    mandatory: {
                        chromeMediaSource: 'tab',
                        chromeMediaSourceId: streamId
                    }
                }
            });
            console.log("Offscreen: Successfully got tab MediaStream:", mediaStream);

            try {
                console.log("Offscreen: Waiting 500ms before requesting microphone access...");
                await new Promise(resolve => setTimeout(resolve, 500));

                console.log("Offscreen: Attempting to get microphone audio...");
                try {
                    micStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        }
                    });
                    console.log("Offscreen: Successfully got microphone MediaStream:", micStream);
                } catch (micError) {
                    console.error("Offscreen: Microphone access failed:", micError.name, micError.message);
                    throw micError;
                }

                console.log("Offscreen: Creating AudioContext...");
                audioContext = new AudioContext();

                const destination = audioContext.createMediaStreamDestination();
                mediaStreamSource = audioContext.createMediaStreamSource(mediaStream);
                mediaStreamSource.connect(destination);
                console.log("Offscreen: Tab audio connected to recording destination.");

                const speakerOutput = audioContext.destination;
                mediaStreamSource.connect(speakerOutput);
                console.log("Offscreen: Tab audio connected to speaker output for playback.");

                micSource = audioContext.createMediaStreamSource(micStream);
                micSource.connect(destination);
                console.log("Offscreen: Microphone audio connected to recording destination.");

                const combinedStream = destination.stream;
                console.log("Offscreen: Combined MediaStream created with", combinedStream.getAudioTracks().length, "audio tracks.");

                const audioTracks = combinedStream.getAudioTracks();
                if (audioTracks.length > 0) {
                    console.log("Offscreen: Combined stream audio track state:", {
                        enabled: audioTracks[0].enabled,
                        muted: audioTracks[0].muted,
                        readyState: audioTracks[0].readyState
                    });
                    if (!audioTracks[0].enabled || audioTracks[0].muted || audioTracks[0].readyState !== 'live') {
                        const errorMessage = "Combined audio track is not ready or is muted/disabled. Please ensure audio is active.";
                        console.error(errorMessage);
                        chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: errorMessage });
                        if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
                        if (micStream) micStream.getTracks().forEach(track => track.stop());
                        if (audioContext) audioContext.close();
                        return;
                    }
                } else {
                    const errorMessage = "Combined MediaStream has no audio tracks. Cannot record.";
                    console.error(errorMessage);
                    chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: errorMessage });
                    if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
                    if (micStream) micStream.getTracks().forEach(track => track.stop());
                    if (audioContext) audioContext.close();
                    return;
                }

                const mimeType = 'audio/webm;codecs=opus';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    const errorMessage = `MediaRecorder does not support ${mimeType}.`;
                    console.error(errorMessage);
                    chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: errorMessage });
                    if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
                    if (micStream) micStream.getTracks().forEach(track => track.stop());
                    if (audioContext) audioContext.close();
                    return;
                } else {
                    console.log(`Offscreen: MediaRecorder supports ${mimeType}.`);
                }

                mediaRecorder = new MediaRecorder(combinedStream, { mimeType: mimeType });
                console.log("Offscreen: MediaRecorder created for combined stream. Initial state:", mediaRecorder.state);

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) {
                        recordedBlobs.push(event.data);
                        // console.log("Offscreen: ondataavailable event received. Chunk size:", event.data.size, "bytes. Total blobs:", recordedBlobs.length);
                    } else {
                        console.warn("Offscreen: ondataavailable event received, but data is empty or null.");
                    }
                };

                mediaRecorder.onstart = () => {
                    console.log("Offscreen: MediaRecorder STARTED. State:", mediaRecorder.state);
                };

                mediaRecorder.onpause = () => {
                    console.log("Offscreen: MediaRecorder PAUSED. State:", mediaRecorder.state);
                };

                mediaRecorder.onresume = () => {
                    console.log("Offscreen: MediaRecorder RESUMED. State:", mediaRecorder.state);
                };

                mediaRecorder.onstop = async () => {
                    console.log("Offscreen: MediaRecorder STOPPED. Final state:", mediaRecorder.state);
                    if (mediaStream) {
                        mediaStream.getTracks().forEach(track => track.stop());
                        console.log("Offscreen: Tab MediaStream tracks stopped.");
                    }
                    if (micStream) {
                        micStream.getTracks().forEach(track => track.stop());
                        console.log("Offscreen: Microphone MediaStream tracks stopped.");
                    }
                    if (audioContext) {
                        audioContext.close();
                        console.log("Offscreen: AudioContext closed.");
                    }

                    console.log("Offscreen: recordedBlobs array length before Blob creation:", recordedBlobs.length);
                    if (recordedBlobs.length > 0) {
                        console.log("Offscreen: First recordedBlob size:", recordedBlobs[0].size);
                        console.log("Offscreen: Last recordedBlob size:", recordedBlobs[recordedBlobs.length - 1].size);
                    }

                    if (recordedBlobs.length === 0) {
                        console.warn("Offscreen: No audio data was collected. Recorded Blobs length is 0.");
                        chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: 'No audio data captured.' });
                        return;
                    }

                    const mimeType = 'audio/webm;codecs=opus';
                    const blob = new Blob(recordedBlobs, { type: mimeType });
                    console.log("Offscreen: Created Blob:", blob);

                    console.log("Offscreen: Converting Blob to base64 string.");
                    const base64 = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            if (reader.result) {
                                const base64Data = reader.result.split(',')[1];
                                console.log("Offscreen: Base64 string length:", base64Data.length);
                                resolve(base64Data);
                            } else {
                                reject(new Error("FileReader result is null or empty."));
                            }
                        };
                        reader.onerror = () => reject(new Error(`FileReader error: ${reader.error.name}`));
                        reader.readAsDataURL(blob);
                    });

                    console.log("Offscreen: Sending base64 string to background script for download.");
                    try {
                        await chrome.runtime.sendMessage({
                            type: 'downloadRecording',
                            base64: base64,
                            mimeType: mimeType,
                            filename: `recording-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.webm`,
                            authToken: token
                        });
                        console.log("Offscreen: Successfully sent base64 string to background script.");
                    } catch (error) {
                        console.error("Offscreen: Error sending base64 string to background script:", error);
                        chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: `Failed to send recording: ${error.message}` });
                    }

                    console.log("Offscreen: Cleaning up recorder state variables.");
                    recordedBlobs = null;
                    mediaRecorder = null;
                    mediaStream = null;
                    micStream = null;
                    audioContext = null;
                    mediaStreamSource = null;
                    micSource = null;
                };

                mediaRecorder.onerror = (event) => {
                    console.error('Offscreen: MediaRecorder ERROR:', event.error);
                    chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: `MediaRecorder error: ${event.error.name}` });
                    if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
                    if (micStream) micStream.getTracks().forEach(track => track.stop());
                    if (audioContext) audioContext.close();
                    recordedBlobs = null;
                    mediaRecorder = null;
                    mediaStream = null;
                    micStream = null;
                    audioContext = null;
                    mediaStreamSource = null;
                    micSource = null;
                };

                mediaRecorder.start(10);
                console.log("Offscreen: MediaRecorder start() called. Current state:", mediaRecorder.state);

                if (recordingTimeout) clearTimeout(recordingTimeout);
                recordingTimeout = setTimeout(() => {
                    if (mediaRecorder && mediaRecorder.state === 'recording') {
                        console.log("Offscreen: Timeout reached. Stopping MediaRecorder.");
                        mediaRecorder.stop();
                    } else {
                        console.log("Offscreen: Timeout reached, but MediaRecorder not in 'recording' state (current state: " + (mediaRecorder ? mediaRecorder.state : 'null') + ").");
                    }
                }, duration + totalPausedTime); // Adjust for paused time
                console.log("Offscreen: Set recording timeout for", duration + totalPausedTime, "ms");
            } catch (error) {
                let errorMessage;
                if (error.name === "NotAllowedError") {
                    errorMessage = "Microphone permission was denied. Please grant permission to record all voices.";
                } else if (error.name === 'NotFoundError') {
                    errorMessage = "No microphone found. Please connect a microphone and try again.";
                } else {
                    errorMessage = `Recording setup failed: ${error.message}`;
                }

                console.error("Offscreen: ", errorMessage);
                chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: errorMessage });
                if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
                if (micStream) micStream.getTracks().forEach(track => track.stop());
                if (audioContext) audioContext.close();
                recordedBlobs = null;
                mediaRecorder = null;
                mediaStream = null;
                micStream = null;
                audioContext = null;
                mediaStreamSource = null;
                micSource = null;
                return;
            }
        } else if (message.type === 'stopRecording') {
            console.log("Offscreen: Received stopRecording message.");
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                console.log("Offscreen: MediaRecorder manually stopped.");
            }
            if (recordingTimeout) {
                clearTimeout(recordingTimeout);
                recordingTimeout = null;
                console.log("Offscreen: Cleared recording timeout on stop.");
            }
        } else if (message.type === 'pauseRecording') {
            console.log("Offscreen: Received pauseRecording message.");
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.pause();
                console.log("Offscreen: MediaRecorder paused.");
                if (recordingTimeout) {
                    clearTimeout(recordingTimeout);
                    recordingTimeout = null;
                    console.log("Offscreen: Cleared recording timeout on pause.");
                }
            }
        } else if (message.type === 'resumeRecording') {
            console.log("Offscreen: Received resumeRecording message.");
            if (mediaRecorder && mediaRecorder.state === 'paused') {
                mediaRecorder.resume();
                console.log("Offscreen: MediaRecorder resumed.");
            }
        } else if (message.type === 'updateRecordingTimeout') {
            const { duration, totalPausedTime } = message.data;
            console.log("Offscreen: Received updateRecordingTimeout with duration:", duration, "totalPausedTime:", totalPausedTime);
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                if (recordingTimeout) clearTimeout(recordingTimeout);
                recordingTimeout = setTimeout(() => {
                    if (mediaRecorder && mediaRecorder.state === 'recording') {
                        console.log("OffOffscreen: Updated timeout reached. Stopping MediaRecorder.");
                        mediaRecorder.stop();
                    } else {
                        console.log("Offscreen: Updated timeout reached, but MediaRecorder not in 'recording' state (current state: " + (mediaRecorder ? mediaRecorder.state : 'null') + ").");
                    }
                }, duration + totalPausedTime); // Adjust for paused time
                console.log("Offscreen: Set updated recording timeout for", duration + totalPausedTime, "ms");
            } else {
                console.warn("Offscreen: Received updateRecordingTimeout but MediaRecorder is not recording. State:", mediaRecorder ? mediaRecorder.state : 'null');
            }
        }
    });
});