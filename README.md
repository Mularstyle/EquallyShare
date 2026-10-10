# XP URL LAB — Retro-Futuristic URL Generator

A Windows XP-inspired URL generator with modern animations and the spectacular screen-shatter effect.

## Features

- 🪟 **Windows XP Aesthetic** - Classic Luna theme with modern twist
- ✨ **Screen Shatter Animation** - Cinematic glass-breaking transition effect
- 📁 **File Upload** - Support for PDF, video (MP4/WebM), audio (MP3), and images
- 📝 **Text Input** - Share text content with character counter
- 🔢 **Quantity Control** - Generate multiple URLs at once (1-100)
- 🎨 **Animated Background** - Floating particles and geometric shapes
- 📋 **Copy to Clipboard** - Easy URL copying with visual feedback
- 📱 **Fully Responsive** - Works on desktop, tablet, and mobile
- ♿ **Accessibility** - Respects `prefers-reduced-motion`

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Lucide React** - Icons

## Getting Started

### Install Dependencies

\`\`\bash
npm install
\`\`\`

### Run Development Server

\`\`\`bash
npm run dev
\`\`\`

### Build for Production

\`\`\`bash
npm run build
\`\`\`

### Preview Production Build

\`\`\`bash
npm run preview
\`\`\`

## Components

- **App** - Main application state management
- **XPWindow** - Windows XP-style window with title bar and controls
- **ContentInput** - File upload and text input with tabs
- **FileDropzone** - Drag-and-drop file selection
- **TextInput** - Text area with character counter
- **QuantityInput** - Numeric input with increment/decrement controls
- **GenerateButton** - Main action button with Thai text "สร้าง URL"
- **ShatterTransition** - Canvas-based screen shatter animation
- **ResultWindow** - Success screen with generated URLs
- **AnimatedBackground** - Animated gradient with particles and shapes

## Demo Mode Notice

This frontend application demonstrates the UI and interactions. Generated URLs are placeholders.

For production use, you need to integrate:
- A file upload API or object storage service (e.g., AWS S3, Google Cloud Storage)
- A URL shortening service or backend API
- Authentication and user management (optional)

## Keyboard Shortcuts

- **Ctrl/Cmd + Enter** - Generate URL (when content is valid)

## Browser Compatibility

- Modern browsers with ES2020 support
- Chrome, Firefox, Safari, Edge (latest versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- 60 FPS animations on capable devices
- Simplified effects on mobile and reduced-motion preference
- GPU-accelerated transforms
- Lazy loading and code splitting

## License

MIT

## Credits

Built with ❤️ as a retro-futuristic tribute to Windows XP
