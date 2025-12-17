import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChakraProvider } from '@chakra-ui/react'
import { createSystem, defaultConfig } from '@chakra-ui/react'
import App from './App.tsx'

// Create custom system with premium corporate colors and shadows
const system = createSystem(defaultConfig, {
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: '#f0f9ff' },   // Lightest background
          100: { value: '#e0f2fe' },  // Light backgrounds
          200: { value: '#bae6fd' },  // Subtle borders
          300: { value: '#7dd3fc' },  // Hover states
          400: { value: '#38bdf8' },  // Interactive elements
          500: { value: '#0ea5e9' },  // Primary brand
          600: { value: '#0284c7' },  // Primary hover
          700: { value: '#0369a1' },  // Primary active
          800: { value: '#075985' },  // Dark text
          900: { value: '#0c4a6e' },  // Darkest text
        },
        slate: {
          50: { value: '#f8fafc' },
          100: { value: '#f1f5f9' },
          200: { value: '#e2e8f0' },
          300: { value: '#cbd5e1' },
          400: { value: '#94a3b8' },
          500: { value: '#64748b' },
          600: { value: '#475569' },
          700: { value: '#334155' },
          800: { value: '#1e293b' },
          900: { value: '#0f172a' },
        },
      },
      shadows: {
        premium: { value: '0 10px 40px -10px rgba(0, 0, 0, 0.15)' },
        subtle: { value: '0 2px 8px rgba(0, 0, 0, 0.05)' },
        elevated: { value: '0 20px 60px -15px rgba(0, 0, 0, 0.2)' },
      },
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChakraProvider value={system}>
      <App />
    </ChakraProvider>
  </React.StrictMode>,
)

