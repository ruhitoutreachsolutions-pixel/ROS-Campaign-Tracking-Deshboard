// CLOUD SYNCHRONIZATION ENGINE FOR ROS CAMPAIGN DASHBOARD
// Enables real-time database storage across all devices, Chrome profiles, and Vercel deployments.

// A public, zero-config global cloud key for ROS Dashboard
const CLOUD_SYNC_ENDPOINT = 'https://api.npoint.io/d3f7f89369f3ba9e8b7d'; // Reliable fast cloud JSON store

export async function fetchWorkspacesFromCloud(fallbackWorkspaces) {
  try {
    const res = await fetch(CLOUD_SYNC_ENDPOINT, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Cloud database fetch notice (using cached/fallback):', err);
  }
  return fallbackWorkspaces;
}

export async function saveWorkspacesToCloud(workspaces) {
  if (!workspaces || !Array.isArray(workspaces)) return false;
  
  try {
    const res = await fetch(CLOUD_SYNC_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(workspaces)
    });
    return res.ok;
  } catch (err) {
    console.warn('Cloud database sync error:', err);
    return false;
  }
}
