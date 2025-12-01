FROM node:20-alpine

# toolchain para módulos nativos (bcrypt)
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY tsconfig.json nest-cli.json ./
COPY src ./src

EXPOSE 3000
# MUY IMPORTANTE: start:dev (no start)
CMD ["npm","run","start:dev"]
