chrome.storage.local.get('sidebarState', (result) => {
  if (result.sidebarState === 'open') {
    toggleSidebar()
  }
})

function toggleSidebar() {
  const existingSidebar = document.getElementById('extension-sidebar')
  if (existingSidebar) {
    document.body.style.marginRight = '0'
    existingSidebar.remove()
  } else {
    const sidebarWidth = 400
    const sidebarHTML = `
        <div id="extension-sidebar" style="position:fixed;top:0;right:0;width:${sidebarWidth}px;height:100%;background-color:#f1f1f1;z-index:1000;box-shadow:-2px 0 5px rgba(0,0,0,0.1);">
          <div id="extension-sidebar-content" style="padding:10px;overflow-y:auto;height:100%;position:relative;">
            <button id="close-sidebar" style="position:absolute;top:10px;right:10px;background-color:red;color:white;border:none;border-radius:3px;cursor:pointer;padding:5px;">X</button>
            <h1 style="text-align:center;color:#007bff;margin-top:30px;">Bookmark Your Tabs</h1>
            <ul id="bookmark-list" style="list-style-type:none;padding:0;"></ul>
            <div id="resizer" style="position:absolute;width:10px;height:100%;top:0;left:-10px;cursor:ew-resize;"></div>
          </div>
        </div>
      `
    document.body.insertAdjacentHTML('beforeend', sidebarHTML)
    document.body.style.marginRight = `${sidebarWidth}px`

    const closeSidebarBtn = document.getElementById('close-sidebar')
    closeSidebarBtn.addEventListener('click', () => {
      chrome.storage.local.set({ sidebarState: 'closed' })
      document.body.style.marginRight = '0'
      document.getElementById('extension-sidebar').remove()
    })

    const resizer = document.getElementById('resizer')
    resizer.addEventListener('mousedown', initResize, false)

    function initResize(e) {
      window.addEventListener('mousemove', resize, false)
      window.addEventListener('mouseup', stopResize, false)
    }

    function resize(e) {
      const newWidth = window.innerWidth - e.clientX
      document.getElementById('extension-sidebar').style.width = newWidth + 'px'
      document.body.style.marginRight = newWidth + 'px'
    }

    function stopResize(e) {
      window.removeEventListener('mousemove', resize, false)
      window.removeEventListener('mouseup', stopResize, false)
    }

    chrome.runtime.sendMessage({ action: 'fetchTabs' })
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'populateTabs') {
    const bookmarkList = document.getElementById('bookmark-list')
    message.tabs.forEach((tab) => {
      const listItem = document.createElement('li')
      listItem.textContent = tab.title
      listItem.style =
        'background-color:#fff;margin:10px 0;padding:10px;border-radius:4px;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.1);'
      listItem.addEventListener('click', () => {
        chrome.bookmarks.create({ title: tab.title, url: tab.url })
      })
      bookmarkList.appendChild(listItem)
    })
  }
})


function readGoogleSearchResults() {
  function extractQuery() {
    const url = window.location.href;
    let isGoogle = url.includes('google.com/search');
    let isGoogleScholar = url.includes('scholar.google.com');

    if (isGoogle || isGoogleScholar) {
      const urlParams = new URLSearchParams(url.split('?')[1]);
      const searchQuery = urlParams.get('q');
      if (searchQuery) {
        const result = {
          searchQuery,
          url,
          isGoogle,
          isGoogleScholar,
          isUsed: false,
          dateAdded: new Date().toISOString(),
        };
        chrome.runtime.sendMessage(
          { action: 'latestNewQuery', data: result },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error sending message:', chrome.runtime.lastError);
            }
          },
        );
      }
    }
  }

  window.addEventListener('load', extractQuery);

  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      extractQuery();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

readGoogleSearchResults();


