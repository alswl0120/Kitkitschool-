# kitkitschool-web - Vite + React + TypeScript
# Multi-stage build: build with Node, serve with Nginx

FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_ASSET_BASE=https://enumalabs-userapps.s3.ap-northeast-2.amazonaws.com/kitkitschool-web
ENV VITE_ASSET_BASE=$VITE_ASSET_BASE

RUN npx vite build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
