// LIVE ONLINE CLOUD DATABASE ENGINE FOR ROS CAMPAIGN DASHBOARD
// Synchronizes all client workspaces, credentials, and leads across all devices, Chrome profiles, and Vercel in real time.

const CLOUD_DATABASE_URL = 'https://api.restful-api.dev/objects/ff8081819ff5b11001a03a8fda0b2031';

// 1. Fetch workspaces in real-time from Cloud Database
export async function fetchWorkspacesFromCloud(fallbackWorkspaces = []) {
  try {
    const res = await fetch(CLOUD_DATABASE_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.data && Array.isArray(data.data.workspaces) && data.data.workspaces.length > 0) {
        return data.data.workspaces;
      }
    }
  } catch (err) {
    console.warn('Cloud database fetch notice:', err);
  }
  return fallbackWorkspaces;
}

// 2. Save / Sync Workspaces to Cloud Database
export async function saveWorkspacesToCloud(workspaces) {
  if (!workspaces || !Array.isArray(workspaces) || workspaces.length === 0) return false;

  try {
    const res = await fetch(CLOUD_DATABASE_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'ros_workspaces',
        data: {
          workspaces: workspaces,
          updated_at: new Date().toISOString()
        }
      })
    });
    return res.ok;
  } catch (err) {
    console.warn('Cloud database sync error:', err);
    return false;
  }
}
