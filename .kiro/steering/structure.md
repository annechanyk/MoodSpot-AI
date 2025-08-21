# Project Structure

## Directory Organization

```
src/
├── components/          # Reusable UI components
├── screens/            # Main application screens
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
├── styles/             # CSS/styling files
└── public/             # Static assets and public files
```

## File Naming Conventions
- Components: PascalCase (e.g., `DrawingCanvas.jsx`)
- Screens: PascalCase (e.g., `HomeScreen.jsx`)
- Hooks: camelCase with 'use' prefix (e.g., `useMoodAnalysis.js`)
- Utilities: camelCase (e.g., `canvasUtils.js`)
- Styles: kebab-case (e.g., `drawing-canvas.css`)

## Component Structure
- Each component should have its own directory when it includes multiple files
- Co-locate component-specific styles and tests
- Use functional components with hooks

## Mobile-First Approach
- Design for mobile screens first (320px+)
- Use responsive design patterns
- Touch-friendly interface elements
- Consider performance on mobile devices

## Code Organization Principles
- Keep components small and focused
- Separate business logic from UI components
- Use custom hooks for shared stateful logic
- Maintain clear separation between screens and reusable components