FROM aitrain-base:latest

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps && npm cache clean --force

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
