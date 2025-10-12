FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
ENV PORT=8000

CMD ["npm", "start"]