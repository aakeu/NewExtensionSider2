let sideBarIsOpen = 0

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['displayType'], (result) => {
    if (!result.displayType) {
      chrome.storage.local.set({ displayType: 'sidebar' });
    }
  });
});

chrome.action.onClicked.addListener((tab) => {
  console.log('Extension clicked', `Tab ID: ${tab.id}, Window ID: ${tab.windowId}`);

  chrome.storage.local.get(['displayType'], (result) => {
    const mode = result.displayType || 'sidebar';
    if (mode === 'sidebar') {
      chrome.sidePanel.open({ windowId: tab.windowId });
    } else {
      chrome.action.setPopup({ popup: 'popup.html' });
      chrome.windows.create({
        url: 'popup.html',
        type: 'popup',
        width: 700,
        height: 600,
      });
    }
  });
});

chrome.action.setPopup({ popup: '' });

// Handle close from the browser page
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    sideBarIsOpen = 1

    port.onDisconnect.addListener(() => {
      sideBarIsOpen = 0
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.action === 'toggle_sidebar') {
    chrome.storage.local.get('displayType', (result) => {
      if (result.displayType === 'sidebar' && !sideBarIsOpen) {
        chrome.sidePanel.open({ windowId: sender.tab.windowId })
        sideBarIsOpen = 1;
      } else if (result.displayType === 'sidebar') {
        chrome.sidePanel.setOptions({ enabled: false })
        sideBarIsOpen = 0;

        chrome.sidePanel.setOptions({
          enabled: true,
          path: 'sidebar.html'
        })
      }
    })
    return true
  }
})


// let sideBarIsOpen = 0

// chrome.runtime.onInstalled.addListener(async (details) => {
//   if (details.reason === 'install') {
//     const storedData = await chrome.storage.local.get('displayType')

//     if (!storedData.displayType) {
//       await chrome.storage.local.set({
//         displayType: 'sidebar',
//       })
//     }

//     await chrome.storage.local.set({ updateAvailable: true })
//     chrome.action.setBadgeText({ text: '' })
//     chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
//   }
// })

// chrome.action.onClicked.addListener(async () => {
//   try {
//     const { displayType } = await chrome.storage.local.get('displayType')

//     if (displayType === 'sidebar') {
//       const isOpen = await chrome.sidePanel
//         .getOptions()
//         .then((options) => options.enabled)
//       if (!isOpen) {
//         await chrome.sidePanel.open({ windowId: null })
//       } else {
//         await chrome.sidePanel.setOptions({ enabled: false })
//       }
//     } else {
//       chrome.windows.create({
//         url: 'popup.html',
//         type: 'popup',
//         width: 700,
//       })
//     }
//   } catch (error) {
//     console.error('Error handling action click:', error)
//   }
// })

// // Handle close from the browser page

// chrome.runtime.onConnect.addListener((port) => {
//   if(port.name === 'sidepanel'){
//     sideBarIsOpen = 1

//     port.onDisconnect.addListener(() => {
//       sideBarIsOpen = 0
//     });
//   }
// });

// chrome.runtime.onMessage.addListener((request, sender) => {
//   if (request.action === 'toggle_sidebar') {
//     chrome.storage.local.get('displayType', (result) => {
//       if(result.displayType === 'sidebar' && !sideBarIsOpen){
//         chrome.sidePanel.open({ windowId: sender.tab.windowId })
//         sideBarIsOpen = 1;
//       } else if (result.displayType === 'sidebar') {
//         chrome.sidePanel.setOptions({ enabled: false })
//         sideBarIsOpen = 0;

//         chrome.sidePanel.setOptions({
//           enabled: true,
//           path: 'sidebar.html'
//         })
//       }
//     })

//     return true 
//   }
// })

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === 'verifySettings') {
//     chrome.storage.local.get('displayType', (result) => {
//       sendResponse({ displayType: result.displayType })
//     })
//     return true 
//   }
// })

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === 'latestNewQuery') {
    const { searchQuery, isGoogle, isGoogleScholar, url, isUsed, dateAdded } =
      message.data;

    const queryItem = {
      searchQuery,
      isGoogle,
      isGoogleScholar,
      isUsed,
      dateAdded,
      url,
    };

    const storageKey = isGoogle
      ? 'extractedGoogleQueryDetails'
      : 'extractedScholarQueryDetails';
    chrome.storage.local.set({ [storageKey]: queryItem }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error storing query:', chrome.runtime.lastError);
      } else {
        chrome.runtime.sendMessage({
          action: 'newQueryAvailable',
          data: queryItem,
        });
      }
    });

    sendResponse({ success: true });
  }
});

const trackedTabs = new Map();
const trackedCurrentTab = { tab: null };
let lastUpdate = Date.now();
const MIN_UPDATE_INTERVAL = 180000;

function isValidUrl(url) {
  return !!url &&
    url.trim() !== '' &&
    !url.startsWith('chrome://extensions/') &&
    !url.startsWith('chrome://newtab/')
}

function updateTabList() {
  chrome.tabs.query({}, (tabs) => {
    const newTabs = new Map();

    tabs.forEach((tab) => {
      if (tab.url && isValidUrl(tab.url)) {
        if (!newTabs.has(tab.url)) {
          newTabs.set(tab.url, {
            url: tab.url,
            title: tab.title || 'Untitled',
            favicon: tab.favIconUrl || 'icons/icon48.png',
            foundInStore: false
          });
        }
      }
    });

    trackedTabs.clear();
    newTabs.forEach((value, key) => trackedTabs.set(key, value));

    chrome.runtime.sendMessage({
      type: 'TABS_UPDATE',
      tabs: Array.from(trackedTabs.values())
    }).catch(() => { });
  });
}

function updateCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab && activeTab.url && isValidUrl(activeTab.url)) {
      trackedCurrentTab.tab = {
        url: activeTab.url,
        title: activeTab.title || 'Untitled',
        favicon: activeTab.favIconUrl || 'icons/icon48.png',
        foundInStore: false
      };
    } else {
      trackedCurrentTab.tab = {
        url: null,
        title: "There are no carriers or apps available...",
        favicon: "images/tabScreenshot.svg"
      };
    }

    chrome.runtime.sendMessage({
      type: 'CURRENT_TAB_UPDATE',
      tab: trackedCurrentTab.tab
    }).catch(() => { });
  });
}

function conditionalUpdate() {
  const now = Date.now();
  if (now - lastUpdate >= MIN_UPDATE_INTERVAL) {
    updateTabList();
    updateCurrentTab();
    lastUpdate = now;
  }
}

chrome.tabs.onCreated.addListener((tab) => {
  updateTabList()
  if (tab.active) updateCurrentTab();
  lastUpdate = Date.now();
})
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.title || changeInfo.favIconUrl) {
    updateTabList();
    if (tab.active) updateCurrentTab();
    lastUpdate = Date.now();
  }
});
chrome.tabs.onRemoved.addListener(() => {
  updateTabList()
  updateCurrentTab();
  lastUpdate = Date.now();
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  updateCurrentTab();
  lastUpdate = Date.now();
});

updateTabList();
updateCurrentTab();
// setInterval(conditionalUpdate, 30000);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_TABS') {
    sendResponse({
      tabs: Array.from(trackedTabs.values())
    });
  } else if (message.type === 'GET_THE_CURRENT_TAB') {
    sendResponse({
      tab: trackedCurrentTab.tab
    });
  }
  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'USER_LOGGED_IN' || message.type === 'USER_LOGGED_OUT') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})

let isAuthFlowInProgress = false

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'loginWithGoogle') {
    // console.log("loginWithGoogle")
    if (isAuthFlowInProgress) {
      sendResponse({
        success: false,
        error: 'Authentication flow is already in progress.',
      })
      return true
    }
    isAuthFlowInProgress = true

    fetch(
      `https://quicksearchserver-8ee1999baeab.herokuapp.com/api/auth/google/extension/start`,
      {
        method: 'GET',
      },
    )
      .then((response) => response.json())
      .then((data) => {
        const authUrl = data.authUrl
        // console.log('Auth URL:', authUrl)
        chrome.identity.launchWebAuthFlow(
          {
            url: authUrl,
            interactive: true,
          },
          function (redirectUrl) {
            isAuthFlowInProgress = false
            if (chrome.runtime.lastError) {
              // console.error(
              //   'Error during launchWebAuthFlow:',
              //   chrome.runtime.lastError,
              // )
              sendResponse({
                success: false,
                error: chrome.runtime.lastError.message,
              })
              return
            }

            const urlParams = new URLSearchParams(new URL(redirectUrl).search)
            const code = urlParams.get('code')

            fetch(
              `https://quicksearchserver-8ee1999baeab.herokuapp.com/api/auth/google/extension/redirect?code=${code}`,
              {
                method: 'GET',
              },
            )
              .then((response) => response.json())
              .then(async (data) => {
                if (data.token && data.refreshToken) {
                  chrome.runtime.sendMessage({
                    action: 'loginCompleted',
                    token: data.token,
                    refreshToken: data.refreshToken,
                    user: data.user,
                    tokenExpires: data.tokenExpires,
                    isNewUser: data.isNewUser || false,
                  })
                } else if (
                  data.message === 'Google Authentication Failed' &&
                  data.error === 'Http Exception'
                ) {
                  chrome.runtime.sendMessage({
                    action: 'needLoginViaEmailAndPassword',
                    provider: 'email',
                  })
                } else {
                  chrome.runtime.sendMessage({
                    action: 'loginFailed',
                    error: 'Failed to get tokens from server',
                  })
                }
              })
              .catch((error) => {
                console.error('Error fetching redirect URL:', error)
                sendResponse({ success: false, error: error.message })
              })
          },
        )
      })
      .catch((error) => {
        console.error('Error fetching OAuth start URL:', error)
        sendResponse({ success: false, error: error.message })
      })
  }
  return true
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FOLDERS_FETCHED') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BOOKMARK_DETAILS_FETCHED') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BACK_TO_HOME_SECTION') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BACK_TO_CURRENT_TAB_SECTION') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BACK_TO_ALL_TABS_SECTION') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BACK_TO_GPT_SECTION') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BACK_TO_DASHBOARD_SECTION') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BACK_TO_PROFILE_SECTION') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STORED_DATA') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'USER_STATUS_FETCHED') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GPT_STORED') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BACK_TO_DASHBOARD_SECTION_COLLECTIONS') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BACK_TO_DASHBOARD_SECTION_FAVORITES') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BACK_TO_DASHBOARD_SECTION_LINKS') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BACK_TO_DASHBOARD_SECTION_IMAGES') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BACK_TO_DASHBOARD_SECTION_VIDEOS') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BACK_TO_DASHBOARD_SECTION_ARTICLES') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BACK_TO_DASHBOARD_SECTION_SETTINGS') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BACK_TO_DASHBOARD_SECTION_HELPCENTER') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BACK_TO_DASHBOARD_SECTION_CARD_DISPLAY') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BACK_TO_DASHBOARD_SECTION_LIST_DISPLAY') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DASHBOARD_COLLECTION_FOLDERS') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DASHBOARD_COLLECTION_ANCESTOR_FOLDERS') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DASHBOARD_COLLECTION_FOLDERS_BOOKMARKS') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DASHBOARD_IMAGE_DETAIL') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DASHBOARD_ARTICLE_DETAIL') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DASHBOARD_VIDEO_DETAIL') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ONBOARDING') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_IN_NEW_TAB') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SELECTED_BOOKMARK_PARENT_NAME') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHAT_GPT_USED') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_STORED_GPT') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BACK_TO_MAIN_GPT_SECTION') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BACK_TO__GPT_TRANSLATE_SECTION') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BACK_TO__GPT_OCR_SECTION') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GPT_ACTIVE_DETAILS') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_GPT_DATA') {
    chrome.runtime.sendMessage(message)
  }
  sendResponse({ success: true })
})
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadImage') {
    downloadImage(request.url)
  }
  sendResponse({ success: true })
})

