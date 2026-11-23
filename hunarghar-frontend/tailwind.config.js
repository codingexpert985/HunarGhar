/** Palette taken from dyed textile: indigo, madder rose, marigold, on cool paper. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1d1b36',
        indigo: { DEFAULT: '#2c2f73', 700: '#23265e', 100: '#e4e5f4', 50: '#f1f1fa' },
        madder: { DEFAULT: '#b83a5a', 700: '#9a2f4a', 100: '#f8e1e7' },
        marigold: { DEFAULT: '#e9a21a', 100: '#fbefcf', 700: '#8a5d00' },
        paper: '#f7f7fb',
        leaf: { DEFAULT: '#2f7d5b', 100: '#dff1e8' }
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
