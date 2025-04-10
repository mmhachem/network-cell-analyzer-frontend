import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Grid,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { getDeviceStatistics } from '../services/api';

interface DeviceStats {
  username: string;
  device_id: string;
  records_count: number;
  average_signal_power: number;
  average_sinr: number;
  connected_network_types: string[];
  last_seen: string;
}

const DeviceStatistics: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const username = params.get('username');
    const deviceId = params.get('device_id');

    if (!username || !deviceId) {
      setError('Username and Device ID are required');
      setLoading(false);
      return;
    }

    const fetchDeviceStats = async () => {
      try {
        const stats = await getDeviceStatistics(username, deviceId);
        setDeviceStats(stats);
      } catch (error: any) {
        setError(error.message || 'Failed to fetch device statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchDeviceStats();
  }, [location.search]);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    logout();
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography>Loading device statistics...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'error.light', color: 'white' }}>
          <Typography>{error}</Typography>
        </Paper>
        <Button variant="contained" onClick={handleBack}>
          Back to Dashboard
        </Button>
      </Container>
    );
  }

  if (!deviceStats) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography>No device statistics found</Typography>
        <Button variant="contained" onClick={handleBack}>
          Back to Dashboard
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
        <Typography variant="h4" component="h1">
          Device Statistics
        </Typography>
        <Box>
          <Button variant="contained" onClick={handleBack} sx={{ mr: 2 }}>
            Back to Dashboard
          </Button>
          <Button variant="contained" color="secondary" onClick={handleLogout}>
            Logout
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Device Information
            </Typography>
            <TableContainer>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell>Username</TableCell>
                    <TableCell>{deviceStats.username}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Device ID</TableCell>
                    <TableCell>{deviceStats.device_id}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Total Records</TableCell>
                    <TableCell>{deviceStats.records_count}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Average Signal Power</TableCell>
                    <TableCell>{deviceStats.average_signal_power.toFixed(2)} dBm</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Average SINR</TableCell>
                    <TableCell>{deviceStats.average_sinr.toFixed(2)} dB</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Connected Network Types</TableCell>
                    <TableCell>{deviceStats.connected_network_types.join(', ')}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Last Seen</TableCell>
                    <TableCell>{new Date(deviceStats.last_seen).toLocaleString()}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default DeviceStatistics; 