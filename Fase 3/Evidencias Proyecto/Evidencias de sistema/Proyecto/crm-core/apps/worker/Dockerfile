# APPs/worker/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copiar package.json e instalar dependencias
COPY package*.json ./
RUN npm install --only=production

# Copiar código de la aplicación
COPY src/ ./src/

# Salud simple para health checks
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Worker healthy') || process.exit(1)"

CMD ["node", "src/worker.js"]