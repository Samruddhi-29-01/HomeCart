# HomeKart 🛋️

Your Home, Your Style - A modern e-commerce platform for home essentials.

## Features

- 🛍️ Product catalog with categories
- 🔐 User authentication (JWT)
- 🛒 Shopping cart functionality
- 📱 Responsive design
- 🔍 Product search and filtering
- 🎨 Modern UI with animations

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Authentication**: JWT (JSON Web Tokens)
- **Containerization**: Docker & Docker Compose

## Quick Start with Docker

### Prerequisites

- Docker and Docker Compose installed on your system

### Running the Application

1. **Clone the repository** (if applicable) and navigate to the project directory

2. **Create environment file**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration values.

3. **Build and run with Docker Compose**:
   ```bash
   docker-compose up --build
   ```

4. **Access the application**:
   - Frontend: http://localhost:5001
   - API endpoints available at http://localhost:5001

### Docker Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f app

# Rebuild and restart
docker-compose up --build --force-recreate
```

## Manual Development Setup

If you prefer to run without Docker:

### Prerequisites

- Node.js (v20 or higher)
- npm or yarn

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Run the application**:
   ```bash
   npm start
   ```

4. **For development with auto-reload**:
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication
- `POST /register` - User registration
- `POST /login` - User login

### Products
- `GET /products` - Get all products
- `POST /product` - Add new product (admin)

### Cart
- `POST /cart` - Add item to cart (requires auth)
- `GET /cart` - Get user's cart (requires auth)

## Project Structure

```
HomeKart/
├── server.js          # Express server
├── package.json       # Dependencies
├── Dockerfile         # Docker configuration
├── docker-compose.yml # Multi-container setup
├── .env.example       # Environment variables template
├── .dockerignore      # Docker ignore file
├── index.html         # Home page
├── login.html         # Login page
├── register.html      # Registration page
├── cart.html          # Shopping cart page
├── style.css          # Stylesheets
└── script.js          # Frontend JavaScript
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | development |
| `PORT` | Server port | 5000 |
| `JWT_SECRET` | JWT signing secret | (required) |
| `APP_NAME` | Application name | HomeKart |
| `APP_URL` | Application URL | http://localhost:5000 |

## Database

HomeCart uses **SQLite** as the database:
- Lightweight, file-based database (stored as `homekart.sqlite`)
- No external database server required
- Automatically initialized on first run
- Perfect for development, testing, and production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with Docker
5. Submit a pull request

## License

MIT License - see LICENSE file for details

---

Made with ❤️ for home shopping enthusiasts