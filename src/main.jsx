/**
 * @file Entry point for the Chronotab React application.
 * This file initializes the React application, sets up routing using HashRouter,
 * and renders the main App component into the DOM.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'; // Import HashRouter
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter> {/* Wrap App with HashRouter */}
      <App />
    </HashRouter>
  </StrictMode>,
)
