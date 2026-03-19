FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
CMD ["sh", "-c", "npm install --legacy-peer-deps && npm run dev"]
