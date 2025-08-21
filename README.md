# MoodSpot 🎨📍

**Discover your mood, find your spot**

MoodSpot is a mobile-first React application that lets you express your emotions through touch-based drawing, analyzes your mood using AI, and provides personalized local business recommendations based on how you're feeling.

## ✨ Features

- **🎨 Mood Canvas**: Touch-friendly drawing interface optimized for mobile devices
- **🤖 AI Mood Analysis**: Advanced mood detection using OpenAI's GPT-4 Vision
- **📍 Spot Finder**: Personalized local business recommendations based on your mood
- **📊 Mood Journey**: Track your emotional patterns over time
- **🔒 Privacy First**: All personal data stored locally on your device
- **⚡ Rate Limited**: Smart API usage management to stay within budget

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd moodspot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   Navigate to `http://localhost:5173`

## 🔑 API Keys Required

MoodSpot requires two API keys for full functionality:

### OpenAI API Key
- **Purpose**: Mood analysis from drawings
- **Daily Limit**: 100 calls
- **Get yours**: [OpenAI Platform](https://platform.openai.com/api-keys)
- **Environment Variable**: `VITE_OPENAI_API_KEY`

### Google Places API Key
- **Purpose**: Local business recommendations
- **Daily Limit**: 250 calls
- **Get yours**: [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- **Environment Variable**: `VITE_GOOGLE_PLACES_API_KEY`

## 📱 How It Works

1. **Draw Your Mood**: Use the touch-friendly canvas to express how you're feeling
2. **AI Analysis**: MoodSpot analyzes your drawing patterns to detect your emotional state
3. **Find Your Spot**: Get personalized recommendations for local businesses that match your mood
4. **Track Progress**: View your mood history and discover patterns over time

## 🏗️ Architecture

MoodSpot is built with:

- **Frontend**: React 18 with Vite
- **Routing**: React Router DOM
- **Storage**: IndexedDB for local data persistence
- **APIs**: OpenAI GPT-4 Vision, Google Places API
- **Rate Limiting**: Client-side quota management
- **Testing**: Vitest for unit and integration tests

## 📊 Rate Limits

MoodSpot implements strict rate limiting to manage API costs:

- **OpenAI API**: 100 calls per day
- **Google Places API**: 250 calls per day  
- **Database Operations**: 1,000 operations per day

Quotas reset daily at midnight local time.

## 🧪 Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run tests

### Project Structure

```
src/
├── components/          # Reusable UI components
├── screens/            # Main application screens
├── services/           # Core services (rate limiting, storage)
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
├── config/             # Configuration and branding
└── styles/             # CSS styling files
```

## 🎨 Mood Categories

MoodSpot recognizes various emotional states and maps them to appropriate business categories:

- **Happy** → Restaurants, parks, shopping, entertainment
- **Calm** → Spas, libraries, cafes, museums
- **Anxious** → Spas, parks, gyms, quiet cafes
- **Creative** → Art galleries, museums, bookstores
- **Energetic** → Gyms, amusement parks, active venues
- **Social** → Restaurants, bars, social venues

## 🔒 Privacy & Security

- **Local Storage**: All personal data stays on your device
- **No Server**: No server-side storage of drawings or mood data
- **API Security**: Secure API key management
- **Data Control**: Users control their data retention

## 🌟 Contributing

We welcome contributions! Please see our contributing guidelines for details.

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Email**: support@moodspot.app
- **Issues**: [GitHub Issues](repository-url/issues)
- **Documentation**: [Wiki](repository-url/wiki)

---

**MoodSpot** - Where emotions meet locations 🎨📍