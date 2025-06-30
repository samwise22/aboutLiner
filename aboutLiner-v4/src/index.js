import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import AppV2 from './AppV2';

// Set this to true to use the new section-based architecture (AppV2)
// Set to false to use the original App
const useV2 = true;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(useV2 ? <AppV2 /> : <App />);
