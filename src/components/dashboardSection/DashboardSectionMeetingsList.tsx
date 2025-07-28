import React, { useState, useRef } from 'react';
import '../dashboardSection/DashboardSection.css';
import { AppDispatch, RootState } from '../../state';
import { useDispatch, useSelector } from 'react-redux';
import DashboardMeetingDeleteModal from './DashboardMeetingDeleteModal';
import { getDateAdded, sortMeetingsByDate } from '../../utils/siderUtility/siderUtility';
import { setMeetingDescription, setMeetingId, setShowMeetingDetailsModal } from '../../state/slice/reusableStatesSlice';
import { Meeting } from '../../state/types/meeting';

const DashboardSectionMeetingsList: React.FC = () => {
    const [openMeetingDeleteModal, setOpenMeetingDeleteModal] = useState(false);
    const [chosenIndex, setChosenIndex] = useState<number | null>(null);
    const isDarkMode = useSelector((state: RootState) => state.theme.isDarkMode)
    const meetings = useSelector((state: RootState) => state.meetings)
    const hideMeetingDeleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const dispatch = useDispatch<AppDispatch>()

    const sortedMeetings = sortMeetingsByDate(meetings.meetings);

    const handleShowMeetingDeleteModal = (number: number) => {
        if (hideMeetingDeleteTimeoutRef.current) clearTimeout(hideMeetingDeleteTimeoutRef.current);
        setChosenIndex(number)
        setOpenMeetingDeleteModal(true);
    };

    const handleHideMeetingDeleteModal = () => {
        hideMeetingDeleteTimeoutRef.current = setTimeout(
            () => {
                setChosenIndex(null)
                setOpenMeetingDeleteModal(false);
            },
            200,
        );
    }

    const handleMeetingDetailsClick = (id: number) => {
        dispatch(setShowMeetingDetailsModal(true))
        dispatch(setMeetingId(id))
    }
    return (
        <div className="dashboardSectionMeetingsList">
            {Array.isArray(sortedMeetings) && sortedMeetings.length > 0 ? (
                sortedMeetings.map((meeting) => (
                    <div
                        className={
                            isDarkMode
                                ? 'dashboardSectionMeetingsListContentsDark'
                                : 'dashboardSectionMeetingsListContents'
                        }
                        key={meeting.id}
                    >
                        <h3
                            className="dashboardSectionMeetingsListTitle"
                            onClick={() => handleMeetingDetailsClick(meeting.id)}
                        >
                            {`Meeting held on ${getDateAdded(meeting.title.split(' ').pop() || '')}`}
                        </h3>
                        <p
                            className="dashboardSectionMeetingsListDescription"
                            onClick={() => handleMeetingDetailsClick(meeting.id)}
                        >
                            {meeting?.summary?.summary.length > 100
                                ? meeting?.summary?.summary.slice(0, 100) + '...'
                                : meeting?.summary?.summary}
                        </p>
                        <div className="dashboardMeetingsOptions">
                            <img
                                src={isDarkMode ? 'images/ellipses.svg' : 'images/popup/ellipses.svg'}
                                alt="ellipse"
                                className="dashboardMeetingsEllipses"
                                onMouseEnter={() => handleShowMeetingDeleteModal(meeting.id)}
                                onMouseLeave={handleHideMeetingDeleteModal}
                            />
                            {openMeetingDeleteModal && chosenIndex === meeting.id && (
                                <DashboardMeetingDeleteModal
                                    onMouseEnter={() => handleShowMeetingDeleteModal(meeting.id)}
                                    onMouseLeave={handleHideMeetingDeleteModal}
                                    data={{
                                        id: meeting.id,
                                        name: `Meeting held on ${getDateAdded(
                                            meeting.title.split(' ').pop() || ''
                                        )}`,
                                    }}
                                />
                            )}
                        </div>
                    </div>
                ))
            ) : (
                <p>No meetings available</p>
            )}
        </div>
    );
};

export default DashboardSectionMeetingsList