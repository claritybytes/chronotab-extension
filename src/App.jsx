import React, { useState, useEffect } from 'react'; // Keep useEffect
import { Routes, Route } from 'react-router-dom'; // Import Routes and Route
import './App.css';
import Dashboard from "./pages/Dashboard";
import ScheduleEditor from "./pages/ScheduleEditor";
import MissedAlarmsPage from './pages/MissedAlarmsPage';
import Footer from './components/Footer'; // Add this line

/**
 * Determines if the current window context is a Chrome extension popup.
 * This is based on typical popup dimensions. Popups are generally constrained
 * in size, while a full tab view will have larger dimensions.
 *
 * @returns {boolean} True if the window dimensions suggest it's a popup, false otherwise.
 */
function getPopupMode() {
  // Chrome extension popups have window.outerWidth <= 400 and window.opener is null
  // Fullscreen/tab has much larger width
  return window.innerWidth <= 480 && window.innerHeight <= 800;
}

/**
 * Main application component for Chronotab.
 * It sets up routing for different pages of the extension (Dashboard, ScheduleEditor, MissedAlarmsPage)
 * and determines if the UI should be rendered in popup mode or full-page mode based on window size.
 * It also includes a global Footer component.
 * @returns {JSX.Element} The root JSX element of the application.
 */
function App() {
  // const [route, setRoute] = useState(window.location.hash || "#/"); // Remove manual route state
  const [isPopup, setIsPopup] = useState(getPopupMode());

  // Listen for hash changes // Remove onhashchange listener
  // window.onhashchange = () => setRoute(window.location.hash || "#/");
  // Listen for resize to detect popup/fullscreen
  useEffect(() => { // Changed React.useEffect to useEffect
    const onResize = () => setIsPopup(getPopupMode());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* Remove manual page selection logic
  let page;
  if (route.startsWith("#/edit") || route.startsWith("#/schedule/new")) page = <ScheduleEditor isPopup={isPopup} />;
  else if (route.startsWith("#/missed-alarms")) page = <MissedAlarmsPage isPopup={isPopup} />;
  else page = <Dashboard isPopup={isPopup} />;
  */

  return (
    <div
      className={
        isPopup
          ? "w-[360px] min-h-[480px] max-w-full max-h-full flex flex-col bg-background text-foreground"
          : "w-full h-full min-h-screen min-w-0 flex flex-col bg-background text-foreground"
      }
      style={isPopup ? { minWidth: 320 } : {}}
    >
      {/* Replace manual page rendering with Routes */}
      <div className="flex-grow flex flex-col"> {/* Add a wrapper for content to grow */}
        <Routes>
          <Route path="/edit/*" element={<ScheduleEditor isPopup={isPopup} />} />
          <Route path="/schedule/new/*" element={<ScheduleEditor isPopup={isPopup} />} />
          <Route path="/missed-alarms" element={<MissedAlarmsPage isPopup={isPopup} />} />
          <Route path="/" element={<Dashboard isPopup={isPopup} />} />
        </Routes>
      </div>
      <Footer /> {/* Add this line */}
    </div>
  );
}

export default App
