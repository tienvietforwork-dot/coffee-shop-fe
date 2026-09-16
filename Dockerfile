# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite bakes VITE_* env vars in at build time. Pass them as build args if you
# need a custom API/WS URL baked into this image, e.g.:
#   docker build --build-arg VITE_API_URL=https://api.example.com/api \
#                --build-arg VITE_WS_URL=https://api.example.com/ws -t coffee-shop-fe .
ARG VITE_API_URL=http://localhost:8080/api
ARG VITE_WS_URL=http://localhost:8080/ws
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build

# --- Serve stage ---
FROM nginx:1.27-alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
