import React, { useEffect, Suspense, lazy, useState } from 'react'
import '../../sidebar/sidebar.css'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '../../state'
import { initializeSection, setActiveSection } from '../../state/slice/sectionSlice'
import { initializeAuth, loadAuthData } from '../../state/slice/authSlice'
import { scheduleTokenRefreshCronJob } from '../../state/slice/tokenRefreshCron'
import { initializeCardList } from '../../state/slice/cardListSlice'
import { initializeBookmarkParentName, initializeBookmarks, initializeChildBookmarks } from '../../state/slice/bookmarkSlice'
import { initializeChildFolders, initializeCollectionAncestorFolders, initializeFolders } from '../../state/slice/folderSlice'
import RenameFolder from '../createFolder/RenameFolder'
import DeleteModal from '../deleteModal/DeleteModal'
import { fetchAllFavorites, initializeFavorites } from '../../state/slice/favoriteSlice'
import EditProfile from '../profileSection/EditProfile'
import { fetchAllImages, initializeImages } from '../../state/slice/imageSlice'
import { fetchAllVideos, initializeVideos } from '../../state/slice/videoSlice'
import { fetchAllArticles, initializeArticles } from '../../state/slice/articleSlice'
import { initializeChatModelDetail, initializeFilteredMedia, initializeFilteredMediaTitle, initializeIsFilteredMedia } from '../../state/slice/reusableStatesSlice'
import SiderContainer from '../../sidebar/SiderContainer'
import MediaDeleteModal from '../deleteModal/MediaDeleteModal'
import OnboardingModal from '../onboarding/Onboarding'
import OnboardingVideo from '../onboarding/OnboardingVideo'
import VerifyAccountModal from '../loginModal/VerifyAccountModal'
import { fetchStatus } from '../../state/slice/statusSlice'
import DeleteMeetingModal from '../deleteModal/DeleteMeetingModal'
import MeetingDetailsModal from '../deleteModal/MeetingDetailsModal'
import { setActiveLoginType } from '../../state/slice/loginModalSlice'
import ConsentModal from './ConsentModal'
import MeetingRecorderModal from './MeetingRecorderModal'
import { fetchAllMeetings, initializeMeetings } from '../../state/slice/meetingSlice'

const WelcomeScreen = lazy(() => import('../welcome/WelcomeScreen'))
const HomeScreen = lazy(() => import('../home/HomeScreen'))
const TabSection = lazy(() => import('../tabSection/TabSection'))
const AllTabsSection = lazy(() => import('../allTabsSection/AllTabsSection'))
const ProfileSection = lazy(() => import('../profileSection/ProfileSection'))
const ChatSection = lazy(() => import('../chatSection/ChatSection'))
const DashboardSection = lazy(() => import('../dashboardSection/DashboardSection'))
const OCRSection = lazy(() => import('../ocrSection/OCRSection'))
const TranslateSection = lazy(() => import('../translateSection/TranslateSection'))
const Backdrop = lazy(() => import('../backdrop/Backdrop'))
const PaymentModal = lazy(() => import('../paymentModal/PaymentModal'))
const CreateFolder = lazy(() => import('../createFolder/CreateFolder'))
const LoginModal = lazy(() => import('../loginModal/LoginModal'))

