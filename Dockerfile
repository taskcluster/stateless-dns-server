FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY yarn.lock ./

RUN yarn install --frozen-lockfile --production

# Production stage
FROM node:22-alpine

LABEL maintainer="Yaraslau Kurmyza <ykurmyza@mozilla.com>"
LABEL description="Stateless DNS Server"

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

COPY --chown=nodejs:nodejs . .

USER nodejs

ENV TTL=600
ENV PORT=55553

EXPOSE 55553/udp

CMD ["node", "server.js"]