function downloadImage(url, filename) {
  chrome.downloads.download(
    {
      url: url,
      filename: filename,
      saveAs: true,
    },
    function (downloadId) {
      console.log(`Download initiated with ID: ${downloadId}`)
    },
  )
}

let pendingConsent = { show: false, url: '' };
let pendingRecorderModal = { show: false, url: '' };
let pendingAuthConsent = { show: false, url: '' };
let recordingState = { isRecording: false, isPaused: false, url: '', token: '' };
let recordingTimeout = null;
let warning2MinutesTimeout = null;
let warning1MinuteTimeout = null;
let recordedBlobs = [];
let offscreenDocumentReady = false;
let isOnline = true;
let pauseStartTime = null;
let totalPausedTime = 0;
let isSidebarOpen = false;
let activeTabId = null;

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

async function setupOffscreenDocument() {
  try {
    const OFFSCREEN_DOCUMENT_PATH = 'recorder.html';
    const contexts = await chrome.runtime.getContexts({});
    const offscreenDocumentExists = contexts.some(
      (c) => c.contextType === 'OFFSCREEN_DOCUMENT' && c.documentUrl.endsWith(OFFSCREEN_DOCUMENT_PATH)
    );

    if (!offscreenDocumentExists) {
      console.log("Background: Creating offscreen document...");
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: ['USER_MEDIA'],
        justification: 'Recording audio from tab and microphone'
      });
      console.log("Background: Offscreen document created.");
    } else {
      console.log("Background: Offscreen document already exists.");
    }
  } catch (error) {
    console.error('background.js: Error setting up offscreen document:', error);
    chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: `Failed to create offscreen document: ${error.message}` });
    throw error;
  }
}

