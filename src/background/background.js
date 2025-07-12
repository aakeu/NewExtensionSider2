let sideBarIsOpen = 0

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const storedData = await chrome.storage.local.get('displayType')

    if (!storedData.displayType) {
      await chrome.storage.local.set({
        displayType: 'sidebar',
      })
    }

    await chrome.storage.local.set({ updateAvailable: true })
    chrome.action.setBadgeText({ text: '' })
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  }
})

chrome.action.onClicked.addListener(async () => {
  try {
    const { displayType } = await chrome.storage.local.get('displayType')

    if (displayType === 'sidebar') {
      const isOpen = await chrome.sidePanel
        .getOptions()
        .then((options) => options.enabled)
      if (!isOpen) {
        await chrome.sidePanel.open({ windowId: null })
      } else {
        await chrome.sidePanel.setOptions({ enabled: false })
      }
    } else {
      chrome.windows.create({
        url: 'popup.html',
        type: 'popup',
        width: 700,
      })
    }
  } catch (error) {
    console.error('Error handling action click:', error)
  }
})

// Handle close from the browser page

chrome.runtime.onConnect.addListener((port) => {
  if(port.name === 'sidepanel'){
    sideBarIsOpen = 1

    port.onDisconnect.addListener(() => {
      sideBarIsOpen = 0
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.action === 'toggle_sidebar') {
    chrome.storage.local.get('displayType', (result) => {
      if(result.displayType === 'sidebar' && !sideBarIsOpen){
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'verifySettings') {
    chrome.storage.local.get('displayType', (result) => {
      sendResponse({ displayType: result.displayType })
    })
    return true 
  }
})

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
    }).catch(() => {});
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
    }).catch(() => {});
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
