import React, { useEffect, useState, useRef } from "react";
import '../deleteModal/DeleteModal.css';
import { AppDispatch, RootState } from "../../state";
import { useDispatch, useSelector } from "react-redux";
import { setShowMeetingDetailsModal } from "../../state/slice/reusableStatesSlice";
import { Meeting } from "../../state/types/meeting";
import { getDateAdded } from "../../utils/siderUtility/siderUtility";

const MeetingDetailsModal: React.FC = () => {
  const [meetingDetails, setMeetingDetails] = useState<Meeting | null>(null);
  const [modalWidth, setModalWidth] = useState(300);
  const sidePanelRef = useRef<HTMLElement | null>(null);
  const isDarkMode = useSelector((state: RootState) => state.theme.isDarkMode);
  const meetings = useSelector((state: RootState) => state.meetings);
  const { meetingId } = useSelector((state: RootState) => state.reusable);
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    const sidePanel = document.querySelector(".sidebar") as HTMLElement;
    if (sidePanel) {
      sidePanelRef.current = sidePanel;
       setModalWidth(sidePanel.getBoundingClientRect().width * 0.9); 

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setModalWidth(entry.contentRect.width * 0.9);
        }
      });

      observer.observe(sidePanel);
      return () => observer.unobserve(sidePanel);
    } else {
      console.warn("Sidebar element not found. Using fallback width.");
    }
  }, []);

  useEffect(() => {
    const getMeetingDetails = () => {
      if (meetings.meetings.length > 0) {
        const details = meetings.meetings.find((meeting) => meeting.id === meetingId);
        setMeetingDetails(details ?? null);
        console.log("meetings", meetings.meetings);
        console.log("meeting id", meetingId);
      } else {
        setMeetingDetails(null);
      }
    };

    if (meetingId) {
      getMeetingDetails();
    } else {
      setMeetingDetails(null);
    }
  }, [meetingId, meetings.meetings]);

  if (!meetingDetails) {
    return (
      <div
        className={isDarkMode ? "meetingDescriptionModalDark" : "meetingDescriptionModal"}
        style={{
          width: `${Math.min(Math.max(modalWidth, 300), 800)}px`,
        }}
      >
        <div className="meetingDescriptionModalContent">
          <img
            src="images/close.svg"
            alt="close"
            className="deleteModalClose"
            onClick={() => dispatch(setShowMeetingDetailsModal(false))}
          />
          <h3 className={isDarkMode ? "meetingDescriptionHeaderDark" : "meetingDescriptionHeader"}>
            No Meeting Details Available
          </h3>
        </div>
      </div>
    );
  }

  return (
    <div
      className={isDarkMode ? "meetingDescriptionModalDark" : "meetingDescriptionModal"}
      style={{
        width: `${Math.min(Math.max(modalWidth, 300), 800)}px`,
      }}
    >
      <div className="meetingDescriptionModalContent">
        <img
          src="images/close.svg"
          alt="close"
          className="deleteModalClose"
          onClick={() => dispatch(setShowMeetingDetailsModal(false))}
        />
        <h3 className={isDarkMode ? "meetingDescriptionHeaderDark" : "meetingDescriptionHeader"}>
          {`Meeting held on ${getDateAdded(meetingDetails.title.split(" ").pop() || "")}`}
        </h3>

        {meetingDetails.audioUrl && (
          <div className="meetingDetailSection">
            <h4>Audio Recording</h4>
            <audio controls src={meetingDetails.audioUrl} style={{ width: "100%" }}>
              Your browser does not support the audio element.
            </audio>
          </div>
        )}

        {/* {meetingDetails.transcript && (
          <div className="meetingDetailSection">
            <h4>Transcript</h4>
            <p className={isDarkMode ? "transcriptTextDark" : "transcriptText"}>
              {meetingDetails.transcript}
            </p>
          </div>
        )} */}

        {meetingDetails.summary && (
          <div className="meetingDetailSection">
            <h4>Summary</h4>
            <p>{meetingDetails.summary.summary}</p>

            {meetingDetails.summary.introduction && (
              <div className="subSection">
                <h5>Introduction</h5>
                <p>{meetingDetails.summary.introduction}</p>
              </div>
            )}

            <div className="subSection">
              <h5>Action Items</h5>
              {meetingDetails.summary.actionItems.length > 0 ? (
                <ul>
                  {meetingDetails.summary.actionItems.map((item, index) => (
                    <li key={index}>{item.title}</li>
                  ))}
                </ul>
              ) : (
                <p>No action items assigned.</p>
              )}
            </div>

            <div className="subSection">
              <h5>Decisions Made</h5>
              {meetingDetails.summary.decisionsMade.length > 0 ? (
                <ul>
                  {meetingDetails.summary.decisionsMade.map((decision, index) => (
                    <li key={index}>{decision.title}</li>
                  ))}
                </ul>
              ) : (
                <p>No decisions made.</p>
              )}
            </div>

            <div className="subSection">
              <h5>Topics Discussed</h5>
              {meetingDetails.summary.topicsDiscussed.length > 0 ? (
                <ul>
                  {meetingDetails.summary.topicsDiscussed.map((topic, index) => (
                    <li key={index}>
                      <strong>{topic.title}</strong>: {topic.content}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No topics discussed.</p>
              )}
            </div>
          </div>
        )}

        <div className="meetingDetailSection">
          <h4>Summary Status</h4>
          <p>{meetingDetails.uploadPending ? "Pending" : "Completed"}</p>
        </div>
      </div>
    </div>
  );
};

export default MeetingDetailsModal;