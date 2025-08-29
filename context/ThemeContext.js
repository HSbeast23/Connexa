import React, { createContext, useState, useContext } from 'react';

// Create the context
const ThemeContext = createContext();

// Theme provider component
export const ThemeProvider = ({ children }) => {
  // Define available themes
  const themes = {
    light: {
      mode: 'light',
      background: '#FFFFFF',
      text: '#121212',
      primary: '#4361EE',
      secondary: '#3A0CA3',
      accent: '#4CC9F0',
      error: '#FF3B30',
      success: '#34C759',
      card: '#F2F2F7',
      border: '#E5E5EA',
    },
    dark: {
      mode: 'dark',
      background: '#121212',
      text: '#FFFFFF',
      primary: '#4361EE',
      secondary: '#7209B7',
      accent: '#4CC9F0',
      error: '#FF453A',
      success: '#30D158',
      card: '#1C1C1E',
      border: '#38383A',
    },
  };

  // State to track the current theme
  const [theme, setTheme] = useState(themes.light);
  const [isDark, setIsDark] = useState(false);

  // Function to toggle between light and dark themes
  const toggleTheme = () => {
    setIsDark(!isDark);
    setTheme(isDark ? themes.light : themes.dark);
  };

  // Provide theme context to children components
  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook for using theme
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