async function addElement() {
  const wrapper = document.createElement('qsp-mini-app');
  const imageUrl = chrome.runtime.getURL('images/quicksearchIcon.svg');
  const btnTop = await chrome.storage.local.get(['positionY', 'side', 'movedBefore'])

  const shadow = wrapper.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    .main-btn {
      display: flex;
      align-items: center;
      position: fixed;
      border: none;
      right: 0;
      z-index: 999999;
      padding: 8px 10px;
      background: #fff;
      border-radius: 9999px 0 0 9999px;
      cursor: pointer; 
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      transition: all 0.2s ease-in-out;
    }

    .main-btn.m-on-left {
      left: 0;
      right: auto;
      padding-left: 10px;
      padding-right: auto;
      border-radius: 0 9999px 9999px 0;
    }

    .main-rounded {
      display: flex;
      align-items: center;
      position: fixed;
      border: none;
      z-index: 999999;
      padding: 8px;
      background: #fff;
      border-radius: 50%;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      transition: all 0.2s ease-in-out;
    }

    .main-rounded img {
      width: 20px;
      height: 20px;
    }

    .main-btn:hover {
      padding-left: 14px;
      padding-right: 14px;
    }

    .main-btn:hover .close-btn {
      display: block;
    }

    .main-btn img {
      width: 20px;
      height: 20px;
    }

    .close-btn {
      position: absolute;
      bottom: -2px;
      left: -2px;
      background: red;
      color: white;
      border: none;
      border-radius: 50%;
      font-size: 10px;
      width: 16px;
      height: 16px;
      display: none;
      text-align: center;
      cursor: pointer;
      padding: 0; 
    }

    .close-btn.b-on-left {
      left: auto;
      right: -2px;
    }

    .confirm-box {
      padding: 12px;
      position: absolute;
      bottom: 100%;
      font-family: poppins;
      color: grey;
      right: 50%;
      width: auto;
      border: none;
      outline: none;
      white-space: nowrap;
      display: none;
      align-items: start;
      flex-direction: column;
      background: #fff;
      z-index: 999999999;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      gap: 12px;
    }
    
    .confirm-box.c-on-left {
      right: auto;
      left: 50%;
    }
  `;

  const mainButton = document.createElement('button');
  const closeBtn = document.createElement('button');
  const confirmBox = document.createElement('div');

  // Handle mainButton
  mainButton.className = btnTop && btnTop.side === 'left' ? 'main-btn m-on-left' : 'main-btn';
  mainButton.style.top = btnTop && btnTop.movedBefore ? `${btnTop.positionY}px` : 'auto'
  mainButton.style.bottom = btnTop && btnTop.movedBefore ? `auto` : '150px'

  mainButton.innerHTML = `<img src="${imageUrl}" alt="search icon" />`;
  mainButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'toggle_sidebar' });
  });

  // Handle closebtn
  closeBtn.className = btnTop && btnTop.side === 'left' ? 'close-btn b-on-left' : 'close-btn';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    confirmBox.style.display = 'flex'
    confirmBox.focus()
  });

  // Handle confirm box
  confirmBox.tabIndex = 0;
  confirmBox.onblur = () => confirmBox.style.display = 'none';
  confirmBox.className = btnTop && btnTop.side === 'left' ? 'confirm-box c-on-left' : 'confirm-box';
  confirmBox.innerHTML = `
    <span class='disable-site' >Disable on this site</span>
    <span class='disable-all' >Disable on all site</span>
  `;

  // Handle events
  const disableThisSite = confirmBox.querySelector('.disable-site');
  disableThisSite.addEventListener('click', (e) => {
    e.stopPropagation();

    confirmBox.style.display = 'none'
    wrapper.remove() // remove qsp-mini-app
  });

  const disableAllSites = confirmBox.querySelector('.disable-all');
  disableAllSites.addEventListener('click', (e) => {
    e.stopPropagation();

    chrome.storage.local.set({ buttonDisabledGlobally: true });
    confirmBox.style.display = 'none'
    wrapper.remove() // remove qsp-mini-app
  });

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;
  let positionX = 0;
  let positionY = 0;

  mainButton.addEventListener('mousedown', (e) => {
    e.preventDefault();

    isDragging = true;
    const rect = mainButton.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    positionX = e.clientX - offsetX;
    positionY = e.clientY - offsetY;

    mainButton.style.position = 'fixed';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    if (!btnTop.movedBefore) {
      chrome.storage.local.set({ movedBefore: true })
    }


    mainButton.className = 'main-rounded';
    positionX = e.clientX - offsetX;
    positionY = e.clientY - offsetY;

    mainButton.style.left = `${e.clientX - offsetX}px`;
    mainButton.style.top = `${e.clientY - offsetY}px`;
    mainButton.style.right = 'auto'; // Reset right to allow manual positioning
    mainButton.style.bottom = 'auto';
    mainButton.style.cursor = 'move';
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;

    isDragging = false;
    mainButton.style.cursor = 'pointer';
    mainButton.style.left = `auto`;
    const centerX = window.innerWidth / 2;

    if (positionX < centerX) {
      mainButton.className = 'main-btn m-on-left';
      closeBtn.className = 'close-btn b-on-left';
      confirmBox.className = 'confirm-box c-on-left';

      chrome.storage.local.set({ positionY, side: 'left' });
    } else {
      mainButton.style.right = '0';
      mainButton.className = 'main-btn';
      closeBtn.className = 'close-btn';
      confirmBox.className = 'confirm-box';

      chrome.storage.local.set({ positionY, side: 'right' });
    }

    window.onmouseup = null;
    window.onmousemove = null;
  });

  shadow.appendChild(style);
  mainButton.appendChild(closeBtn)
  mainButton.appendChild(confirmBox)
  shadow.appendChild(mainButton);
  document.documentElement.appendChild(wrapper);
}

// ReEnable it on the site on reload
chrome.storage.local.set({ disabledSites: [] });

// Run only if not disabled
chrome.storage.local.get(['displayType', 'buttonDisabledGlobally'], (res) => {
  const globallyDisabled = res.buttonDisabledGlobally;

  if (res.displayType === 'sidebar' && !globallyDisabled) {
    addElement();
  }
});

const MessageTypes = {
  MEETING_DETECTED: 'MEETING_DETECTED',
  OVERLAY_CLOSED: 'OVERLAY_CLOSED',
  SUMMARY_REQUESTED: 'SUMMARY_REQUESTED',
  CONSENT_CONFIRMED: 'CONSENT_CONFIRMED',
  CONSENT_CANCELLED: 'CONSENT_CANCELLED',
  SHOW_CONSENT_MODAL: 'SHOW_CONSENT_MODAL',
  CLOSE_CONSENT_MODAL: 'CLOSE_CONSENT_MODAL',
  CHECK_MEETING: 'CHECK_MEETING',
  TAB_UPDATED: 'TAB_UPDATED',
  SHOW_RECORDER_MODAL: 'SHOW_RECORDER_MODAL',
  CLOSE_RECORDER_MODAL: 'CLOSE_RECORDER_MODAL',
  PENDING_CONSENT_AUTH: 'PENDING_CONSENT_AUTH',
  START_RECORDING: 'START_RECORDING',
  PAUSE_RECORDING: 'PAUSE_RECORDING',
  RESUME_RECORDING: 'RESUME_RECORDING',
  SAVE_RECORDING: 'SAVE_RECORDING',
  WARNING_2_MINUTES: 'WARNING_2_MINUTES',
  WARNING_1_MINUTE: 'WARNING_1_MINUTE',
  SIDEBAR_STATE: 'SIDEBAR_STATE',
  RECORDING_ERROR: 'RECORDING_ERROR',
  RECORDING_STARTED: 'RECORDING_STARTED',
  ACTIVATE_MICROPHONE: 'ACTIVATE_MICROPHONE'
};

let closedOverlays = new Set();
let isOverlayActive = false;
let isRecording = false; // Track recording state
let lastInjectionTime = 0;
let lastMeetingDetectedTime = 0;
let lastInjectionErrorTime = 0;
let isSidebarOpen = false;
const INJECTION_COOLDOWN = 5000;
const INSTRUCTION_OVERLAY_TIMEOUT = 9000;
const WARNING_OVERLAY_TIMEOUT = 8000;

console.log('script.js: Injected into', window.location.href);

function isMeetingPlatform(url) {
  const patterns = [
    /meet\.google\.com\/.+/,
    /zoom\.us\/j\/.+/,
    /zoom\.us\/wc\/.+/,
    /app\.zoom\.us\/wc\/.+/,
    /teams\.microsoft\.com\/l\/meetup-join\/.+/,
    /teams\.microsoft\.com\/v2\/.+/,
    /teams\.live\.com\/v2\/.+/,
  ];
  return patterns.some((pattern) => pattern.test(url.toLowerCase()));
}

function isZoomPlatform(url) {
  return /zoom\.us\/(j|wc)\/.+/.test(url.toLowerCase()) || /app\.zoom\.us\/wc\/.+/.test(url.toLowerCase());
}

function isGoogleMeetPlatform(url) {
  return /meet\.google\.com\/.+/.test(url.toLowerCase());
}

function createInitialOverlay() {
  if (isOverlayActive || closedOverlays.has(window.location.href) || isRecording) {
    console.log('script.js: Skipping initial overlay creation, isOverlayActive:', isOverlayActive, 'closedOverlays:', closedOverlays.has(window.location.href), 'isRecording:', isRecording);
    return;
  }

  const now = Date.now();
  if (now - lastInjectionTime < INJECTION_COOLDOWN) {
    console.log('script.js: Injection cooldown active, skipping');
    return;
  }

  try {
    const overlay = document.createElement('div');
    const logoUrl = chrome.runtime.getURL('icons/mainLogo.png');
    overlay.id = 'meeting-recorder-overlay';
    overlay.innerHTML = `
      <div class="overlay-content">
        <img src="${logoUrl}" alt="Quicksearchplus Logo" class="meeting-overlay-logo" />
        <p>Would you like a meeting summary?</p>
        <div class="overlay-buttons">
          <button id="summary-yes">Meeting Summary</button>
          <button id="summary-no">No</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = chrome.runtime.getURL('overlay.css');
    document.head.appendChild(cssLink);

    document.getElementById('summary-yes').addEventListener('click', () => {
      console.log('script.js: Summary requested, sending messages');
      chrome.runtime.sendMessage({ type: MessageTypes.SUMMARY_REQUESTED, url: window.location.href });
      chrome.runtime.sendMessage({ type: MessageTypes.SHOW_CONSENT_MODAL, url: window.location.href });
      closeOverlay(overlay);
      createInstructionOverlay();
    });

    document.getElementById('summary-no').addEventListener('click', () => {
      console.log('script.js: Overlay closed');
      chrome.runtime.sendMessage({ type: MessageTypes.OVERLAY_CLOSED, url: window.location.href });
      closeOverlay(overlay);
    });

    isOverlayActive = true;
    lastInjectionTime = now;
    console.log('script.js: Initial overlay injected');
  } catch (error) {
    console.error('script.js: Failed to inject initial overlay:', error);
    lastInjectionErrorTime = now;
  }
}

