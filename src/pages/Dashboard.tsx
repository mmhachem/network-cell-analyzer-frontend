import React, { useState, useEffect , useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { format, subMonths } from 'date-fns';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts';

import { useAuth } from '../contexts/AuthContext';
import {
  getConnectedDevicesCount,
  getPreviouslyConnectedDevices,
  getNetworkTypeSummary,
  getSignalPowerSummary,
  getDeviceActivityTrend,
  getCurrentlyConnectedDevices,
  getOperatorSummary,
  getSINRSummary,
  Device,
  NetworkStats,
  SignalStats,
  ActivityTrend,
  getDeviceStatistics,
} from '../services/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const Dashboard: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [connectedDevices, setConnectedDevices] = useState<Device[]>([]);
  const [previouslyConnectedDevices, setPreviouslyConnectedDevices] = useState<Device[]>([]);
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null);
  const [signalStats, setSignalStats] = useState<SignalStats | null>(null);
  const [sinrStats, setSINRStats] = useState<SignalStats | null>(null);
  const [activityTrend, setActivityTrend] = useState<ActivityTrend | null>(null);
  const [operatorStats, setOperatorStats] = useState<NetworkStats | null>(null);
  const [connectedDevicesCount, setConnectedDevicesCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Add state for date range
  const [startDate, setStartDate] = useState<string>(format(subMonths(new Date(), 3), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState<string>('00:00');
  const [endTime, setEndTime] = useState<string>('23:59');
  const [timeGranularity, setTimeGranularity] = useState<'minute' | 'hour' | 'day' | 'month'>('hour');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const [deviceStats, setDeviceStats] = useState<Record<string, any>>({});
  const latestFilters = useRef({
    startDate,
    endDate,
    startTime,
    endTime,
    timeGranularity
  });
  useEffect(() => {
    latestFilters.current = {
      startDate,
      endDate,
      startTime,
      endTime,
      timeGranularity
    };
  }, [startDate, endDate, startTime, endTime, timeGranularity]);
  

  // Format dates to ISO format for backend compatibility
  const formatToBackendDateTime = (date: string, time: string, isEndDate: boolean = false) => {
    const [hours, minutes] = time.split(':');
    if (isEndDate) {
      // For end date, set time to the specified time
      return `${date}T${hours}:${minutes}:59`;
    }
    // For start date, set time to the specified time
    return `${date}T${hours}:${minutes}:00`;
  };

   

  const fetchActivityTrend = async (granularity: 'minute' | 'hour' | 'day' | 'month' = timeGranularity) => {
    try {
      const formattedStartDate = formatToBackendDateTime(startDate, startTime);
      const formattedEndDate = formatToBackendDateTime(endDate, endTime, true);
      
      const activityData = await getDeviceActivityTrend(
        formattedStartDate, 
        formattedEndDate, 
        granularity
      );
      
      setActivityTrend(activityData);
    } catch (error) {
      console.error('Error fetching activity trend:', error);
      setActivityTrend(null);
    }
  };

  const handleTimeGranularityChange = (e: any) => {
    const newGranularity = e.target.value as 'minute' | 'hour' | 'day' | 'month';
    setTimeGranularity(newGranularity);
    // Use the new granularity value immediately
    fetchActivityTrend(newGranularity);
  };

  // Add a function to parse the timestamp
  const parseTimestamp = (timestampStr: string) => {
    try {
      // First try to parse as ISO string
      const isoDate = new Date(timestampStr);
      if (!isNaN(isoDate.getTime())) {
        return isoDate;
      }

      // If not ISO format, try to parse the custom format "11 Apr 2025 12:03 AM"
      const [date, month, year, time, period] = timestampStr.split(' ');
      const [hours, minutes] = time.split(':');
      
      // Convert to 24-hour format
      let hour = parseInt(hours);
      if (period === 'PM' && hour !== 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      
      // Create date object
      return new Date(`${month} ${date} ${year} ${hour}:${minutes}`);
    } catch (error) {
      console.error('Error parsing timestamp:', error);
      // Return current date as fallback
      return new Date();
    }
  };

  const fetchDeviceStats = async (device: Device) => {
    try {
      const stats = await getDeviceStatistics(device.username, device.device_id);
      setDeviceStats(prev => ({
        ...prev,
        [`${device.username}-${device.device_id}`]: stats
      }));
    } catch (error) {
      console.error('Error fetching device statistics:', error);
    }
  };

  useEffect(() => {
    if (previouslyConnectedDevices.length > 0) {
      previouslyConnectedDevices.forEach(device => {
        fetchDeviceStats(device);
      });
    }
  }, [previouslyConnectedDevices]);

  // Add a function to check if a device is connected
  const isDeviceConnected = (device: Device) => {
    try {
      const stats = deviceStats[`${device.username}-${device.device_id}`];
      if (!stats || !stats.last_seen) return false;

      const lastSeen = new Date(stats.last_seen);
      const now = new Date();
      const timeDiff = now.getTime() - lastSeen.getTime();
      return timeDiff <= 5 * 60 * 1000; // 5 minutes in milliseconds
    } catch (error) {
      console.error('Error checking device connection status:', error);
      return false;
    }
  };

  // Add a function to check if a device is about to be disconnected
  const getConnectionStatus = (device: Device) => {
    try {
      const stats = deviceStats[`${device.username}-${device.device_id}`];
      if (!stats || !stats.last_seen) {
        return {
          isConnected: false,
          timeUntilDisconnect: 'Never connected'
        };
      }

      const lastSeen = new Date(stats.last_seen);
      const now = new Date();
      const timeDiff = (now.getTime() - lastSeen.getTime()) / (1000 * 60); // Convert to minutes
      const isConnected = timeDiff <= 5;
      
      return {
        isConnected,
        timeUntilDisconnect: isConnected ? 
          `${Math.floor(5 - timeDiff)} minutes remaining` : 
          'Disconnected'
      };
    } catch (error) {
      console.error('Error getting connection status:', error);
      return {
        isConnected: false,
        timeUntilDisconnect: 'Error checking status'
      };
    }
  };

  const fetchData = async (start: string, end: string, startTimeStr: string, endTimeStr: string) => {
    try {
      setError(null);
      setLoading(true);
      
      // Check if we have a token
      const token = localStorage.getItem('admin_token');
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      const formattedStartDate = formatToBackendDateTime(start, startTimeStr);
      const formattedEndDate = formatToBackendDateTime(end, endTimeStr, true);

      console.log('Fetching data with dates:', {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        interval: timeGranularity
      });

      // Fetch all data in parallel
      const [
        prevDevices,
        networkData,
        signalData,
        sinrData,
        opData
      ] = await Promise.all([
        getPreviouslyConnectedDevices(),
        getNetworkTypeSummary(formattedStartDate, formattedEndDate),
        getSignalPowerSummary(formattedStartDate, formattedEndDate),
        getSINRSummary(formattedStartDate, formattedEndDate),
        getOperatorSummary(formattedStartDate, formattedEndDate)
      ]);

      console.log('Raw API response for previously connected devices:', prevDevices);

      // Filter devices that have sent data in the last 5 minutes
      const filteredCurrentDevices = prevDevices.filter(device => isDeviceConnected(device));

      console.log('Current devices (last 5 minutes):', filteredCurrentDevices);

      // Fetch activity trend separately
      const activityData = await getDeviceActivityTrend(
        formattedStartDate,
        formattedEndDate,
        timeGranularity
      );

      setConnectedDevicesCount(prevDevices.length);
      setConnectedDevices(filteredCurrentDevices);
      setPreviouslyConnectedDevices(prevDevices);
      setNetworkStats(networkData);
      setSignalStats(signalData);
      setSINRStats(sinrData);
      setActivityTrend(activityData);
      setOperatorStats(opData);

    } catch (error: any) {
      console.error('Error fetching data:', error);
      let errorMessage = 'Failed to fetch data. Please try again later.';
      
      if (error.response) {
        errorMessage = `Server error: ${error.response.status} - ${error.response.data?.error || 'Unknown error'}`;
        console.error('Server response:', error.response.data);
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      
      if (error.message === 'No authentication token found. Please log in again.' || 
          error.response?.status === 403) {
        localStorage.removeItem('admin_token');
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { startDate, endDate, startTime, endTime } = latestFilters.current;
  
    // Initial fetch
    fetchData(startDate, endDate, startTime, endTime);
    setLastUpdated(new Date().toLocaleTimeString());
  
    // Auto-refresh every 10s using latest filters
    const interval = setInterval(() => {
      const { startDate, endDate, startTime, endTime } = latestFilters.current;
      fetchData(startDate, endDate, startTime, endTime);
      setLastUpdated(new Date().toLocaleTimeString());
    }, 10000);
  
    return () => clearInterval(interval);
  }, []);
  

  // Add this useEffect for checking connection status
  useEffect(() => {
    const checkConnectionStatus = () => {
      if (previouslyConnectedDevices.length > 0) {
        const currentDevices = previouslyConnectedDevices.filter(device => isDeviceConnected(device));
        setConnectedDevices(currentDevices);
      }
    };

    // Check every minute
    const interval = setInterval(checkConnectionStatus, 60000);
    
    // Initial check
    checkConnectionStatus();

    return () => clearInterval(interval);
  }, [previouslyConnectedDevices, deviceStats]);

  const handleDateChange = () => {
    fetchData(startDate, endDate, startTime, endTime);
  };

  // Transform NetworkStats to chart data
  const transformNetworkStats = (stats: NetworkStats | null) => {
    if (!stats) return [];

    return Object.entries(stats).map(([name, value]) => {
      // Remove % sign and convert to number
      const numericValue = parseFloat(value.replace('%', ''));
      return {
        name,
        value: isNaN(numericValue) ? 0 : numericValue,
      };
    });
  };

  // Transform SignalStats to chart data
  const transformSignalStats = (stats: SignalStats | null) => {
    if (!stats) return [];

    return Object.entries(stats).map(([name, value]) => ({
      name,
      value: typeof value === 'number' ? value : 0,
    }));
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    logout();
  };

  // Fixed formatter functions to handle string and number values
  const formatPercentage = (value: any) => {
    if (typeof value === 'number') {
      return `${value.toFixed(2)}%`;
    }
    if (typeof value === 'string' && value.includes('%')) {
      return value;
    }
    return '0.00%';
  };

  const formatSignalPower = (value: any) => {
    if (typeof value === 'number') {
      return `${value.toFixed(2)} dBm`;
    }
    return '0.00 dBm';
  };

  const formatSINR = (value: any) => {
    if (typeof value === 'number') {
      return `${value.toFixed(2)} dB`;
    }
    return '0.00 dB';
  };

  // Format timestamp for activity trend based on granularity
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      switch (timeGranularity) {
        case 'minute':
          return date.toLocaleString(undefined, { 
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
        case 'hour':
          return date.toLocaleString(undefined, { 
            year: 'numeric', 
            month: 'numeric', 
            day: 'numeric', 
            hour: 'numeric',
            hour12: false
          });
        case 'day':
          return date.toLocaleDateString();
        case 'month':
          return date.toLocaleString(undefined, { 
            year: 'numeric', 
            month: 'long' 
          });
        default:
          return date.toLocaleString();
      }
    } catch (error) {
      return timestamp;
    }
  };

  // Group activity data by time granularity
  const groupActivityData = (activityTrend: ActivityTrend | null) => {
    if (!activityTrend || !activityTrend.timestamps || !activityTrend.counts) {
      return [];
    }

    const groupedData = new Map<string, number>();
    
    activityTrend.timestamps.forEach((timestamp, index) => {
      const date = new Date(timestamp);
      let key: string;
      
      switch (timeGranularity) {
        case 'minute':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
          break;
        case 'hour':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
          break;
        case 'day':
          key = date.toISOString().slice(0, 10); // YYYY-MM-DD
          break;
        case 'month':
          key = date.toISOString().slice(0, 7); // YYYY-MM
          break;
        default:
          key = date.toISOString();
      }
      
      const currentCount = groupedData.get(key) || 0;
      groupedData.set(key, currentCount + activityTrend.counts[index]);
    });

    return Array.from(groupedData.entries())
      .map(([timestamp, count]) => ({
        timestamp,
        count
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  };

  const handleDeviceClick = (username: string, deviceId: string) => {
    navigate(`/device-statistics?username=${encodeURIComponent(username)}&device_id=${encodeURIComponent(deviceId)}`);
  };

  // Add this useEffect for logging
  useEffect(() => {
    console.log('Connected devices state:', connectedDevices);
  }, [connectedDevices]);

  const handleRefresh = () => {
    fetchData(startDate, endDate, startTime, endTime);
    setLastUpdated(new Date().toLocaleTimeString());
    
    // Also check connection status immediately
    if (previouslyConnectedDevices.length > 0) {
      const currentDevices = previouslyConnectedDevices.filter(device => isDeviceConnected(device));
      setConnectedDevices(currentDevices);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
        <Typography variant="h4" component="h1">
          Network Cell Analyzer Dashboard
        </Typography>
        <Button variant="contained" color="secondary" onClick={handleLogout}>
          Logout
        </Button>
      </Box>

      {/* Date Range Picker */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{
                shrink: true,
              }}
              inputProps={{
                max: endDate
              }}
            />
            <TextField
              label="Start Time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{
                shrink: true,
              }}
              inputProps={{
                min: startDate
              }}
            />
            <TextField
              label="End Time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Box>
          <Button 
            variant="contained" 
            onClick={handleDateChange}
            sx={{ height: '56px' }}
          >
            Update Data
          </Button>
        </Box>
      </Paper>

      {error && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'error.light', color: 'white' }}>
          <Typography>{error}</Typography>
        </Paper>
      )}

      {loading && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'info.light', color: 'white' }}>
          <Typography>Loading data...</Typography>
        </Paper>
      )}

      <Grid container spacing={3}>
        {/* Connected Devices Count */}
        <Grid item xs={12} md={6} lg={3}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140 }}>
            <Typography variant="h6" gutterBottom>All Previously Connected Devices</Typography>
            <Typography component="p" variant="h3" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {connectedDevicesCount}
            </Typography>
          </Paper>
        </Grid>

        {/* Operator Distribution */}
        <Grid item xs={12} md={6} lg={4.5}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 300 }}>
            <Typography variant="h6" gutterBottom>Operator Distribution</Typography>
            {operatorStats && Object.keys(operatorStats).length > 0 ? (
              <Box sx={{ height: 250, display: 'flex', justifyContent: 'center' }}>
                <PieChart width={300} height={250}>
                  <Pie
                    data={transformNetworkStats(operatorStats)}
                    cx={150}
                    cy={125}
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {transformNetworkStats(operatorStats).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={formatPercentage} />
                </PieChart>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography>No operator data available</Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Network Type Distribution */}
        <Grid item xs={12} md={6} lg={4.5}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 300 }}>
            <Typography variant="h6" gutterBottom>Network Type Distribution</Typography>
            {networkStats && Object.keys(networkStats).length > 0 ? (
              <Box sx={{ height: 250, display: 'flex', justifyContent: 'center' }}>
                <PieChart width={300} height={250}>
                  <Pie
                    data={transformNetworkStats(networkStats)}
                    cx={150}
                    cy={125}
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {transformNetworkStats(networkStats).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={formatPercentage} />
                </PieChart>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography>No network type data available</Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Signal Power by Network Type */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 300 }}>
            <Typography variant="h6" gutterBottom>Signal Power by Network Type</Typography>
            {signalStats && Object.keys(signalStats).length > 0 ? (
              <Box sx={{ height: 250, width: '100%' }}>
                <ResponsiveContainer>
                  <BarChart data={transformSignalStats(signalStats)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={formatSignalPower} />
                    <Legend />
                    <Bar dataKey="value" name="Signal Power (dBm)" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography>No signal power data available</Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* SINR by Network Type */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 300 }}>
            <Typography variant="h6" gutterBottom>SINR by Network Type</Typography>
            {sinrStats && Object.keys(sinrStats).length > 0 ? (
              <Box sx={{ height: 250, width: '100%' }}>
                <ResponsiveContainer>
                  <BarChart data={transformSignalStats(sinrStats)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={formatSINR} />
                    <Legend />
                    <Bar dataKey="value" name="SINR (dB)" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography>No SINR data available</Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Device Activity Trend */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 300 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Device Activity Trend</Typography>
              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel>Time Granularity</InputLabel>
                <Select
                  value={timeGranularity}
                  label="Time Granularity"
                  onChange={handleTimeGranularityChange}
                >
                  <MenuItem value="minute">By Minute</MenuItem>
                  <MenuItem value="hour">By Hour</MenuItem>
                  <MenuItem value="day">By Day</MenuItem>
                  <MenuItem value="month">By Month</MenuItem>
                </Select>
              </FormControl>
            </Box>
            {activityTrend && activityTrend.timestamps && activityTrend.timestamps.length > 0 ? (
              <Box sx={{ height: 250, width: '100%' }}>
                <ResponsiveContainer>
                  <LineChart
                    data={groupActivityData(activityTrend)}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      name="Device Count" 
                      stroke="#8884d8" 
                      activeDot={{ r: 8 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography>No activity trend data available</Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Currently Connected Devices Table */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Currently Connected Devices
                <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                  (Devices that sent data in the last 5 minutes)
                </Typography>
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Last updated: {lastUpdated}
                </Typography>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={handleRefresh}
                >
                  Refresh Now
                </Button>
              </Box>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Username</TableCell>
                    <TableCell>Device ID</TableCell>
                    <TableCell>IP Address</TableCell>
                    <TableCell>MAC Address</TableCell>
                    <TableCell>Last Seen</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Time Until Disconnect</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previouslyConnectedDevices && previouslyConnectedDevices.length > 0 ? (
                    previouslyConnectedDevices
                      .filter(device => {
                        const status = getConnectionStatus(device);
                        return status.isConnected;
                      })
                      .filter((device, index, self) => 
                        index === self.findIndex(d => 
                          d.username === device.username && 
                          d.device_id === device.device_id
                        )
                      )
                      .map((device, index) => {
                        const status = getConnectionStatus(device);
                        const stats = deviceStats[`${device.username}-${device.device_id}`];
                        const lastSeen = stats?.last_seen ? new Date(stats.last_seen).toLocaleTimeString() : 'Never';
                        
                        return (
                          <TableRow 
                            key={index}
                            onClick={() => handleDeviceClick(device.username, device.device_id)}
                            sx={{ 
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: 'rgba(0, 0, 0, 0.04)'
                              }
                            }}
                          >
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                {device.username}
                                <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                                  (Click for details)
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>{device.device_id}</TableCell>
                            <TableCell>{device.ip}</TableCell>
                            <TableCell>{device.mac}</TableCell>
                            <TableCell>{lastSeen}</TableCell>
                            <TableCell>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  color: status.isConnected ? 'success.main' : 'error.main',
                                  fontWeight: 'bold'
                                }}
                              >
                                {status.isConnected ? 'Connected' : 'Disconnected'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  color: status.isConnected ? 
                                    (parseInt(status.timeUntilDisconnect) < 2 ? 'warning.main' : 'text.secondary') : 
                                    'error.main'
                                }}
                              >
                                {status.timeUntilDisconnect}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} align="center">No devices currently connected</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Previously Connected Devices Table */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Previously Connected Devices</Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Username</TableCell>
                    <TableCell>Device ID</TableCell>
                    <TableCell>IP Address</TableCell>
                    <TableCell>MAC Address</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previouslyConnectedDevices && previouslyConnectedDevices.length > 0 ? (
                    previouslyConnectedDevices.map((device, index) => (
                      <TableRow key={index}>
                        <TableCell>{device.username}</TableCell>
                        <TableCell>{device.device_id}</TableCell>
                        <TableCell>{device.ip}</TableCell>
                        <TableCell>{device.mac}</TableCell>
                        <TableCell>
                          <Button 
                            variant="outlined" 
                            size="small"
                            onClick={() => handleDeviceClick(device.username, device.device_id)}
                          >
                            View Statistics
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center">No previously connected devices</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;