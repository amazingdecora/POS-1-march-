FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json vite.config.ts tailwind.config.cjs postcss.config.cjs index.html ./
COPY src ./src

RUN npm run build

FROM nginx:1.27-alpine AS runtime

WORKDIR /usr/share/nginx/html

COPY --from=build /app/dist ./
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

