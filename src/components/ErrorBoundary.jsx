import React from 'react';
import { RefreshCw, AlertTriangle, Trash2, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHardReset = () => {
    try {
      // Clear app localStorage to remove any corrupt cache
      const keys = [
        'ros_workspaces_prod_v3',
        'ros_active_wsd_prod_v3',
        'ros_auth_user_prod_v3',
        'ros_email_copies_v1',
        'ros_notes_v1',
        'ros_todos_v1',
        'ros_payments_v1',
        'ros_tasks_v1',
        'ros_reports_v1',
        'ros_warriors_v1',
        'ros_warrior_timeline_v1'
      ];
      keys.forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    window.location.href = window.location.origin;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#0A0A0A] text-white flex flex-col items-center justify-center p-6 select-none font-['Space_Grotesk']">
          <div className="max-w-md w-full bg-[#111827] border border-red-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
            
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h1 className="text-xl font-bold text-white tracking-tight">
              Application Auto-Recovery
            </h1>
            
            <p className="text-xs text-[#7B7B7B] mt-2 leading-relaxed">
              A temporary rendering glitch was intercepted. Your outreach leads and cloud data are safe in Supabase and IndexedDB.
            </p>

            {this.state.error && (
              <div className="mt-4 p-3 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-left">
                <div className="text-[10px] text-red-400 font-mono break-words">
                  {this.state.error.toString()}
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-[#00C2FF] hover:bg-[#00C2FF]/90 text-[#0A0A0A] rounded-xl text-xs font-bold transition shadow"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Page
              </button>

              <button
                onClick={this.handleHardReset}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Reset Local Cache
              </button>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
