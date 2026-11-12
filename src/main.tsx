import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/landing.css';
import './styles/app-shell.css';
import './styles/overview.css';
import './styles/explorer.css';
import './styles/comparison.css';
import './styles/model-lab.css';
import './styles/mission-deck.css';
import './styles/global-assistant.css';
import './styles/quantum.css';
import 'katex/dist/katex.min.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
