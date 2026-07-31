FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY src/ ./src/

EXPOSE 3000

VOLUME /app/data

ENV DB_PATH=/app/data/paddock.db
ENV PORT=3000

CMD ["node", "src/server.js"]