const Sidebar: React.FC = () => {
  const [showConsent, setShowConsent] = useState(false);
  const [showRecorderModal, setShowRecorderModal] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState('');
  const [pendingRecorderModal, setPendingRecorderModal] = useState(false);
  const dispatch = useDispatch<AppDispatch>()
  const activeSection = useSelector(
    (state: RootState) => state.sections.activeSection,
  )

  const { activationNeeded, showFolderModal, showRenameFolderModal, showEditProfileModal,
    showDeleteModal, showDeleteMeetingModal, showMediaDeleteModal, showOnboardingModal, isOnboardingVideo,
    showVerifyAccountModal, showMeetingDetailsModal
  } = useSelector(
    (state: RootState) => state.reusable,
  )
  const loginType = useSelector(
    (state: RootState) => state.loginType.activeLoginType,
  )
  const { user, token } = useSelector((state: RootState) => state.auth)
  const isDarkMode = useSelector((state: RootState) => state.theme.isDarkMode)

  useEffect(() => {
    chrome.runtime.connect({ name: 'sidepanel' });
    chrome.runtime.sendMessage({ type: 'SIDEBAR_READY' }, () => {
      console.log('Sidebar.tsx: Sent SIDEBAR_READY');
    });
    chrome.runtime.sendMessage({ type: 'SIDEBAR_OPENED' }, () => {
      console.log('Sidebar.tsx: Sent SIDEBAR_OPENED');
      // Check recording state when sidebar opens
      
      //leave
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  const tabId = tabs[0].id!;
  chrome.tabs.sendMessage(tabId, { type: "ACTIVATE_MICROPHONE" });
});
//leave
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url) {
          const currentUrl = tabs[0].url;
          chrome.storage.local.get(['isMeetingRecording', 'meetingUrl', 'totalPausedTime'], (result) => {
            if (chrome.runtime.lastError) {
              console.error('Sidebar.tsx: Error querying recording state:', chrome.runtime.lastError.message);
              return;
            }
            console.log('Sidebar.tsx: Received recording state:', result);
            if (result.isMeetingRecording && result.meetingUrl === currentUrl) {
              console.log('Sidebar.tsx: Ongoing recording detected, showing recorder modal for URL:', currentUrl);
              setShowRecorderModal(true);
              setMeetingUrl(currentUrl);
              setPendingRecorderModal(false);
              // Set sessionStartTime when sidebar opens for an ongoing recording
              chrome.storage.local.set({
                sessionStartTime: Math.floor(Date.now() / 1000),
                showRecorderModal: true
              }, () => {
                console.log('Sidebar.tsx: Updated sessionStartTime and showRecorderModal on SIDEBAR_OPENED');
              });
            } else {
              console.log('Sidebar.tsx: No ongoing recording or URL mismatch');
            }
          });
        }
      });
    });

    // Notify background.js when the sidebar is closed (unmount)
    return () => {
      console.log('Sidebar.tsx: Sidebar unmounting, sending SIDEBAR_CLOSED');
      chrome.runtime.sendMessage({ type: 'SIDEBAR_CLOSED' });
      // If recording is ongoing and recorder modal is open, accumulate elapsed time
      chrome.storage.local.get(['isMeetingRecording', 'meetingUrl', 'sessionStartTime', 'totalElapsedTime', 'totalPausedTime', 'showRecorderModal'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('Sidebar.tsx: Error retrieving storage on SIDEBAR_CLOSED:', chrome.runtime.lastError.message);
          return;
        }
        if (result.isMeetingRecording && result.showRecorderModal) {
          const currentTime = Math.floor(Date.now() / 1000);
          const sessionStartTime = result.sessionStartTime || 0;
          const sessionElapsedTime = (currentTime - sessionStartTime) - Math.floor((result.totalPausedTime || 0) / 1000);
          const newTotalElapsedTime = (result.totalElapsedTime || 0) + (sessionElapsedTime > 0 ? sessionElapsedTime : 0);
          chrome.storage.local.set({
            sessionStartTime: currentTime,
            totalElapsedTime: newTotalElapsedTime,
            showRecorderModal: false
          }, () => {
            console.log('Sidebar.tsx: Updated totalElapsedTime on SIDEBAR_CLOSED:', newTotalElapsedTime, 'sessionStartTime:', currentTime);
          });
        }
      });
    };
  }, []);

  useEffect(() => {
    const handleMessage = (msg: any) => {
      console.log('Sidebar.tsx: Received message:', msg);
      if (msg.type === 'SHOW_CONSENT_MODAL') {
        console.log('Sidebar.tsx: Showing consent modal for URL:', msg.url);
        setShowConsent(true);
        setMeetingUrl(msg.url || '');
      } else if (msg.type === 'SHOW_LOGIN_MODAL') {
        console.log('Sidebar.tsx: Dispatching setActiveLoginType(signInModal)');
        dispatch(setActiveLoginType('signInModal'));
      } else if (msg.type === 'CLOSE_CONSENT_MODAL') {
        console.log('Sidebar.tsx: Closing consent modal');
        setShowConsent(false);
        setMeetingUrl('');
        setPendingRecorderModal(false);
      } else if (msg.type === 'SHOW_RECORDER_MODAL') {
        console.log('Sidebar.tsx: Showing recorder modal for URL:', msg.url);
        setShowRecorderModal(true);
        setMeetingUrl(msg.url || '');
        setPendingRecorderModal(false);
        chrome.storage.local.set({ showRecorderModal: true }, () => {
          console.log('Sidebar.tsx: Updated showRecorderModal to true');
        });
      } else if (msg.type === 'CLOSE_RECORDER_MODAL') {
        console.log('Sidebar.tsx: Closing recorder modal');
        setShowRecorderModal(false);
        setMeetingUrl('');
        setPendingRecorderModal(false);
        // Calculate and accumulate elapsed time
        chrome.storage.local.get(['sessionStartTime', 'totalElapsedTime', 'isMeetingRecording', 'meetingUrl', 'totalPausedTime'], (result) => {
          if (chrome.runtime.lastError) {
            console.error('Sidebar.tsx: Error retrieving storage:', chrome.runtime.lastError.message);
            return;
          }
          if (result.isMeetingRecording && result.meetingUrl === msg.url) {
            const currentTime = Math.floor(Date.now() / 1000);
            const sessionStartTime = result.sessionStartTime || 0;
            const sessionElapsedTime = (currentTime - sessionStartTime) - Math.floor((result.totalPausedTime || 0) / 1000);
            const newTotalElapsedTime = (result.totalElapsedTime || 0) + (sessionElapsedTime > 0 ? sessionElapsedTime : 0);
            chrome.storage.local.set({
              sessionStartTime: currentTime,
              totalElapsedTime: newTotalElapsedTime,
              showRecorderModal: false
            }, () => {
              console.log('Sidebar.tsx: Updated totalElapsedTime:', newTotalElapsedTime, 'sessionStartTime:', currentTime);
            });
          }
        });
      } else if (msg.type === 'RECORDING_ERROR') {
        console.log('Sidebar.tsx: Received RECORDING_ERROR:', msg.error);
        setShowRecorderModal(false);
        setMeetingUrl('');
        setPendingRecorderModal(false);
        chrome.storage.local.set({ showRecorderModal: false });
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      console.log('Sidebar.tsx: Removing message listener');
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [dispatch]);

  const handleConsent = () => {
    console.log('Sidebar.tsx: Consent confirmed for:', meetingUrl);
    setShowConsent(false);
    if (token) {
      console.log('Sidebar.tsx: User authenticated, sending CONSENT_CONFIRMED');
      chrome.runtime.sendMessage({ type: 'CONSENT_CONFIRMED', url: meetingUrl });
    } else {
      console.log('Sidebar.tsx: User not authenticated, showing login modal');
      dispatch(setActiveLoginType('signInModal'));
      chrome.runtime.sendMessage({ type: 'PENDING_CONSENT_AUTH', url: meetingUrl });
      setPendingRecorderModal(true);
    }
  };

  const handleCancel = () => {
    console.log('Sidebar.tsx: Consent cancelled for:', meetingUrl);
    chrome.runtime.sendMessage({ type: 'CONSENT_CANCELLED', url: meetingUrl });
    setShowConsent(false);
    setMeetingUrl('');
    setPendingRecorderModal(false);
  };

  const handleRecorderModalClose = () => {
    console.log('Sidebar.tsx: Recorder modal closed, sending CLOSE_RECORDER_MODAL and SIDEBAR_CLOSED');
    chrome.runtime.sendMessage({ type: 'CLOSE_RECORDER_MODAL', url: meetingUrl, token });
    setShowRecorderModal(false);
    setMeetingUrl('');
    setPendingRecorderModal(false);
  };

  useEffect(() => {
    if (token && pendingRecorderModal && meetingUrl) {
      console.log('Sidebar.tsx: Token detected, checking for pending recorder modal');
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url && tabs[0].url.includes(meetingUrl)) {
          console.log('Sidebar.tsx: Active tab matches meeting URL, sending SHOW_RECORDER_MODAL');
          chrome.runtime.sendMessage({ type: 'SHOW_RECORDER_MODAL', url: meetingUrl });
        } else {
          console.log('Sidebar.tsx: Active tab does not match meeting URL, clearing pending');
          setPendingRecorderModal(false);
          setMeetingUrl('');
        }
      });
    }
  }, [token, pendingRecorderModal, meetingUrl]);


  useEffect(() => {
    const refreshTokenCronJob = async () => {
      const authData = await loadAuthData();
      if (authData.token) {
        scheduleTokenRefreshCronJob(dispatch);
      }
    };
    refreshTokenCronJob();
  }, [dispatch]);

  useEffect(() => {
    const initializeBaseData = async () => {
      await Promise.all([
        dispatch(initializeAuth()),
        dispatch(initializeSection()),
        dispatch(initializeCardList()),
        dispatch(initializeBookmarks()),
        dispatch(initializeImages()),
        dispatch(initializeFavorites()),
        dispatch(initializeVideos()),
        dispatch(initializeArticles()),
        dispatch(initializeBookmarkParentName()),
        dispatch(initializeChildBookmarks()),
        dispatch(initializeFolders()),
        dispatch(initializeChildFolders()),
        dispatch(initializeCollectionAncestorFolders()),
        dispatch(initializeFilteredMedia()),
        dispatch(initializeIsFilteredMedia()),
        dispatch(initializeFilteredMediaTitle()),
        dispatch(initializeChatModelDetail()),
        dispatch(fetchAllMeetings()),
        dispatch(initializeMeetings())
      ]);
    };

    const initializeMediaData = async () => {
      await Promise.all([
        dispatch(fetchAllFavorites()),
        dispatch(initializeFavorites()),
        dispatch(fetchAllImages()),
        dispatch(initializeImages()),
        dispatch(fetchAllVideos()),
        dispatch(initializeVideos()),
        dispatch(fetchAllArticles()),
        dispatch(initializeArticles())
      ]);
    };

    const initializeData = async () => {
      await initializeBaseData();
      if (token) {
        await initializeMediaData();
      }
    };

    initializeData();
  }, [dispatch]);


  useEffect(() => {
    const handleDefaultDashSection = () => {
      if (activeSection === "dashboardSection") {
        if (
          ![
            "dashboardCollectionSection",
            "dashboardFavoritesSection",
            "dashboardLinksSection",
            "dashboardImagesSection",
            "dashboardVideosSection",
            "dashboardArticlesSection",
            "dashboardMeetingsSection"
          ].includes(activeSection)
        ) {
          dispatch(setActiveSection("dashboardCollectionSection"));
        }
      }
    };
    handleDefaultDashSection();
  }, [activeSection, dispatch]);

  useEffect(() => {
    if (token) {
      chrome.runtime.sendMessage({
        type: 'AUTH_SUCCESS',
        token,
      });
      // console.log('Sidebar.tsx: Sent AUTH_SUCCESS with token:', token);
    }
  }, [token]);

  const renderSection = () => {
    switch (activeSection) {
      case 'homeSection':
        return <HomeScreen />
      case 'tabSection':
        return <TabSection />
      case 'allTabsSection':
        return <AllTabsSection />
      case 'profileSection':
        return <ProfileSection />
      case 'chatSection':
        return <ChatSection />
      case 'dashboardCollectionSection':
        return <DashboardSection />
      case 'dashboardFavoritesSection':
        return <DashboardSection />
      case 'dashboardLinksSection':
        return <DashboardSection />
      case 'dashboardImagesSection':
        return <DashboardSection />
      case 'dashboardVideosSection':
        return <DashboardSection />
      case 'dashboardArticlesSection':
        return <DashboardSection />
      case 'dashboardMeetingsSection':
        return <DashboardSection />
      case 'welcomeSection':
        return <WelcomeScreen />
      case 'translateSection':
        return <TranslateSection />
      case 'ocrSection':
        return <OCRSection />
      default:
        return <WelcomeScreen />
    }
  }

  return (
    <div className="sidebar">
      <SiderContainer>
        <Suspense
        // fallback={
        //   <div 
        //     className={`sidebar-loading ${isDarkMode ? 'dark' : 'light'}`}
        //   >
        //   </div>
        // }
        >
          {renderSection()}
        </Suspense>
      </SiderContainer>
      {(loginType === 'signInModal' || loginType === 'signUpModal') && (
        <Backdrop>
          <LoginModal />
        </Backdrop>
      )}
      {activationNeeded && (
        <Backdrop>
          <PaymentModal />
        </Backdrop>
      )}
      {showFolderModal && (
        <Backdrop>
          <CreateFolder />
        </Backdrop>
      )}
      {showRenameFolderModal && (
        <Backdrop>
          <RenameFolder />
        </Backdrop>
      )}
      {showDeleteModal && (
        <Backdrop>
          <DeleteModal />
        </Backdrop>
      )}
      {showDeleteMeetingModal && (
        <Backdrop>
          <DeleteMeetingModal />
        </Backdrop>
      )}
      {showMediaDeleteModal && (
        <Backdrop>
          <MediaDeleteModal />
        </Backdrop>
      )}
      {showEditProfileModal && (
        <Backdrop>
          <EditProfile user={user} token={token} />
        </Backdrop>
      )}
      {token && isOnboardingVideo && (
        <Backdrop>
          <OnboardingVideo />
        </Backdrop>
      )}
      {showVerifyAccountModal && (
        <Backdrop>
          <VerifyAccountModal />
        </Backdrop>
      )}
      {showMeetingDetailsModal && (
        <Backdrop>
          <MeetingDetailsModal />
        </Backdrop>
      )}
      {showConsent && (
        <Backdrop>
          <ConsentModal handleConsent={handleConsent} handleCancel={handleCancel} />
        </Backdrop>
      )}
      {showRecorderModal && (
        <Backdrop>
          <MeetingRecorderModal handleClose={handleRecorderModalClose} meetingUrl={meetingUrl}
            setMeetingUrl={setMeetingUrl}
            setPendingRecorderModal={setPendingRecorderModal}
            setShowRecorderModal={setShowRecorderModal} />
        </Backdrop>
      )}
    </div>
  )
}

export default Sidebar