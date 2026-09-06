// REAL-TIME ZERO-CONFIG CLOUD PERSISTENCE ENGINE
// Ensures all ROS Warriors, Tasks, Payments, and Workspaces sync across all devices, browsers, and Incognito tabs in real-time.

const REST_SYNC_ENDPOINT = 'https://api.restful-api.dev/objects/ff808181a067127101a07873a3392b1b';

// Fetch global metadata (warriors, tasks, etc.) from cloud in real time
export async function fetchGlobalMetaFromCloud() {
  try {
    const res = await fetch(REST_SYNC_ENDPOINT, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    if (res.ok) {
      const result = await res.json();
      if (result && result.data) {
        return result.data;
      }
    }
  } catch (err) {
    console.warn('Real-time cloud meta fetch notice:', err);
  }
  return null;
}

// Save global metadata (warriors, tasks, etc.) to cloud immediately
export async function saveGlobalMetaToCloud(meta) {
  if (!meta || typeof meta !== 'object') return false;

  try {
    // Merge with existing cloud data first so we don't overwrite other fields
    const current = await fetchGlobalMetaFromCloud();
    const mergedData = {
      ...(current || {}),
      ...meta,
      updatedAt: new Date().toISOString()
    };

    const res = await fetch(REST_SYNC_ENDPOINT, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'ros_global_cloud_sync_v1',
        data: mergedData
      })
    });

    return res.ok;
  } catch (err) {
    console.warn('Real-time cloud meta save error:', err);
    return false;
  }
}

// Workspaces cloud sync helpers
export async function fetchWorkspacesFromCloud(fallbackWorkspaces = []) {
  try {
    const meta = await fetchGlobalMetaFromCloud();
    if (meta && Array.isArray(meta.workspaces) && meta.workspaces.length > 0) {
      return meta.workspaces;
    }
  } catch (err) {
    console.warn('Workspaces cloud fetch notice:', err);
  }
  return fallbackWorkspaces;
}

export async function saveWorkspacesToCloud(workspaces) {
  if (!workspaces || !Array.isArray(workspaces)) return false;
  return saveGlobalMetaToCloud({ workspaces });
}
