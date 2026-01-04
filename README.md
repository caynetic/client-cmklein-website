# client-cmklein-website

A modern, responsive portfolio website for Christopher Klein, showcasing projects, skills, and professional information.

## 🚀 Features

- **Responsive Design**: Mobile-first approach using Bootstrap 5
- **Multiple Pages**: Home, Projects, Resume, and Contact sections
- **Contact Form**: Integrated contact form with Cloudflare Turnstile CAPTCHA
- **SEO Optimized**: Meta tags, structured data, and semantic HTML
- **Fast Loading**: Optimized static site with CDN resources
- **Professional Styling**: Clean, modern design with custom CSS

## 🛠️ Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Framework**: Bootstrap 5.3.0
- **Icons**: Font Awesome 6.4.0
- **Backend Integration**: Contact form API endpoint
- **Security**: Cloudflare Turnstile CAPTCHA
- **Deployment**: Static hosting (GitHub Pages, Netlify, etc.)

## 📁 Project Structure

```
client-cmklein-website/
├── index.html          # Home page
├── projects.html       # Projects showcase
├── resume.html         # Resume/CV page
├── contact.html        # Contact information and form
├── static/
│   ├── css/
│   │   └── styles.css  # Custom styles
│   ├── js/
│   │   └── scripts.js  # JavaScript functionality
│   ├── images/         # Images and favicon
│   └── robots.txt      # SEO robots file
└── README.md           # This file
```

## 🚀 Getting Started

### Prerequisites

- A web browser (Chrome, Firefox, Safari, etc.)
- A local web server (optional, for development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/caynetic/client-cmklein-website.git
   cd client-cmklein-website
   ```

2. **Open in browser**
   - Simply open `index.html` in your web browser
   - Or use a local server for better development experience:
     ```bash
     # Using Python
     python -m http.server 8000

     # Using Node.js (if you have http-server installed)
     npx http-server

     # Then visit http://localhost:8000
     ```

## 📝 Usage

- **Navigation**: Use the navbar to navigate between different sections
- **Contact Form**: Fill out the contact form on the contact page
- **Responsive**: The site works on desktop, tablet, and mobile devices

## 🔧 Development

### File Structure Details

- `static/css/styles.css`: Contains all custom styling
- `static/js/scripts.js`: Handles contact form functionality and Turnstile integration
- HTML files use Bootstrap classes for layout and responsiveness

### Customization

1. **Styling**: Modify `static/css/styles.css` for visual changes
2. **Content**: Edit the HTML files directly for content updates
3. **Functionality**: Update `static/js/scripts.js` for JavaScript changes
4. **API Endpoint**: Change the `contactEndpoint` in `scripts.js` if needed

## 📱 Pages

- **Home** (`index.html`): Introduction and overview
- **Projects** (`projects.html`): Showcase of work and projects
- **Resume** (`resume.html`): Professional experience and skills
- **Contact** (`contact.html`): Contact information and form

## 🌐 Deployment

This is a static website that can be deployed to any static hosting service:

- **GitHub Pages**: Push to a GitHub repository and enable Pages
- **Netlify**: Connect repository for automatic deployments
- **Vercel**: Deploy with zero configuration
- **AWS S3 + CloudFront**: For scalable hosting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is private and proprietary. All rights reserved.

## 📞 Contact

Christopher Klein - [GitHub](https://github.com/caynetic/client-cmklein-website)

---

*Built with ❤️ by Christopher Klein*
