module.exports = {
  "type": "postgres",
  "port": process.env.POSTGRES_PORT,
  "host": process.env.POSTGRES_HOST,
  "username": process.env.POSTGRES_USER,
  "password": process.env.POSTGRES_PASSWORD,
  "database": process.env.POSTGRES_DATABASE,
  "entities": ["./dist/**/*.entity.js"],
  "synchronize": false
}