function createInstructionOverlay() {
  try {
    const overlay = document.createElement('div');
    overlay.id = 'instruction-overlay';
    overlay.innerHTML = `
      <div class="overlay-content">
        <p>To Proceed with Meeting Summarization: Please open the Quicksearchplus Extension and confirm your consent by clicking <span style="color: blue">"I Agree"</span>.</p>
      </div>
    `;

    document.body.appendChild(overlay);

    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = chrome.runtime.getURL('overlay.css');
    document.head.appendChild(cssLink);

    setTimeout(() => {
      closeOverlay(overlay);
    }, INSTRUCTION_OVERLAY_TIMEOUT);

    isOverlayActive = true;
    console.log('script.js: Instruction overlay injected');
  } catch (error) {
    console.error('script.js: Failed to inject instruction overlay:', error);
    lastInjectionErrorTime = Date.now();
  }
}

function createWarningOverlay(message) {
  const now = Date.now();
  if (now - lastInjectionTime < INJECTION_COOLDOWN) {
    console.log('script.js: Warning overlay injection cooldown active, skipping');
    return;
  }

  try {
    // Remove any existing warning overlay to avoid overlap
    const existingOverlay = document.getElementById('warning-overlay');
    if (existingOverlay) {
      existingOverlay.parentNode.removeChild(existingOverlay);
      console.log('script.js: Removed existing warning overlay');
    }

    const overlay = document.createElement('div');
    const logoUrl = chrome.runtime.getURL('icons/mainLogo.png');
    overlay.id = 'warning-overlay';
    overlay.innerHTML = `
      <div class="overlay-content">
        <img src="${logoUrl}" alt="Company Logo" class="meeting-overlay-logo" />
        <p>${message}</p>
        <div class="overlay-buttons">
          <button id="reopen-sidebar">Open Extension</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = chrome.runtime.getURL('overlay.css');
    document.head.appendChild(cssLink);

    document.getElementById('reopen-sidebar').addEventListener('click', () => {
      console.log('script.js: Reopen sidebar clicked, sending SHOW_RECORDER_MODAL');
      chrome.runtime.sendMessage({ type: MessageTypes.SHOW_RECORDER_MODAL, url: window.location.href });
      closeOverlay(overlay);
    });

    setTimeout(() => {
      console.log('script.js: Closing warning overlay after 8 seconds');
      closeOverlay(overlay);
    }, WARNING_OVERLAY_TIMEOUT);

    isOverlayActive = true;
    lastInjectionTime = now;
    console.log('script.js: Warning overlay injected with message:', message);
  } catch (error) {
    console.error('script.js: Failed to inject warning overlay:', error);
    lastInjectionErrorTime = now;
  }
}

function closeOverlay(overlay) {
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
    console.log('script.js: Overlay closed');
  }
  isOverlayActive = false;
  // Only add to closedOverlays for initial or instruction overlays, not warnings
  if (overlay.id === 'meeting-recorder-overlay' || overlay.id === 'instruction-overlay') {
    closedOverlays.add(window.location.href);
  }
}

function checkForMeeting() {
  const now = Date.now();
  if (now - lastMeetingDetectedTime < 1000) {
    console.log('script.js: Meeting check throttled');
    return;
  }

  const url = window.location.href;
  if (isMeetingPlatform(url) && !isOverlayActive && !closedOverlays.has(url) && !isRecording) {
    console.log('script.js: Meeting detected, creating overlay');
    chrome.runtime.sendMessage({ type: MessageTypes.MEETING_DETECTED, url });
    createInitialOverlay();
    lastMeetingDetectedTime = now;
  }
}

checkForMeeting();

const observer = new MutationObserver(() => {
  checkForMeeting();
});
observer.observe(document.body, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log('script.js: Received message:', message, 'from sender:', sender);
  switch (message.type) {
    case MessageTypes.CHECK_MEETING:
      console.log('script.js: Handling CHECK_MEETING');
      const url = window.location.href;
      const isMeeting = isMeetingPlatform(url);
      try {
        sendResponse({ isMeeting });
        console.log('script.js: Sent CHECK_MEETING response:', { isMeeting });
      } catch (error) {
        console.error('script.js: Error sending CHECK_MEETING response:', error);
      }
      break;
    case MessageTypes.SIDEBAR_STATE:
      isSidebarOpen = message.isOpen;
      console.log('script.js: Sidebar state updated, isSidebarOpen:', isSidebarOpen);
      break;
    case MessageTypes.ACTIVATE_MICROPHONE:
      console.log('script.js: Activating microphone');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        console.log('Microphone access granted.');
        chrome.runtime.sendMessage({ type: 'MICROPHONE_ACTIVATED' });
      } catch (error) {
        console.error('Microphone permission error:', error);
        chrome.runtime.sendMessage({
          type: 'MICROPHONE_ERROR',
          error:
            error.name === 'NotAllowedError'
              ? 'Microphone access denied. Please allow microphone access to record your voice.'
              : `Error accessing microphone: ${error.message}`,
        });
      }
      break;
    case MessageTypes.RECORDING_STARTED:
      console.log('script.js: Recording started, closing initial overlay');
      isRecording = true;
      const initialOverlay = document.getElementById('meeting-recorder-overlay');
      if (initialOverlay) {
        closeOverlay(initialOverlay);
      }
      const instructionOverlay = document.getElementById('instruction-overlay');
      if (instructionOverlay) {
        closeOverlay(instructionOverlay);
      }
      break;
    case MessageTypes.WARNING_2_MINUTES:
      console.log('script.js: Received WARNING_2_MINUTES, isSidebarOpen:', isSidebarOpen);
      if (!isSidebarOpen) {
        createWarningOverlay(
          "Heads-up! Your meeting summary session ends in 2 minutes. Want to keep the recap going? Just click to start a new session and we’ll continue capturing everything for you—easy as that."
        );
      }
      break;
    case MessageTypes.WARNING_1_MINUTE:
      console.log('script.js: Received WARNING_1_MINUTE, isSidebarOpen:', isSidebarOpen);
      if (!isSidebarOpen) {
        createWarningOverlay(
          "Heads-up! Your meeting summary session ends in 1 minute. Want to keep the recap going? Just click to start a new session and we’ll continue capturing everything for you—easy as that."
        );
      }
      break;
    case MessageTypes.RECORDING_ERROR:
      console.log(`script.js: Received ${message.type}, closing any warning overlays`);
      isRecording = false;
      const warningOverlay = document.getElementById('warning-overlay');
      if (warningOverlay) {
        closeOverlay(warningOverlay);
      }
      closedOverlays.add(window.location.href);
      break;
    case MessageTypes.SAVE_RECORDING:
    case MessageTypes.recordingComplete:
      console.log(`script.js: Received ${message.type}, resetting recording state`);
      isRecording = false;
      closedOverlays.add(window.location.href);
      break;
  }
  return true; // Keep the message channel open for async responses
});