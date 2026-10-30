import { Env } from "./env.config";

export default {
  HOST: Env.dbPostgres.host,
  USER: Env.dbPostgres.username,
  PASSWORD: Env.dbPostgres.password,
  DB: Env.dbPostgres.database,
  DIALECT: "postgres",
  LOGGING: false,
  PORT: Env.dbPostgres.port,
  pool: {
    max: 20,
    min: 1,
    acquire: 60000,
    idle: 10000,
  },
};
