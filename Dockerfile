FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node index.html game.css LICENSE ./
COPY --chown=node:node js/ ./js/
COPY --chown=node:node shared/ ./shared/
COPY --chown=node:node server/ ./server/
ENV HOST=0.0.0.0 PORT=8081 NODE_ENV=production
USER node
EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:8081/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/server.js"]
