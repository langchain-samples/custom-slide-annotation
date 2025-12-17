import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChakraProvider } from '@chakra-ui/react'
import { createSystem, defaultConfig } from '@chakra-ui/react'
import App from './App.tsx'

// Create custom system with refined blue palette
const system = createSystem(defaultConfig, {
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: '#e0f2fe' },   // Light blue background
          100: { value: '#bae6fd' },  // Lighter accent
          200: { value: '#7dd3fc' },  // Borders
          300: { value: '#38bdf8' },  // Hover states
          400: { value: '#0ea5e9' },  // Primary buttons
          500: { value: '#0284c7' },  // Main brand
          600: { value: '#0369a1' },  // Dark buttons
          700: { value: '#075985' },  // Text
          800: { value: '#0c4a6e' },  // Headers
          900: { value: '#082f49' },  // Darkest
        },
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

