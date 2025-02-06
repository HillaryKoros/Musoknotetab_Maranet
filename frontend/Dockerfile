# Stage 1: Dependencies
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci 

# Stage 2: Builder
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .  
RUN npm run build  

# Stage 3: Production
FROM nginx:alpine AS production
# Copy the built files
COPY --from=builder /app/dist /usr/share/nginx/html
# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Create directories for static and media files
RUN mkdir -p /app/static /app/media \
    && chown -R nginx:nginx /app \
    && chown -R nginx:nginx /usr/share/nginx/html
# Set proper permissions for nginx
RUN chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && chown -R nginx:nginx /etc/nginx/conf.d
RUN touch /var/run/nginx.pid \
    && chown -R nginx:nginx /var/run/nginx.pid
USER nginx
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# Stage 4: Development
FROM node:18-alpine AS development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]