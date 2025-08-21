/**
 * TiDB Cloud Serverless Service
 * Uses @tidbcloud/serverless driver for browser compatibility
 */

import { connect } from '@tidbcloud/serverless';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

class TiDBServerlessService {
  constructor() {
    this.connection = null;
    this.isConnected = false;
    
    // Connection URL format: mysql://username:password@host:port/database
    this.connectionUrl = 'mysql://2fmqr6VAD8iCuUH.root:4YIkqaV7gpdJ3HA8@gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/moodspot';
  }

  async connect() {
    try {
      console.log('🔄 Connecting to TiDB Cloud Serverless...');
      console.log('🔄 Environment check - Browser:', isBrowser);
      console.log('🔄 Connection URL format check:', this.connectionUrl.replace(/:[^:]*@/, ':****@'));
      
      // Try object format first as it might be more browser-friendly
      this.connection = connect({
        host: 'gateway01.eu-central-1.prod.aws.tidbcloud.com',
        username: '2fmqr6VAD8iCuUH.root',
        password: '4YIkqaV7gpdJ3HA8',
        database: 'moodspot'
      });
      
      console.log('🔄 Connection object created, testing with query...');
      
      // Test the connection with a simple query
      const testResult = await this.connection.execute('SELECT 1 as test');
      console.log('✅ Test query result:', testResult);
      
      this.isConnected = true;
      console.log('✅ Connected to TiDB Cloud Serverless successfully');
      
      // Create table if it doesn't exist
      await this.createMoodEntriesTable();
      
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to TiDB Cloud Serverless:', error.message);
      console.error('❌ Error name:', error.name);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Full error:', error);
      
      // Provide helpful error context
      if (error.message.includes('fetch')) {
        console.error('💡 This might be a network/CORS issue in the browser environment');
      }
      if (error.message.includes('authentication') || error.message.includes('access denied')) {
        console.error('💡 This might be a credentials issue');
      }
      
      this.isConnected = false;
      return false;
    }
  }

  async createMoodEntriesTable() {
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
      console.error('❌ TiDB: Error creating mood_entries table:', error);
    }
  }

  async saveMood(mood, confidence) {
    try {
      if (!this.isConnected || !this.connection) {
        const connected = await this.connect();
        if (!connected) {
          throw new Error('Could not establish database connection');
        }
      }

      const query = 'INSERT INTO mood_entries (mood, confidence) VALUES (?, ?)';
      const result = await this.connection.execute(query, [mood, confidence]);
      
      console.log('✅ TiDB: Mood saved successfully:', { mood, confidence });
      return result;
    } catch (error) {
      console.error('❌ TiDB: Error saving mood:', error);
      throw error;
    }
  }

  async getMoodCount() {
    try {
      if (!this.isConnected || !this.connection) {
        const connected = await this.connect();
        if (!connected) {
          return 0;
        }
      }

      const query = 'SELECT COUNT(*) as count FROM mood_entries';
      const result = await this.connection.execute(query);
      
      // The serverless driver returns results as an array directly
      const count = result[0]?.count || result[0]?.['COUNT(*)'] || 0;
      return parseInt(count);
    } catch (error) {
      console.error('❌ TiDB: Error getting mood count:', error);
      return 0;
    }
  }

  async testConnection() {
    try {
      if (!this.connection) {
        return await this.connect();
      }
      
      // Test with a simple query
      await this.connection.execute('SELECT 1');
      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('❌ TiDB: Connection test failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  getConnectionStatus() {
    return this.isConnected;
  }

  async disconnect() {
    // The serverless driver doesn't require explicit disconnection
    this.isConnected = false;
    this.connection = null;
    console.log('✅ TiDB: Disconnected');
  }

  // Debug method to get all mood entries
  async getAllMoods() {
    try {
      if (!this.isConnected || !this.connection) {
        const connected = await this.connect();
        if (!connected) {
          return [];
        }
      }

      const query = 'SELECT * FROM mood_entries ORDER BY created_at DESC LIMIT 10';
      const result = await this.connection.execute(query);
      return result || [];
    } catch (error) {
      console.error('❌ TiDB: Error getting all moods:', error);
      return [];
    }
  }
}

// Export singleton instance
export default new TiDBServerlessService();
