import React, { Suspense } from 'react';
import ReactDOM from 'react-dom';
import './styles.css';
import reportWebVitals from './reportWebVitals';
const App = React.lazy(() => import('./App'));

ReactDOM.render(
    <React.StrictMode>
        <Suspense fallback={<div>Loading...</div>}>
            <App />
        </Suspense>
    </React.StrictMode>,
    document.getElementById('root')
);

reportWebVitals();
