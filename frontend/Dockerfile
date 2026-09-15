FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY assets /usr/share/nginx/html/assets
COPY index.html impressum.html datenschutz.html agb.html 404.html robots.txt sitemap.xml /usr/share/nginx/html/

EXPOSE 80
