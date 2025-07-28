import React, { useEffect, useState } from 'react';
import './Footer.css';
import { AppDispatch, RootState } from '../../state';
import { useDispatch, useSelector } from 'react-redux';
import {
  initializeOpenNewTab,
  toggleOpenInNewTab,
} from '../../state/slice/openInNewTabSlice';
import ThemeToggle from '../theme/ThemeToggle';
import { setActiveSection } from '../../state/slice/sectionSlice';
import { setIsOnboardingVideo } from '../../state/slice/reusableStatesSlice';

const Footer: React.FC = () => {
  const [isMeetingTab, setIsMeetingTab] = useState(false);
  const openInNewTab = useSelector((state: RootState) => state.openInNewTab.openInNewTab);
  const isDarkMode = useSelector((state: RootState) => state.theme.isDarkMode);
  const { token } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();

  const handleOpenInTab = () => {
    dispatch(toggleOpenInNewTab(!openInNewTab));
  };

  const handleMeetingRecordClick = async () => {
    console.log('Footer.jsx: Meeting Recorder button clicked');
    chrome.runtime.sendMessage({ type: 'CHECK_MEETING_RECORD' });
  };

  function isMeetingPlatform(url: string) {
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

  useEffect(() => {
    // Check current tab on mount
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        console.log(`Footer.jsx: Checking current tab: ${tabs[0].url}`);
        setIsMeetingTab(isMeetingPlatform(tabs[0].url));
      }
    });

    // Listen for tab updates
    const handleMessage = (msg: any) => {
      if (msg.type === 'TAB_UPDATED') {
        console.log(`Footer.jsx: Received TAB_UPDATED, isMeeting: ${msg.isMeeting}`);
        setIsMeetingTab(msg.isMeeting);
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  useEffect(() => {
    dispatch(initializeOpenNewTab());
  }, [dispatch]);

  return (
    <div className={isDarkMode ? 'footerDark' : 'footer'}>
      <div className="footerOpenInTabHolder">
        <label
          style={{
            display: 'inline-block',
            position: 'relative',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            className="footerOpenTabCheck"
            checked={openInNewTab}
            onChange={handleOpenInTab}
          />
          <span className="custom-checkbox"></span>
        </label>
        {isMeetingTab && (
          <img
            src='images/recorder.svg'
            alt="Record audio"
            className="recorderImg"
            onClick={handleMeetingRecordClick}
          />
        )}
      </div>
      <ThemeToggle />
      {token && (
        <span
          onClick={() => {
            dispatch(setActiveSection('homeSection'));
            dispatch(setIsOnboardingVideo(true));
          }}
          className={isDarkMode ? "footerOnboardingDark" : "footerOnboarding"}
        >
          Start tour
        </span>
      )}
      <span className={isDarkMode ? 'footerCopyrightDark' : 'footerCopyright'}>
        © 2025 Quick Search+
      </span>
    </div>
  );
};

export default Footer;