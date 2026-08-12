import { Component } from 'react';

export class DebugErrorBoundary extends Component<{ children?: React.ReactNode }, { error: Error | null; info: any }> {
  state = { error: null as Error | null, info: null as any };
  static getDerivedStateFromError(error: Error) {
    return { error, info: null };
  }
  componentDidCatch(error: Error, info: any) {
    this.setState({ error, info });
    console.error('[DebugErrorBoundary]', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, color: '#fff', background: '#7f1d1d' }}>
          <h2>Rendered crash</h2>
          <pre>{String(this.state.error.message)}</pre>
          <pre>{JSON.stringify(this.state.info?.componentStack || this.state.info, null, 2).slice(0, 4000)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
