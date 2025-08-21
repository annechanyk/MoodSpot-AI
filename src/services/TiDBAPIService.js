/**
 * TiDB API Service
 * Connects to TiDB through backend API server (no CORS issues)
 */

class TiDBAPIService {
  constructor() {
    const envBase = (import.meta.env && import.meta.env.VITE_API_BASE_URL)
      || (typeof process !== 'undefined' && process.env && process.env.VITE_API_BASE_URL)
      || ''
    this.baseURL = envBase && envBase.trim() !== '' ? envBase : '/api'
    this.isConnected = false;
  }

  async connect() {
    try {
      console.log('🔄 Connecting to TiDB API backend...');
      
      const response = await fetch(`${this.baseURL}/health`);
      if (response.ok) {
        this.isConnected = true;
        console.log('✅ Connected to TiDB API backend');
        return true;
      }
      throw new Error('Backend not responding');
    } catch (error) {
      console.error('❌ Failed to connect to backend:', error.message);
      console.error('💡 Make sure backend server is running on port 3001 or that /api is proxied to it');
      this.isConnected = false;
      return false;
    }
  }

  async createMoodEntriesTable() {
    // Table creation is handled by backend
    console.log('✅ Table creation handled by backend');
  }

  async saveMood(mood, confidence) {
    try {
      if (!this.isConnected) {
        const connected = await this.connect();
        if (!connected) {
          throw new Error('Could not establish backend connection');
        }
      }

      const response = await fetch(`${this.baseURL}/moods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood, confidence })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save mood');
      }
      
      const result = await response.json();
      console.log('✅ Mood saved to TiDB via API:', { mood, confidence });
      return result;
    } catch (error) {
      console.error('❌ Error saving mood:', error);
      throw error;
    }
  }

  async getMoodCount() {
    try {
      if (!this.isConnected) {
        const connected = await this.connect();
        if (!connected) {
          return 0;
        }
      }

      const response = await fetch(`${this.baseURL}/moods/count`);
      if (!response.ok) {
        throw new Error('Failed to get count');
      }
      
      const data = await response.json();
      return data.count || 0;
    } catch (error) {
      console.error('❌ Error getting mood count:', error);
      return 0;
    }
  }

  async testConnection() {
    return await this.connect();
  }

  getConnectionStatus() {
    return this.isConnected;
  }

  getConnectionType() {
    if (!this.isConnected) return 'disconnected';
    return 'tidb'; // Real TiDB connection via API
  }

  async disconnect() {
    this.isConnected = false;
  }

  // Debug method to get all mood entries
  async getAllMoods() {
    try {
      if (!this.isConnected) {
        const connected = await this.connect();
        if (!connected) {
          return [];
        }
      }

      const response = await fetch(`${this.baseURL}/moods`);
      if (!response.ok) {
        throw new Error('Failed to get moods');
      }
      
      const data = await response.json();
      return data.moods || [];
    } catch (error) {
      console.error('❌ Error getting all moods:', error);
      return [];
    }
  }
}

// Export singleton instance
export default new TiDBAPIService();