async function sendWarningToContentScript(type) {
  if (activeTabId && recordingState.isRecording) {
    try {
      await chrome.tabs.sendMessage(activeTabId, { type });
      console.log(`background.js: Sent ${type} to content script on tab ${activeTabId}`);
    } catch (error) {
      console.error(`background.js: Failed to send ${type} to content script:`, error);
      chrome.tabs.query({ url: recordingState.url }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
          activeTabId = tabs[0].id;
          console.log(`background.js: Updated activeTabId to ${activeTabId} for URL ${recordingState.url}`);
          chrome.tabs.sendMessage(activeTabId, { type }, () => {
            if (chrome.runtime.lastError) {
              console.error(`background.js: Failed to send ${type} to updated tab ${activeTabId}:`, chrome.runtime.lastError.message);
            } else {
              console.log(`background.js: Successfully sent ${type} to updated tab ${activeTabId}`);
            }
          });
        } else {
          console.error(`background.js: No valid tab found for URL ${recordingState.url}`);
        }
      });
    }
  } else {
    console.log(`background.js: Cannot send ${type}, activeTabId: ${activeTabId}, isRecording: ${recordingState.isRecording}`);
  }
}

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log('background.js: Received message:', message, 'from sender:', sender);
  switch (message.type) {
    case 'RECORDER_LOG':
      console.log(`background.js: Forwarded from recorder.js: ${message.message}`);
      break;
    case 'MEETING_DETECTED':
      console.log(`background.js: Meeting detected at: ${message.url}`);
      break;
    case 'SUMMARY_REQUESTED':
      console.log(`background.js: Meeting summary requested for: ${message.url}`);
      pendingConsent = { show: true, url: message.url };
      chrome.runtime.sendMessage({ type: 'SHOW_CONSENT_MODAL', url: message.url });
      break;
    case 'OVERLAY_CLOSED':
      console.log(`background.js: Overlay closed for: ${message.url}`);
      pendingConsent = { show: false, url: '' };
      pendingRecorderModal = { show: false, url: '' };
      pendingAuthConsent = { show: false, url: '' };
      if (!recordingState.isRecording) {
        recordingState = { isRecording: false, isPaused: false, url: '', token: '' };
        recordedBlobs = [];
        if (recordingTimeout) clearTimeout(recordingTimeout);
        if (warning2MinutesTimeout) clearTimeout(warning2MinutesTimeout);
        if (warning1MinuteTimeout) clearTimeout(warning1MinuteTimeout);
        recordingTimeout = null;
        warning2MinutesTimeout = null;
        warning1MinuteTimeout = null;
      }
      chrome.runtime.sendMessage({ type: 'CLOSE_CONSENT_MODAL' });
      chrome.runtime.sendMessage({ type: 'CLOSE_RECORDER_MODAL' });
      isSidebarOpen = false;
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { type: 'SIDEBAR_STATE', isOpen: false });
        console.log('background.js: Sent SIDEBAR_STATE (closed) to content script');
      }
      break;
    case 'CONSENT_CONFIRMED':
      console.log(`background.js: Consent confirmed for meeting at: ${message.url}`);
      pendingConsent = { show: false, url: '' };
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url && tabs[0].url.includes(message.url)) {
          console.log(`background.js: Active tab is meeting URL, sending SHOW_RECORDER_MODAL for: ${message.url}`);
          pendingRecorderModal = { show: true, url: message.url };
          chrome.runtime.sendMessage({ type: 'SHOW_RECORDER_MODAL', url: message.url });
        } else {
          console.log(`background.js: Active tab is not meeting URL, clearing pending states`);
          pendingConsent = { show: false, url: '' };
          pendingRecorderModal = { show: false, url: '' };
          pendingAuthConsent = { show: false, url: '' };
        }
      });
      break;
    case 'CONSENT_CANCELLED':
      console.log(`background.js: Consent cancelled for meeting at: ${message.url}`);
      pendingConsent = { show: false, url: '' };
      pendingRecorderModal = { show: false, url: '' };
      pendingAuthConsent = { show: false, url: '' };
      recordingState = { isRecording: false, isPaused: false, url: '', token: '' };
      recordedBlobs = [];
      if (recordingTimeout) clearTimeout(recordingTimeout);
      if (warning2MinutesTimeout) clearTimeout(warning2MinutesTimeout);
      if (warning1MinuteTimeout) clearTimeout(warning1MinuteTimeout);
      recordingTimeout = null;
      warning2MinutesTimeout = null;
      warning1MinuteTimeout = null;
      chrome.runtime.sendMessage({ type: 'CLOSE_CONSENT_MODAL' });
      chrome.runtime.sendMessage({ type: 'CLOSE_RECORDER_MODAL' });
      isSidebarOpen = false;
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { type: 'SIDEBAR_STATE', isOpen: false });
        console.log('background.js: Sent SIDEBAR_STATE (closed) to content script');
      }
      break;
    case 'SHOW_CONSENT_MODAL':
      console.log(`background.js: Received SHOW_CONSENT_MODAL for: ${message.url}`);
      pendingConsent = { show: true, url: message.url };
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url && tabs[0].url.includes(message.url)) {
          console.log(`background.js: Active tab is meeting URL, forwarding SHOW_CONSENT_MODAL`);
          chrome.runtime.sendMessage({ type: 'SHOW_CONSENT_MODAL', url: message.url });
        } else {
          console.log(`background.js: Active tab is not meeting URL, clearing pendingConsent`);
          pendingConsent = { show: false, url: '' };
        }
      });
      break;
    case 'CHECK_MEETING_RECORD':
      console.log(`background.js: Received CHECK_MEETING_RECORD`);
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url && isMeetingPlatform(tabs[0].url)) {
          console.log(`background.js: Active tab is meeting URL, sending SHOW_CONSENT_MODAL for: ${tabs[0].url}`);
          pendingConsent = { show: true, url: tabs[0].url };
          chrome.runtime.sendMessage({ type: 'SHOW_CONSENT_MODAL', url: tabs[0].url });
        } else {
          console.log(`background.js: Active tab is not a meeting URL`);
        }
      });
      break;
    case 'PENDING_CONSENT_AUTH':
      console.log(`background.js: Received PENDING_CONSENT_AUTH for: ${message.url}`);
      pendingAuthConsent = { show: true, url: message.url };
      break;
    case 'SIDEBAR_OPENED':
      console.log(`background.js: Received SIDEBAR_OPENED`);
      isSidebarOpen = true;
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { type: 'SIDEBAR_STATE', isOpen: true });
        console.log('background.js: Sent SIDEBAR_STATE (opened) to content script');
      }
      break;
    case 'SIDEBAR_CLOSED':
      console.log(`background.js: Received SIDEBAR_CLOSED`);
      isSidebarOpen = false;
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { type: 'SIDEBAR_STATE', isOpen: false });
        console.log('background.js: Sent SIDEBAR_STATE (closed) to content script');
      }
      break;
    case 'ACTIVATE_MICROPHONE':
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'ACTIVATE_MICROPHONE' });
        }
      });
      break;
    case 'START_RECORDING': {
      const { tabId, url, token } = message;
      console.log("Background: START_RECORDING triggered for tab:", tabId);
      activeTabId = tabId;
      try {
        recordingState = { isRecording: true, isPaused: false, url, token };
        totalPausedTime = 0; // Reset paused time
        // Get current time in seconds since Unix epoch
        const startTime = Math.floor(Date.now() / 1000);
        console.log("Background: Calling getMediaStreamId...");
        chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, async (streamId) => {
          if (chrome.runtime.lastError || !streamId) {
            const errorMessage =
              chrome.runtime.lastError?.message || 'Unknown error getting media stream ID';
            console.error('Background: Failed to get media stream ID:', errorMessage);
            chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: errorMessage });
            if (activeTabId) {
              chrome.tabs.sendMessage(activeTabId, { type: 'RECORDING_ERROR', error: errorMessage });
            }
            recordingState = { isRecording: false, isPaused: false, url: '', token: '' };
            return;
          }

          console.log("Background: Received streamId:", streamId);
          chrome.tabs.sendMessage(activeTabId, { type: 'RECORDING_STARTED' });
          console.log('background.js: Sent RECORDING_STARTED to content script');

          await setupOffscreenDocument();

          console.log("Background: Sending startRecording message to offscreen document...");
          chrome.runtime.sendMessage({
            target: 'offscreen',
            type: 'startRecording',
            data: {
              streamId,
              duration: 180000,
              token,
              totalPausedTime,
            },
          });

          // Save recording state, start time, and initialize total elapsed time
          chrome.storage.local.set({
            isMeetingRecording: true,
            meetingUrl: url,
            sessionStartTime: startTime,
            totalElapsedTime: 0,
            totalPausedTime: 0,
            showRecorderModal: true // Initialize modal state
          });

          if (recordingTimeout) clearTimeout(recordingTimeout);
          recordingTimeout = setTimeout(() => {
            chrome.runtime.sendMessage({
              target: 'offscreen',
              type: 'stopRecording',
            });
            console.log("Background: Sent stop signal to offscreen after 3 minutes + paused time.");
            recordingTimeout = null;
          }, 180000 + totalPausedTime);

          if (warning2MinutesTimeout) clearTimeout(warning2MinutesTimeout);
          warning2MinutesTimeout = setTimeout(() => {
            console.log("Background: Sending WARNING_2_MINUTES after 1 minute + paused time");
            chrome.runtime.sendMessage({ type: 'WARNING_2_MINUTES' });
            if (!isSidebarOpen && activeTabId) {
              sendWarningToContentScript('WARNING_2_MINUTES');
            }
            warning2MinutesTimeout = null;
          }, 60000 + totalPausedTime);

          if (warning1MinuteTimeout) clearTimeout(warning1MinuteTimeout);
          warning1MinuteTimeout = setTimeout(() => {
            console.log("Background: Sending WARNING_1_MINUTE after 2 minutes + paused time");
            chrome.runtime.sendMessage({ type: 'WARNING_1_MINUTE' });
            if (!isSidebarOpen && activeTabId) {
              sendWarningToContentScript('WARNING_1_MINUTE');
            }
            warning1MinuteTimeout = null;
          }, 120000 + totalPausedTime);
        });
      } catch (error) {
        console.error('Background: Error in startRecording flow:', error);
        chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: error.message });
        if (activeTabId) {
          chrome.tabs.sendMessage(activeTabId, { type: 'RECORDING_ERROR', error: error.message });
        }
        recordingState = { isRecording: false, isPaused: false, url: '', token: '' };
        chrome.storage.local.set({
          isMeetingRecording: false,
          meetingUrl: "",
          sessionStartTime: 0,
          totalElapsedTime: 0,
          totalPausedTime: 0 // Reset paused time
        });
        if (recordingTimeout) {
          clearTimeout(recordingTimeout);
          recordingTimeout = null;
        }
        if (warning2MinutesTimeout) {
          clearTimeout(warning2MinutesTimeout);
          warning2MinutesTimeout = null;
        }
        if (warning1MinuteTimeout) {
          clearTimeout(warning1MinuteTimeout);
          warning1MinuteTimeout = null;
        }
      }
      break;
    }
    case 'PAUSE_RECORDING':
      console.log(`background.js: Received PAUSE_RECORDING for: ${message.url}`);
      if (recordingState.isRecording && !recordingState.isPaused) {
        recordingState.isPaused = true;
        pauseStartTime = Date.now();
        console.log("Background: Pause started at:", pauseStartTime);
        chrome.runtime.sendMessage({
          target: 'offscreen',
          type: 'pauseRecording',
        });
        console.log("Background: Sent pauseRecording to offscreen document.");
        if (warning2MinutesTimeout) {
          clearTimeout(warning2MinutesTimeout);
          warning2MinutesTimeout = null;
          console.log("Background: Cleared warning2MinutesTimeout on pause.");
        }
        if (warning1MinuteTimeout) {
          clearTimeout(warning1MinuteTimeout);
          warning1MinuteTimeout = null;
          console.log("Background: Cleared warning1MinuteTimeout on pause.");
        }
      }
      break;
    case 'RESUME_RECORDING':
      console.log(`background.js: Received RESUME_RECORDING for: ${message.url}`);
      if (recordingState.isRecording && recordingState.isPaused) {
        recordingState.isPaused = false;
        if (pauseStartTime) {
          const pausedDuration = Date.now() - pauseStartTime;
          totalPausedTime += pausedDuration;
          console.log("Background: Resumed. Paused for:", pausedDuration, "ms. Total paused time:", totalPausedTime, "ms");
          chrome.storage.local.set({ totalPausedTime }, () => {
            console.log('Background: Updated totalPausedTime in storage:', totalPausedTime);
          });
          if (recordingTimeout) clearTimeout(recordingTimeout);
          recordingTimeout = setTimeout(() => {
            chrome.runtime.sendMessage({
              target: 'offscreen',
              type: 'stopRecording',
            });
            console.log("Background: Sent stop signal to offscreen after 3 minutes + paused time.");
            recordingTimeout = null;
          }, 180000 + totalPausedTime);

          if (warning2MinutesTimeout) clearTimeout(warning2MinutesTimeout);
          warning2MinutesTimeout = setTimeout(() => {
            console.log("Background: Sending WARNING_2_MINUTES after 1 minute + paused time");
            chrome.runtime.sendMessage({ type: 'WARNING_2_MINUTES' });
            if (!isSidebarOpen && activeTabId) {
              sendWarningToContentScript('WARNING_2_MINUTES');
            }
            warning2MinutesTimeout = null;
          }, 60000 + totalPausedTime);

          if (warning1MinuteTimeout) clearTimeout(warning1MinuteTimeout);
          warning1MinuteTimeout = setTimeout(() => {
            console.log("Background: Sending WARNING_1_MINUTE after 2 minutes + paused time");
            chrome.runtime.sendMessage({ type: 'WARNING_1_MINUTE' });
            if (!isSidebarOpen && activeTabId) {
              sendWarningToContentScript('WARNING_1_MINUTE');
            }
            warning1MinuteTimeout = null;
          }, 120000 + totalPausedTime);

          chrome.runtime.sendMessage({
            target: 'offscreen',
            type: 'updateRecordingTimeout',
            data: {
              duration: 180000,
              totalPausedTime,
            },
          });
          console.log("Background: Sent updateRecordingTimeout to offscreen with totalPausedTime:", totalPausedTime);
        }
        chrome.runtime.sendMessage({
          target: 'offscreen',
          type: 'resumeRecording',
        });
        console.log("Background: Sent resumeRecording to offscreen document.");
      }
      break;
    case 'SAVE_RECORDING':
      console.log(`background.js: Received SAVE_RECORDING for: ${message.url}`);
      if (recordingState.isRecording) {
        recordingState = { isRecording: false, isPaused: false, url: '', token: '' };
        chrome.storage.local.set({
          isMeetingRecording: false,
          meetingUrl: "",
          sessionStartTime: 0,
          totalElapsedTime: 0,
          totalPausedTime: 0 // Reset paused time
        });
        chrome.runtime.sendMessage({
          target: 'offscreen',
          type: 'stopRecording',
        });
        console.log("Background: Sent stopRecording to offscreen document for save.");
        if (recordingTimeout) clearTimeout(recordingTimeout);
        if (warning2MinutesTimeout) clearTimeout(warning2MinutesTimeout);
        if (warning1MinuteTimeout) clearTimeout(warning1MinuteTimeout);
        recordingTimeout = null;
        warning2MinutesTimeout = null;
        warning1MinuteTimeout = null;
        if (activeTabId) {
          chrome.tabs.sendMessage(activeTabId, { type: 'SAVE_RECORDING' });
        }
      }
      break;
    case 'downloadRecording':
      const { base64, mimeType, filename, authToken } = message;
      console.log("Background: Received downloadRecording request from offscreen document.");
      console.log("Background: Base64 string length:", base64.length);

      if (typeof base64 !== 'string' || base64.length === 0) {
        const errorMessage = "Background: Received invalid or empty base64 string.";
        console.error(errorMessage, base64);
        chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: errorMessage });
        if (activeTabId) {
          chrome.tabs.sendMessage(activeTabId, { type: 'RECORDING_ERROR', error: errorMessage });
        }
        return;
      }

      try {
        const arrayBuffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;
        console.log("Background: Converted base64 to ArrayBuffer. Size:", arrayBuffer.byteLength);

        const blob = new Blob([arrayBuffer], { type: mimeType });
        console.log("Background: Reconstructed Blob from ArrayBuffer. Size:", blob.size, "Type:", blob.type);

        if (blob.size === 0) {
          const errorMessage = "Background: Reconstructed Blob is empty. No audio data to download.";
          console.error(errorMessage);
          chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: errorMessage });
          if (activeTabId) {
            chrome.tabs.sendMessage(activeTabId, { type: 'RECORDING_ERROR', error: errorMessage });
          }
          return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
          if (reader.result) {
            const dataUrl = reader.result;
            console.log("Background: Converted Blob to Data URL (first 50 chars):", dataUrl.substring(0, 50) + "...");

            if (!dataUrl.startsWith('data:audio/webm')) {
              const errorMessage = "Background: Invalid data URL format for audio/webm.";
              console.error(errorMessage);
              chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: errorMessage });
              if (activeTabId) {
                chrome.tabs.sendMessage(activeTabId, { type: 'RECORDING_ERROR', error: errorMessage });
              }
              return;
            }

            try {
              const downloadId = await chrome.downloads.download({
                url: dataUrl,
                filename: filename,
                saveAs: false
              });
              console.log("Background: File download initiated. Download ID:", downloadId);
              chrome.runtime.sendMessage({ type: 'recordingComplete' });
              if (activeTabId) {
                chrome.tabs.sendMessage(activeTabId, { type: 'recordingComplete' });
              }
            } catch (downloadError) {
              const errorMessage = `Background: Download failed: ${downloadError.message}`;
              console.error(errorMessage);
              chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: errorMessage });
              if (activeTabId) {
                chrome.tabs.sendMessage(activeTabId, { type: 'RECORDING_ERROR', error: errorMessage });
              }
              return;
            }
          } else {
            const errorMessage = "Background: FileReader result is null or empty.";
            console.error(errorMessage);
            chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: errorMessage });
            if (activeTabId) {
              chrome.tabs.sendMessage(activeTabId, { type: 'RECORDING_ERROR', error: errorMessage });
            }
            return;
          }
        };
        reader.onerror = (e) => {
          const errorMessage = `Background: FileReader error: ${e.target.error.name}`;
          console.error(errorMessage);
          chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: errorMessage });
          if (activeTabId) {
            chrome.tabs.sendMessage(activeTabId, { type: 'RECORDING_ERROR', error: errorMessage });
          }
        };
        reader.readAsDataURL(blob);

        console.log("Background: Preparing to send audio to API...");
        const formData = new FormData();
        formData.append('file', blob, filename);
        formData.append('title', `Meeting Recording ${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}`);

        const jwtToken = authToken;

        try {
          const response = await fetch('http://localhost:3000/api/meetings/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${jwtToken}`
            },
            body: formData
          });

          if (!response.ok) {
            const errorMessage = `Background: API request failed with status ${response.status}: ${response.statusText}`;
            console.error(errorMessage);
            chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: errorMessage });
            if (activeTabId) {
              chrome.tabs.sendMessage(activeTabId, { type: 'RECORDING_ERROR', error: errorMessage });
            }
            return;
          }

          const result = await response.json();
          console.log("Background: API response:", result);

          chrome.runtime.sendMessage({ type: 'uploadComplete' });
          chrome.storage.local.set({
            isMeetingRecording: false,
            meetingUrl: "",
            sessionStartTime: 0,
            totalElapsedTime: 0
          });

        } catch (apiError) {
          const errorMessage = `Background: API request error: ${apiError.message}`;
          console.error(errorMessage);
          chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: errorMessage });
          if (activeTabId) {
            chrome.tabs.sendMessage(activeTabId, { type: 'RECORDING_ERROR', error: errorMessage });
          }
        }

      } catch (error) {
        const errorMessage = `Background: Error during download or API setup: ${error.message}`;
        console.error(errorMessage);
        chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: errorMessage });
        if (activeTabId) {
          chrome.tabs.sendMessage(activeTabId, { type: 'RECORDING_ERROR', error: errorMessage });
        }
      }
      break;
    case 'recordingComplete':
      if (recordingTimeout) {
        clearTimeout(recordingTimeout);
        recordingTimeout = null;
      }
      if (warning2MinutesTimeout) {
        clearTimeout(warning2MinutesTimeout);
        warning2MinutesTimeout = null;
      }
      if (warning1MinuteTimeout) {
        clearTimeout(warning1MinuteTimeout);
        warning1MinuteTimeout = null;
      }
      chrome.storage.local.set({
        isMeetingRecording: false,
        meetingUrl: "",
        sessionStartTime: 0,
        totalElapsedTime: 0,
        totalPausedTime: 0 // Reset paused time
      });
      chrome.runtime.sendMessage({ type: 'recordingComplete' });
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { type: 'recordingComplete' });
      }
      break;
    case 'RECORDING_ERROR':
      console.log(`background.js: Received RECORDING_ERROR: ${message.error}`);
      recordingState = { isRecording: false, isPaused: false, url: '', token: '' };
      chrome.storage.local.set({
        isMeetingRecording: false,
        meetingUrl: "",
        sessionStartTime: 0,
        totalElapsedTime: 0,
        totalPausedTime: 0 // Reset paused time
      });
      recordedBlobs = [];
      if (recordingTimeout) clearTimeout(recordingTimeout);
      if (warning2MinutesTimeout) clearTimeout(warning2MinutesTimeout);
      if (warning1MinuteTimeout) clearTimeout(warning1MinuteTimeout);
      recordingTimeout = null;
      warning2MinutesTimeout = null;
      warning1MinuteTimeout = null;
      chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: message.error });
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { type: 'RECORDING_ERROR', error: message.error });
      }
      break;
    case 'SIDEBAR_READY':
      console.log(`background.js: Received SIDEBAR_READY`);
      isSidebarOpen = true;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url) {
          activeTabId = tabs[0].id;
          const isMeeting = isMeetingPlatform(tabs[0].url);
          console.log(`background.js: Sending TAB_UPDATED for: ${tabs[0].url}, isMeeting: ${isMeeting}`);
          chrome.runtime.sendMessage({ type: 'TAB_UPDATED', url: tabs[0].url, isMeeting });
          if (activeTabId) {
            chrome.tabs.sendMessage(activeTabId, { type: 'SIDEBAR_STATE', isOpen: true });
            console.log('background.js: Sent SIDEBAR_STATE (opened) to content script');
          }
          if (pendingConsent.show && tabs[0].url.includes(pendingConsent.url)) {
            console.log(`background.js: Active tab is meeting URL, sending SHOW_CONSENT_MODAL for: ${pendingConsent.url}`);
            chrome.runtime.sendMessage({ type: 'SHOW_CONSENT_MODAL', url: pendingConsent.url });
          } else if (pendingConsent.show) {
            console.log(`background.js: Active tab is not meeting URL, clearing pendingConsent`);
            pendingConsent = { show: false, url: '' };
          }
          if (pendingRecorderModal.show && tabs[0].url.includes(pendingRecorderModal.url)) {
            console.log(`background.js: Active tab is meeting URL, sending SHOW_RECORDER_MODAL for: ${pendingRecorderModal.url}`);
            chrome.runtime.sendMessage({ type: 'SHOW_RECORDER_MODAL', url: pendingRecorderModal.url });
          } else if (pendingRecorderModal.show) {
            console.log(`background.js: Active tab is not meeting URL, clearing pendingRecorderModal`);
            pendingRecorderModal = { show: false, url: '' };
          }
        }
      });
      break;
    case 'AUTH_SUCCESS':
      console.log(`background.js: Received AUTH_SUCCESS`);
      if (pendingAuthConsent.show) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0] && tabs[0].url && tabs[0].url.includes(pendingAuthConsent.url)) {
            console.log(`background.js: Active tab is meeting URL, sending SHOW_RECORDER_MODAL for: ${pendingAuthConsent.url}`);
            pendingRecorderModal = { show: true, url: pendingAuthConsent.url };
            pendingAuthConsent = { show: false, url: '' };
            chrome.runtime.sendMessage({ type: 'SHOW_RECORDER_MODAL', url: pendingRecorderModal.url });
          } else {
            console.log(`background.js: Active tab is not meeting URL, clearing pendingAuthConsent`);
            pendingAuthConsent = { show: false, url: '' };
          }
        });
      }
      break;
  }
  return true;
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log(`background.js: Tab activated: ${activeInfo.tabId}`);
  activeTabId = activeInfo.tabId;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url) {
      const isMeeting = isMeetingPlatform(tabs[0].url);
      console.log(`background.js: Sending TAB_UPDATED for: ${tabs[0].url}, isMeeting: ${isMeeting}`);
      chrome.runtime.sendMessage({ type: 'TAB_UPDATED', url: tabs[0].url, isMeeting });
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { type: 'SIDEBAR_STATE', isOpen: isSidebarOpen });
        console.log('background.js: Sent SIDEBAR_STATE to content script on tab activation');
      }
    }
    if (pendingConsent.show && (!tabs[0] || !tabs[0].url || !tabs[0].url.includes(pendingConsent.url))) {
      console.log(`background.js: Active tab changed, no longer meeting URL, sending CLOSE_CONSENT_MODAL`);
      pendingConsent = { show: false, url: '' };
      chrome.runtime.sendMessage({ type: 'CLOSE_CONSENT_MODAL' });
    }
    if (pendingRecorderModal.show && (!tabs[0] || !tabs[0].url || !tabs[0].url.includes(pendingRecorderModal.url))) {
      console.log(`background.js: Active tab changed, no longer meeting URL, sending CLOSE_RECORDER_MODAL`);
      if (recordingState.isRecording && recordedBlobs.length > 0) {
        const blob = new Blob(recordedBlobs, { type: 'audio/webm;codecs=opus' });
        if (blob.size > 1024) {
          console.log('background.js: Recording >1KB on tab change, stopping and uploading');
          chrome.runtime.sendMessage({ target: 'offscreen', type: 'stopRecording' });
        }
      }
      recordingState = { isRecording: false, isPaused: false, url: '', token: '' };
      pendingRecorderModal = { show: false, url: '' };
      if (recordingTimeout) clearTimeout(recordingTimeout);
      if (warning2MinutesTimeout) clearTimeout(warning2MinutesTimeout);
      if (warning1MinuteTimeout) clearTimeout(warning1MinuteTimeout);
      recordingTimeout = null;
      warning2MinutesTimeout = null;
      warning1MinuteTimeout = null;
      chrome.runtime.sendMessage({ type: 'CLOSE_RECORDER_MODAL' });
      isSidebarOpen = false;
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { type: 'SIDEBAR_STATE', isOpen: false });
        console.log('background.js: Sent SIDEBAR_STATE (closed) to content script');
      }
    }
    if (pendingAuthConsent.show && (!tabs[0] || !tabs[0].url || !tabs[0].url.includes(pendingAuthConsent.url))) {
      console.log(`background.js: Active tab changed, no longer meeting URL, clearing pendingAuthConsent`);
      pendingAuthConsent = { show: false, url: '' };
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && changeInfo.url) {
    const isMeeting = isMeetingPlatform(tab.url);
    console.log(`background.js: Sending TAB_UPDATED for: ${tab.url}, isMeeting: ${isMeeting}`);
    chrome.runtime.sendMessage({ type: 'TAB_UPDATED', url: tab.url, isMeeting });
  }
  if (pendingConsent.show && changeInfo.url && tab.url && !tab.url.includes(pendingConsent.url)) {
    console.log(`background.js: Meeting tab URL changed, sending CLOSE_CONSENT_MODAL`);
    pendingConsent = { show: false, url: '' };
    chrome.runtime.sendMessage({ type: 'CLOSE_CONSENT_MODAL' });
  }
  if (pendingRecorderModal.show && changeInfo.url && tab.url && !tab.url.includes(pendingRecorderModal.url)) {
    console.log(`background.js: Meeting tab URL changed, sending CLOSE_RECORDER_MODAL`);
    if (recordingState.isRecording && recordedBlobs.length > 0) {
      const blob = new Blob(recordedBlobs, { type: 'audio/webm;codecs=opus' });
      if (blob.size > 1024) {
        console.log('background.js: Recording >1KB on tab URL change, stopping and uploading');
        chrome.runtime.sendMessage({ target: 'offscreen', type: 'stopRecording' });
      }
    }
    recordingState = { isRecording: false, isPaused: false, url: '', token: '' };
    pendingRecorderModal = { show: false, url: '' };
    if (recordingTimeout) clearTimeout(recordingTimeout);
    if (warning2MinutesTimeout) clearTimeout(warning2MinutesTimeout);
    if (warning1MinuteTimeout) clearTimeout(warning1MinuteTimeout);
    recordingTimeout = null;
    warning2MinutesTimeout = null;
    warning1MinuteTimeout = null;
    chrome.runtime.sendMessage({ type: 'CLOSE_RECORDER_MODAL' });
    isSidebarOpen = false;
    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, { type: 'SIDEBAR_STATE', isOpen: false });
      console.log('background.js: Sent SIDEBAR_STATE (closed) to content script');
    }
  }
  if (pendingAuthConsent.show && changeInfo.url && tab.url && !tab.url.includes(pendingAuthConsent.url)) {
    console.log(`background.js: Meeting tab URL changed, clearing pendingAuthConsent`);
    pendingAuthConsent = { show: false, url: '' };
  }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (pendingConsent.show) {
    chrome.tabs.query({}, (tabs) => {
      const meetingTab = tabs.find((tab) => tab.url && tab.url.includes(pendingConsent.url));
      if (!meetingTab) {
        console.log(`background.js: Meeting tab closed, sending CLOSE_CONSENT_MODAL`);
        pendingConsent = { show: false, url: '' };
        chrome.runtime.sendMessage({ type: 'CLOSE_CONSENT_MODAL' });
      }
    });
  }
  if (pendingRecorderModal.show) {
    chrome.tabs.query({}, (tabs) => {
      const meetingTab = tabs.find((tab) => tab.url && tab.url.includes(pendingRecorderModal.url));
      if (!meetingTab) {
        console.log(`background.js: Meeting tab closed, sending CLOSE_RECORDER_MODAL`);
        if (recordingState.isRecording && recordedBlobs.length > 0) {
          const blob = new Blob(recordedBlobs, { type: 'audio/webm;codecs=opus' });
          if (blob.size > 1024) {
            console.log('background.js: Recording >1KB on tab close, stopping and uploading');
            chrome.runtime.sendMessage({ target: 'offscreen', type: 'stopRecording' });
          }
        }
        recordingState = { isRecording: false, isPaused: false, url: '', token: '' };
        pendingRecorderModal = { show: false, url: '' };
        if (recordingTimeout) clearTimeout(recordingTimeout);
        if (warning2MinutesTimeout) clearTimeout(warning2MinutesTimeout);
        if (warning1MinuteTimeout) clearTimeout(warning1MinuteTimeout);
        recordingTimeout = null;
        warning2MinutesTimeout = null;
        warning1MinuteTimeout = null;
        chrome.runtime.sendMessage({ type: 'CLOSE_RECORDER_MODAL' });
        isSidebarOpen = false;
        if (activeTabId) {
          chrome.tabs.sendMessage(activeTabId, { type: 'SIDEBAR_STATE', isOpen: false });
          console.log('background.js: Sent SIDEBAR_STATE (closed) to content script');
        }
      }
    });
  }
  if (pendingAuthConsent.show) {
    chrome.tabs.query({}, (tabs) => {
      const meetingTab = tabs.find((tab) => tab.url && tab.url.includes(pendingAuthConsent.url));
      if (!meetingTab) {
        console.log(`background.js: Meeting tab closed, clearing pendingAuthConsent`);
        pendingAuthConsent = { show: false, url: '' };
      }
    });
  }
});


setInterval(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].id && tabs[0].url && isMeetingPlatform(tabs[0].url)) {
      activeTabId = tabs[0].id;
      chrome.tabs.sendMessage(tabs[0].id, { type: 'CHECK_MEETING' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(`background.js: Failed to send CHECK_MEETING: ${chrome.runtime.lastError.message}`);
          return;
        }
        console.log(`background.js: CHECK_MEETING response:`, response);
      });
    } else {
      console.log('background.js: No valid meeting tab for CHECK_MEETING');
    }
  });
}, 30000);