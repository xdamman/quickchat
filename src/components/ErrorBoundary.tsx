import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-error" style={{ flexDirection: 'column', gap: 12, padding: 24, textAlign: 'center' }}>
          <p>Something went wrong</p>
          <p style={{ fontSize: 13, color: '#6b7280' }}>{this.state.error?.message}</p>
          <button
            className="btn-primary"
            style={{ width: 'auto', marginTop: 8 }}
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
