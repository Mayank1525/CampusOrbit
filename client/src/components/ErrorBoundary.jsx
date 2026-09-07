import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[CampusOrbit] Render error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="glass max-w-lg w-full p-7 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/12 border border-rose-500/25 flex items-center justify-center mb-4">
              <AlertTriangle size={24} className="text-rose-400" />
            </div>
            <h2 className="text-lg font-bold text-white font-display mb-2">Something broke on this screen</h2>
            <p className="text-sm text-slate-400 mb-1">
              The rest of CampusOrbit is fine — this panel hit an unexpected error.
            </p>
            <pre className="text-[11px] text-rose-300/80 bg-rose-500/5 border border-rose-500/15 rounded-lg p-3 my-4 text-left overflow-auto max-h-32">
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <div className="flex gap-2.5 justify-center">
              <button className="btn-secondary" onClick={() => this.setState({ error: null })}>
                Try again
              </button>
              <button className="btn-primary" onClick={() => window.location.reload()}>
                <RefreshCw size={15} /> Reload app
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
