import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ctqg: {
          blue:   '#1E3A8A',
          orange: '#F97316',
        }
      },
      borderWidth: {
        '3': '3px',
      }
    },
  },
  plugins: [],
}

export default config
