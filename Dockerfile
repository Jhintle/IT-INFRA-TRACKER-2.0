FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force && ls -la node_modules/ | head -10
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server-mysql.js"]
