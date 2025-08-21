class TiDBService {
  constructor() {
    this.connection = null;
    this.isConnected = false;
    this.mysql = null; // Lazy load mysql2
    this.config = {
      host: 'gateway01.eu-central-1.prod.aws.tidbcloud.com',
      port: 4000,
      user: '2fmqr6VAD8iCuUH.root',
      password: '4YIkqaV7gpdJ3HA8',
      database: 'moodspot',
      ssl: {
        rejectUnauthorized: false
      },
      connectTimeout: 10000,
      acquireTimeout: 10000,
      timeout: 10000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    };
  }

  async loadMysql() {
    if (!this.mysql) {
      try {
        console.log('🔄 Attempting to import mysql2/promise...');
        const mysqlModule = await import('mysql2/promise');
        console.log('✅ mysql2 module imported:', typeof mysqlModule);
        console.log('✅ mysql2.default:', typeof mysqlModule.default);
        this.mysql = mysqlModule.default;
        if (!this.mysql || typeof this.mysql.createConnection !== 'function') {
          throw new Error('mysql2 createConnection method not available');
        }
      } catch (error) {
        console.error('❌ Failed to load mysql2:', error);
        console.error('❌ Error details:', {
          message: error.message,
          stack: error.stack
        });
        throw new Error(`mysql2 module not available: ${error.message}`);
      }
    }
    return this.mysql;
  }

  async connect() {
    try {
      console.log('🔄 Loading mysql2 module...');
      const mysql = await this.loadMysql();
      console.log('✅ mysql2 loaded successfully');
      
      console.log('🔄 Connecting to TiDB with config:', {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user.substring(0, 10) + '...' // Don't log full credentials
      });
      
      this.connection = await mysql.createConnection(this.config);
      this.isConnected = true;
      console.log('✅ Connected to TiDB successfully');
      
      // Test the connection
      await this.connection.ping();
      console.log('✅ TiDB connection ping successful');
      
      // Create table if it doesn't exist
      await this.createMoodEntriesTable();
      
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to TiDB:', error.message);
      console.error('❌ Full error:', error);
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
      console.log('Mood entries table ready');
    } catch (error) {
      console.error('Error creating mood_entries table:', error);
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
      const [result] = await this.connection.execute(query, [mood, confidence]);
      console.log('Mood saved to TiDB:', { mood, confidence });
      return result;
    } catch (error) {
      console.error('Error saving mood to TiDB:', error);
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
      const [rows] = await this.connection.execute(query);
      return rows[0].count;
    } catch (error) {
      console.error('Error getting mood count from TiDB:', error);
      return 0;
    }
  }

  async testConnection() {
    try {
      if (!this.connection) {
        await this.connect();
      }
      
      await this.connection.ping();
      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('TiDB connection test failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  getConnectionStatus() {
    return this.isConnected;
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
      this.isConnected = false;
    }
  }
}

// Export singleton instance
export default new TiDBService();
