import React from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { Bell, BellOff } from 'lucide-react';

export default function NotificationButton({ className = '', showLabelAlways = false }) {
  const { 
    notificationPermission, 
    desktopAlertsEnabled, 
    requestDesktopNotificationPermission, 
    toggleDesktopAlerts,
    setLiveToast 
  } = useWorkspace();

  const handleEnable = async () => {
    const res = await requestDesktopNotificationPermission();
    if (res === 'denied') {
      alert('Desktop notifications are blocked by your browser settings.\n\nTo enable:\n1. Click the site settings/lock icon next to the URL in your browser address bar.\n2. Set "Notifications" to "Allow".\n3. Reload the page.');
    }
  };

  const handleToggle = () => {
    const nextState = !desktopAlertsEnabled;
    toggleDesktopAlerts(nextState);
    if (setLiveToast) {
      setLiveToast({
        title: nextState ? 'Desktop Notifications Active' : 'Desktop Notifications Muted',
        message: nextState 
          ? 'You will receive OS desktop alerts for incoming messages and task approvals.' 
          : 'Desktop notifications are temporarily muted on this device.'
      });
    }
  };

  const handleBlockedClick = () => {
    alert('Desktop notifications are blocked by your browser settings.\n\nTo enable:\n1. Click the lock/settings icon next to your URL bar.\n2. Change Notifications to "Allow".\n3. Refresh this page.');
  };

  // 1. If notifications not granted (default, prompt, or unsupported)
  if (notificationPermission !== 'granted') {
    if (notificationPermission === 'denied') {
      return (
        <button
          onClick={handleBlockedClick}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25 text-xs font-bold transition cursor-pointer whitespace-nowrap ${className}`}
          title="Desktop notifications are blocked in browser settings (Click to fix)"
        >
          <BellOff className="w-3.5 h-3.5 shrink-0" />
          <span>Enable Desktop Notification</span>
        </button>
      );
    }

    return (
      <button
        onClick={handleEnable}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#00C2FF]/20 via-[#00C2FF]/30 to-[#0099FF]/20 hover:from-[#00C2FF]/35 hover:to-[#0099FF]/35 border-2 border-[#00C2FF] text-[#00C2FF] hover:text-white text-xs font-bold transition-all shadow-lg shadow-[#00C2FF]/25 animate-pulse transform hover:scale-[1.02] cursor-pointer whitespace-nowrap ${className}`}
        title="Click to enable desktop notifications for live campaign alerts, approvals, and chat"
      >
        <Bell className="w-3.5 h-3.5 shrink-0 animate-bounce text-[#00C2FF]" />
        <span>Enable Desktop Notification</span>
      </button>
    );
  }

  // 2. If granted
  return (
    <button
      onClick={handleToggle}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
        desktopAlertsEnabled
          ? 'bg-[#111827] text-[#00E5A0] border-[#00E5A0]/40 hover:bg-[#00E5A0]/10 hover:border-[#00E5A0]'
          : 'bg-[#111827] text-gray-400 border-[#1E3A5F] hover:text-white'
      } ${className}`}
      title={desktopAlertsEnabled ? 'Desktop notifications are ON (Click to mute)' : 'Desktop notifications are MUTED (Click to unmute)'}
    >
      {desktopAlertsEnabled ? (
        <>
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00E5A0] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00E5A0]" />
          </span>
          <Bell className="w-3.5 h-3.5 shrink-0 text-[#00E5A0]" />
          <span className={showLabelAlways ? 'inline' : 'hidden sm:inline'}>Desktop Notifications ON</span>
          {!showLabelAlways && <span className="sm:hidden">Notifications ON</span>}
        </>
      ) : (
        <>
          <BellOff className="w-3.5 h-3.5 shrink-0 text-gray-400" />
          <span className={showLabelAlways ? 'inline' : 'hidden sm:inline'}>Desktop Notifications Muted</span>
          {!showLabelAlways && <span className="sm:hidden">Muted</span>}
        </>
      )}
    </button>
  );
}
