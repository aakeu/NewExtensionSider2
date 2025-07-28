import React from 'react';
import './ConsentModal.css';

const ConsentModal: React.FC<{
  handleConsent: () => void;
  handleCancel: () => void;
}> = ({ handleConsent, handleCancel }) => {
  return (
    <div className="consent-overlay">
      <div className="overlay-content">
        <p>
          By choosing to summarize this meeting, you agree to inform all participants that
          their audio may be processed for transcription and summarization purposes.
        </p>
        <div className="overlay-buttons">
          <button onClick={handleConsent}>I Agree</button>
          <button onClick={handleCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default ConsentModal;