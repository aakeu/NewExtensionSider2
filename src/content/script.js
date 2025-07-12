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

    if(!btnTop.movedBefore){
      chrome.storage.local.set({movedBefore: true})
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
    if(!isDragging) return;

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
