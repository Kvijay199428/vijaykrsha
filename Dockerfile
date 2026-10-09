FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# Vite inlines VITE_* vars at build time, so they must be present in the build
# stage — setting them only in the runtime environment has no effect.
ARG VITE_TURNSTILE_SITE_KEY=""
ARG VITE_TURNSTILE_CONTACT_SITE_KEY=""
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
ENV VITE_TURNSTILE_CONTACT_SITE_KEY=$VITE_TURNSTILE_CONTACT_SITE_KEY
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
