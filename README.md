# Dekodek - Dive Decompression Planner

An Angular application with Tailwind CSS for planning dive decompression profiles using the ZH-L16C algorithm.

## Features

- Multi-gas dive planning (bottom gas + optional deco gas)
- ZH-L16C decompression algorithm
- Gradient Factor (GF) support
- Real-time depth profile visualization
- Gas consumption calculations
- Maximum Operating Depth (MOD) warnings

## Prerequisites

### For local development:
- Node.js (v18 or higher)
- npm or yarn

### For Docker:
- Docker
- Docker Compose (optional)

## Installation

1. Install dependencies:
```bash
npm install
```

## Development

Run the development server:
```bash
npm start
```

Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Build

Build the project for production:
```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Docker

### Build and run with Docker

Build the Docker image:
```bash
docker build -t dekodek .
```

Run the container:
```bash
docker run -d -p 8080:80 dekodek
```

The application will be available at `http://localhost:8080`

### Using Docker Compose

Build and run with docker-compose:
```bash
docker-compose up -d
```

Stop the container:
```bash
docker-compose down
```

### Deploy to Docker Hub

1. **Login to Docker Hub:**
```bash
docker login
```
Enter your Docker Hub username and password when prompted.

2. **Tag your image** (replace `moustacheacademy` with your Docker Hub username):
```bash
docker build -t moustacheacademy/dekodek:latest .
```

Or tag an existing image:
```bash
docker tag dekodek:latest moustacheacademy/dekodek:latest
```

3. **Push the image to Docker Hub:**
```bash
docker push moustacheacademy/dekodek:latest
```

4. **Pull and run from Docker Hub:**
```bash
docker pull moustacheacademy/dekodek:latest
docker run -d -p 8080:80 moustacheacademy/dekodek:latest
```

## Usage

1. Set your bottom gas oxygen percentage (21-40%)
2. Optionally select a deco gas (EAN50, EAN80, or O2 100%)
3. Configure dive parameters:
   - Maximum depth (limited by MOD)
   - Bottom time
   - Gradient Factors (GF Low/High)
   - SAC rate
   - Tank volume
4. View the calculated dive profile and metrics

## Technical Details

- **Framework**: Angular 17 (Standalone components)
- **Styling**: Tailwind CSS
- **Charts**: Chart.js
- **Algorithm**: ZH-L16C decompression model

## License

This project is for educational and recreational diving purposes. Always verify calculations with certified dive computers and follow proper diving safety protocols.

