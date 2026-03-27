import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error: error.message }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: "monospace", background: "#fff" }}>
          <h2 style={{ color: "#E8317A" }}>App Error</h2>
          <pre style={{ background: "#f5f5f5", padding: 20, borderRadius: 8, whiteSpace: "pre-wrap", fontSize: 13 }}>{this.state.error}</pre>
          <p style={{ color: "#666" }}>Check browser console for full stack trace.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ErrorBoundary><App /></ErrorBoundary>);
