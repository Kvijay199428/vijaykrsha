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
# This image serves assets through nginx, so emit precompressed gzip sidecars
# (nginx gzip_static hands them out byte-for-byte). Cloudflare Pages builds leave
# this unset — the edge compresses on the wire and sidecars would be dead weight.
ENV VITE_PRECOMPRESS=1
RUN npm run build
# Pre-compress favicon/icon assets into .gz/.br/.zst sidecars.
# nginx serves these via Accept-Encoding content-negotiation.
RUN npm run precompress:icons
# Fail the image build if a required sidecar is missing or corrupt.
RUN npm run verify:compress -- --mode=nginx

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
