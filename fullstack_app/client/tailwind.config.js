module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif']
      },
      boxShadow: {
        glow: '0 20px 60px -28px rgba(14, 165, 233, 0.45)'
      }
    }
  },
  corePlugins: {
    preflight: false
  },
  plugins: []
};
