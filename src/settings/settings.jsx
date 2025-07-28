import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../settings/settings.css';

const Settings = () => {
  const [displayType, setDisplayType] = useState('sidebar');
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    chrome.storage.local.get(['displayType'], (result) => {
      if (result.displayType) {
        setDisplayType(result.displayType);
      }
    });
  }, []);

  const saveSettings = async () => {
    try {
      await chrome.storage.local.set({ displayType });
      setStatusMessage({ text: 'Settings saved successfully!', type: 'success' });
      setTimeout(() => window.close(), 1500);
    } catch (error) {
      setStatusMessage({ text: `Error saving settings: ${error.message}`, type: 'error' });
    }
  };

  return (
    <div className="settings-container">
      <h1>QuickSearchPlus Settings</h1>
      <div className="display-option">
        <input
          type="radio"
          id="sidebar"
          name="displayType"
          value="sidebar"
          checked={displayType === 'sidebar'}
          onChange={() => setDisplayType('sidebar')}
        />
        <label htmlFor="sidebar">Sidebar Extension (Default)</label>
      </div>
      <div className="display-option">
        <input
          type="radio"
          id="popup"
          name="displayType"
          value="popup"
          checked={displayType === 'popup'}
          onChange={() => setDisplayType('popup')}
        />
        <label htmlFor="popup">Popup Search Extension</label>
      </div>
      <button onClick={saveSettings}>Save Settings</button>
      {statusMessage.text && (
        <div className={`status-message ${statusMessage.type}`}>
          {statusMessage.text}
        </div>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Settings />);