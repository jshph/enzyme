/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/index.html"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif'
        ],
      },
      colors: {
        // Base colors
        background: '#202020',
        surface: '#2f3136',
        input: '#40444b',
        
        // Text colors
        primary: '#e4e6eb',
        secondary: '#b9bbbe',
        muted: '#72767d',
        
        // Brand colors
        brand: {
          DEFAULT: '#7289da',
          hover: '#5a6eba',
        },
        
        // Utility colors
        blue: {
          light: 'rgba(91, 139, 243, 0.921)',
          dark: 'rgb(79 117 240)',
        },
        red: {
          DEFAULT: 'rgba(205, 103, 118, 0.92)',
        },
      },
      boxShadow: {
        card: '0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.05)',
      },
    },
  },
  plugins: [],
}

