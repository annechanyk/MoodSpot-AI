/**
 * TiDB Hybrid Service
 * Attempts real TiDB connection, falls back to localStorage on CORS failure
 */

import { connect } from '@tidbcloud/serverless';

class TiDBHybridService {
  constructor() {
    this.connection = null;
    this.isConnected = false;
    this.usingFallback = false;
    this.storageKey = 'moodspot_tidb_fallback_data';
    this.connectionAttempted = false;
  }

  async connect() {
    if (this.connectionAttempted) {
      return this.isConnected;
    }
    
    this.connectionAttempted = true;
    
    try {
      console.log('🔄 Attempting TiDB Cloud connection...');
      
      // Try to connect to real TiDB
      this.connection = connect({
        host: 'gateway01.eu-central-1.prod.aws.tidbcloud.com',
        username: '2fmqr6VAD8iCuUH.root',
        password: '4YIkqaV7gpdJ3HA8',
        database: 'moodspot'
      });
      
      // Test the connection
      await this.connection.execute('SELECT 1 as test');
      
      this.isConnected = true;
      this.usingFallback = false;
      console.log('✅ Connected to real TiDB Cloud successfully');
      
      await this.createMoodEntriesTable();
      return true;
      
    } catch (error) {
      console.warn('⚠️ TiDB Cloud connection failed (CORS limitation):', error.message);
      console.log('🔄 Falling back to localStorage simulation...');
      
      // Fall back to localStorage
      this.usingFallback = true;
      this.isConnected = true; // Consider "connected" to localStorage
      
      // Initialize localStorage if needed
      if (!localStorage.getItem(this.storageKey)) {
        localStorage.setItem(this.storageKey, JSON.stringify([]));
      }
      
      console.log('✅ Using localStorage fallback (simulating TiDB)');
      console.log('💡 Note: In production, use a backend API to connect to TiDB');
      
      return true;
    }
  }

  async createMoodEntriesTable() {
    if (this.usingFallback) {
      // No-op for localStorage fallback
      return;
    }
    
    try {
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS mood_entries (
          id INT AUTO_INCREMENT PRIMARY KEY,
          mood VARCHAR(50) NOT NULL,
          confidence DECIMAL(5,2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await this.connection.execute(createTableQuery);
      console.log('✅ TiDB: Mood entries table ready');
    } catch (error) {
      console.error('❌ TiDB: Error creating table:', error);
    }
  }

  async saveMood(mood, confidence) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      if (this.usingFallback) {
        // Save to localStorage
        const data = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        const entry = {
          id: Date.now() + Math.random(),
          mood,
          confidence,
          created_at: new Date().toISOString()
        };
        data.push(entry);
        localStorage.setItem(this.storageKey, JSON.stringify(data));
        console.log('✅ Mood saved to localStorage fallback:', { mood, confidence });
        return { insertId: entry.id };
      } else {
        // Save to real TiDB
        const query = 'INSERT INTO mood_entries (mood, confidence) VALUES (?, ?)';
        const result = await this.connection.execute(query, [mood, confidence]);
        console.log('✅ Mood saved to real TiDB:', { mood, confidence });
        return result;
      }
    } catch (error) {
      console.error('❌ Error saving mood:', error);
      throw error;
    }
  }

  async getMoodCount() {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      if (this.usingFallback) {
        // Count from localStorage
        const data = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        return data.length;
      } else {
        // Count from real TiDB
        const query = 'SELECT COUNT(*) as count FROM mood_entries';
        const result = await this.connection.execute(query);
        const count = result[0]?.count || result[0]?.['COUNT(*)'] || 0;
        return parseInt(count);
      }
    } catch (error) {
      console.error('❌ Error getting mood count:', error);
      return 0;
    }
  }

  async testConnection() {
    try {
      if (!this.connectionAttempted) {
        return await this.connect();
      }
      return this.isConnected;
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return false;
    }
  }

  getConnectionStatus() {
    return this.isConnected;
  }

  getConnectionType() {
    if (!this.isConnected) return 'disconnected';
    return this.usingFallback ? 'fallback' : 'tidb';
  }

  async disconnect() {
    this.isConnected = false;
    this.connection = null;
    this.usingFallback = false;
    this.connectionAttempted = false;
  }

  // Debug methods
  async getAllMoods() {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      if (this.usingFallback) {
        const data = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        return data.slice(-10); // Last 10 entries
      } else {
        const query = 'SELECT * FROM mood_entries ORDER BY created_at DESC LIMIT 10';
        const result = await this.connection.execute(query);
        return result || [];
      }
    } catch (error) {
      console.error('❌ Error getting all moods:', error);
      return [];
    }
  }
}

// Export singleton instance
export default new TiDBHybridService();
