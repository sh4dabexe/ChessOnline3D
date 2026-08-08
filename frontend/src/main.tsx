import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'rgba(14,14,24,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#E8E4DC',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            backdropFilter: 'blur(16px)',
          },
          success: { iconTheme: { primary: '#4ADE80', secondary: '#0A0A10' } },
          error: { iconTheme: { primary: '#F87171', secondary: '#0A0A10' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
