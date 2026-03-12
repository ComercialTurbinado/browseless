# Build do capture-service (para EasyPanel build a partir da raiz do repo)
FROM node:22-alpine
WORKDIR /app
COPY capture-service/package.json capture-service/package-lock.json* ./
RUN npm install --production
COPY capture-service/src ./src
EXPOSE 4000
CMD ["node", "src/index.js"]
