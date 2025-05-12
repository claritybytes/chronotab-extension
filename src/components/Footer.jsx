import React from "react";

/**
 * React functional component for the application footer.
 * Displays copyright information and links to the developer's website and the product page.
 * Includes UTM parameters for tracking clicks from the extension.
 *
 * @returns {JSX.Element} The footer component.
 */
const Footer = () => (
  <footer className="w-full max-w-md mx-auto mt-4 text-center text-xs text-muted-foreground bg-transparent flex-shrink-0 pb-10">
    Developed with <span className="text-pink-500 dark:text-pink-400">&lt;3</span> by <a href="https://claritybytes.com?utm_source=chronotab-extension&utm_medium=footer-link&utm_campaign=chronotab-extension-footer" className="underline hover:text-primary dark:hover:text-primary" target="_blank" rel="noopener noreferrer">claritybytes.com</a><br />
    &copy; 2025 Clarity Bytes, LLC - <a href="https://chronotab.app?utm_source=chronotab-extension&utm_medium=footer-link&utm_campaign=chronotab-extension-footer" className="underline hover:text-primary dark:hover:text-primary" target="_blank" rel="noopener noreferrer">chronotab.app</a>
  </footer>
);

export default Footer;
