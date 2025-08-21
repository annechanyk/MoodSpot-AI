/**
 * Mock TiDB Service for Browser Environment
 * 
 * Note: mysql2 cannot run in browsers, so this service simulates TiDB operations
 * using localStorage. In a real production environment, you would need:
 * 1. A backend API server (Node.js, Python, etc.)
 * 2. API endpoints to handle database operations
 * 3. Frontend calls to those API endpoints
 */

class MockTiDBService {
  constructor() {
    this.isConnected = false;
    this.storageKey = 'moodspot_tidb_mock_data';
  }

  async connect() {
    try {
      console.log('🔄 Mock TiDB: Simulating connection...');
      
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Initialize mock storage if it doesn't exist
      if (!localStorage.getItem(this.storageKey)) {
        localStorage.setItem(this.storageKey, JSON.stringify([]));
      }
      
      this.isConnected = true;
      console.log('✅ Mock TiDB: Connected successfully (using localStorage)');
      return true;
    } catch (error) {
      console.error('❌ Mock TiDB: Connection failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  async createMoodEntriesTable() {
    // No-op for mock service - table is simulated by localStorage array
    console.log('✅ Mock TiDB: Mood entries table ready (localStorage)');
  }

  async saveMood(mood, confidence) {
    try {
      if (!this.isConnected) {
        const connected = await this.connect();
        if (!connected) {
          throw new Error('Could not establish mock database connection');
        }
      }

      // Get existing data
      const data = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      
      // Add new mood entry
      const entry = {
        id: Date.now() + Math.random(),
        mood,
        confidence,
        created_at: new Date().toISOString()
      };
      
      data.push(entry);
      
      // Save back to localStorage
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      
      console.log('✅ Mock TiDB: Mood saved to localStorage:', { mood, confidence });
      return { insertId: entry.id };
    } catch (error) {
      console.error('❌ Mock TiDB: Error saving mood:', error);
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

      const data = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      return data.length;
    } catch (error) {
      console.error('❌ Mock TiDB: Error getting mood count:', error);
      return 0;
    }
  }

  async testConnection() {
    try {
      if (!this.connection) {
        await this.connect();
      }
      
      // Simulate ping
      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('❌ Mock TiDB: Connection test failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  getConnectionStatus() {
    return this.isConnected;
  }

  async disconnect() {
    this.isConnected = false;
    console.log('✅ Mock TiDB: Disconnected');
  }

  // Additional method to get all mood entries for debugging
  async getAllMoods() {
    try {
      const data = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      return data;
    } catch (error) {
      console.error('❌ Mock TiDB: Error getting all moods:', error);
      return [];
    }
  }

  // Method to clear all data
  async clearAllData() {
    try {
      localStorage.removeItem(this.storageKey);
      console.log('✅ Mock TiDB: All data cleared');
    } catch (error) {
      console.error('❌ Mock TiDB: Error clearing data:', error);
    }
  }
}

// Export singleton instance
export default new MockTiDBService();
