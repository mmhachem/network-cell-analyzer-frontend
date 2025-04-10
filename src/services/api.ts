import axios from 'axios';

export interface Device {
  username: string;
  device_id: string;
  ip: string;
  mac: string;
  last_seen?: string;
}

export interface NetworkStats {
  [key: string]: string; // e.g., "2G": "50.00%"
}

export interface SignalStats {
  [key: string]: number; // e.g., "2G": -85.5
}

export interface ActivityTrend {
  timestamps: string[];
  counts: number[];
}

export interface DeviceStatistics {
  username: string;
  device_id: string;
  records_count: number;
  average_signal_power: number;
  average_sinr: number;
  connected_network_types: string[];
  last_seen: string;
}

const API_BASE_URL = 'https://network-cell-analyzer-backend-production.up.railway.app';

// Create axios instance with base URL
const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add token to requests if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Admin login
export const adminLogin = async (username: string, password: string) => {
  const response = await api.post('/admin/login', { username, password });
  if (response.data.admin_token) {
    localStorage.setItem('admin_token', response.data.admin_token);
  }
  return response.data;
};

// Get connected devices count
export const getConnectedDevicesCount = async (): Promise<number> => {
  try {
    const response = await api.get('/admin/connected_devices_count');
    return response.data.connected_devices || 0;
  } catch (error) {
    console.error('Error fetching connected devices count:', error);
    return 0;
  }
};

// Get previously connected devices
export const getPreviouslyConnectedDevices = async (): Promise<Device[]> => {
  try {
    console.log('Fetching previously connected devices...');
    const response = await api.get('/admin/previously_connected_devices');
    console.log('Previously connected devices raw response:', response);
    console.log('Previously connected devices data:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching previously connected devices:', error);
    return [];
  }
};

// Get network type summary
export const getNetworkTypeSummary = async (startDate: string, endDate: string): Promise<NetworkStats> => {
  try {
    console.log('Fetching network type summary with dates:', { startDate, endDate });
    const response = await api.get('/admin/network_type_summary', {
      params: {
        start_date: startDate,
        end_date: endDate,
      }
    });
    
    console.log('Network type summary response:', response.data);
    
    if (!response.data || typeof response.data !== 'object') {
      console.error('Invalid network type summary response:', response.data);
      return { '2G': '0.00%', '3G': '0.00%', '4G': '0.00%' };
    }
    
    // Ensure all network types are present
    const stats = response.data;
    ['2G', '3G', '4G'].forEach(type => {
      if (!(type in stats)) {
        stats[type] = '0.00%';
      }
    });
    
    return stats;
  } catch (error: any) {
    console.error('Error fetching network type summary:', error);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
    return { '2G': '0.00%', '3G': '0.00%', '4G': '0.00%' };
  }
};

// Get signal power summary
export const getSignalPowerSummary = async (startDate: string, endDate: string): Promise<SignalStats> => {
  try {
    console.log('Fetching signal power summary with dates:', { startDate, endDate });
    const response = await api.get('/admin/signal_power_summary', {
      params: {
        start_date: startDate,
        end_date: endDate,
      }
    });
    
    console.log('Signal power summary response:', response.data);
    
    if (!response.data || typeof response.data !== 'object') {
      console.error('Invalid signal power summary response:', response.data);
      return { '2G': 0, '3G': 0, '4G': 0 };
    }
    
    // Ensure all network types are present and values are numbers
    const stats = response.data;
    ['2G', '3G', '4G'].forEach(type => {
      if (!(type in stats) || typeof stats[type] !== 'number') {
        stats[type] = 0;
      }
    });
    
    return stats;
  } catch (error: any) {
    console.error('Error fetching signal power summary:', error);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
    return { '2G': 0, '3G': 0, '4G': 0 };
  }
};

// Get SINR summary
export const getSINRSummary = async (startDate: string, endDate: string): Promise<SignalStats> => {
  try {
    console.log('Fetching SINR summary with dates:', { startDate, endDate });
    const response = await api.get('/admin/sinr_summary', {
      params: {
        start_date: startDate,
        end_date: endDate,
      }
    });
    
    console.log('SINR summary response:', response.data);
    
    if (!response.data || typeof response.data !== 'object') {
      console.error('Invalid SINR summary response:', response.data);
      return { '2G': 0, '3G': 0, '4G': 0 };
    }
    
    // Ensure all network types are present and values are numbers
    const stats = response.data;
    ['2G', '3G', '4G'].forEach(type => {
      if (!(type in stats) || typeof stats[type] !== 'number') {
        stats[type] = 0;
      }
    });
    
    return stats;
  } catch (error: any) {
    console.error('Error fetching SINR summary:', error);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
    return { '2G': 0, '3G': 0, '4G': 0 };
  }
};

// Get device activity trend
export const getDeviceActivityTrend = async (startDate: string, endDate: string, interval: 'minute' | 'hour' | 'day' | 'month' = 'hour'): Promise<ActivityTrend> => {
  const response = await axios.get(`${API_BASE_URL}/admin/device_activity_trend`, {
    params: {
      start_date: startDate,
      end_date: endDate,
      interval
    },
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
    }
  });
  return response.data;
};

// Get currently connected devices
export const getCurrentlyConnectedDevices = async (): Promise<Device[]> => {
  try {
    console.log('Fetching currently connected devices...');
    const response = await api.get('/admin/currently_connected_devices');
    console.log('Currently connected devices raw response:', response);
    console.log('Currently connected devices data:', response.data);
    
    // Ensure we're returning an array
    const devices = Array.isArray(response.data) ? response.data : [];
    console.log('Processed devices:', devices);
    return devices;
  } catch (error) {
    console.error('Error fetching currently connected devices:', error);
    return [];
  }
};

// Get operator summary
export const getOperatorSummary = async (startDate: string, endDate: string): Promise<NetworkStats> => {
  try {
    console.log('Fetching operator summary with dates:', { startDate, endDate });
    const response = await api.get('/admin/operator_summary', {
      params: {
        start_date: startDate,
        end_date: endDate,
      }
    });
    
    console.log('Operator summary response:', response.data);
    
    if (!response.data || typeof response.data !== 'object') {
      console.error('Invalid operator summary response:', response.data);
      return { 'Alfa': '0.00%', 'Touch': '0.00%' };
    }
    
    // Ensure all operators are present
    const stats = response.data;
    ['Alfa', 'Touch'].forEach(op => {
      if (!(op in stats)) {
        stats[op] = '0.00%';
      }
    });
    
    return stats;
  } catch (error: any) {
    console.error('Error fetching operator summary:', error);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
    return { 'Alfa': '0.00%', 'Touch': '0.00%' };
  }
};

// Get device statistics
export const getDeviceStatistics = async (username: string, deviceId: string) => {
  const response = await api.get('/admin/device_statistics', {
    params: {
      username,
      device_id: deviceId
    }
  });
  return response.data;
};

// Submit cell data
export const submitCellData = async (data: {
  operator: string;
  signal_power: number;
  sinr: number;
  network_type: string;
  frequency_band: string;
  cell_id: string;
  device_mac: string;
  device_ip: string;
  device_id: string;
}) => {
  try {
    // Format the current time in the required format
    const now = new Date();
    const timestamp = now.toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const response = await api.post('/submit_data', {
      ...data,
      timestamp
    });

    return response.data;
  } catch (error) {
    console.error('Error submitting cell data:', error);
    throw error;
  }
};