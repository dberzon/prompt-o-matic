import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    this.setState({ info })
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', color: '#e0d9ce', background: '#0b0b0b', minHeight: '100vh' }}>
          <h2 style={{ color: '#c96060', marginBottom: 16 }}>Runtime Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#c96060', fontSize: 13, marginBottom: 16 }}>
            {this.state.error?.message}
          </pre>
          <h3 style={{ color: '#c9a85c', marginBottom: 8, fontSize: 12 }}>Component Stack:</h3>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#c9a85c', fontSize: 11, marginBottom: 16 }}>
            {this.state.info?.componentStack}
          </pre>
          <h3 style={{ color: '#80786e', marginBottom: 8, fontSize: 12 }}>JS Stack:</h3>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#80786e', fontSize: 11 }}>
            {this.state.error?.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
