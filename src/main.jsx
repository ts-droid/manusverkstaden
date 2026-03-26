import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';
import './styles/global.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        style: { padding: 40, fontFamily: 'system-ui', maxWidth: 600, margin: '60px auto' }
      },
        React.createElement('h2', { style: { color: '#c0392b' } }, 'Något gick fel'),
        React.createElement('p', { style: { color: '#666' } }, String(this.state.error?.message || this.state.error)),
        React.createElement('button', {
          onClick: () => { this.setState({ hasError: false, error: null }); window.location.reload(); },
          style: { marginTop: 16, padding: '8px 20px', borderRadius: 6, border: '1px solid #ccc', cursor: 'pointer' }
        }, 'Ladda om sidan')
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
