import { Sequelize } from "sequelize";

//Read data from env file
const mysqlHost = process.env.MYSQL_HOST;
const mysqlDatabase = process.env.MYSQL_DATABASE;
const mysqlUsername = process.env.MYSQL_USER;
const mysqlPassword = process.env.MYSQL_PASSWORD;
const mysqlPort =
  typeof process.env.MYSQL_DB_PORT == "number" ? process.env.MYSQL_DB_PORT : 0;

//Database connection with Sequelize;
const sequelize = new Sequelize(
  `${mysqlDatabase}`,
  `${mysqlUsername}`,
  mysqlPassword,
  {
    host: mysqlHost,
    dialect: "mysql",
    port: mysqlPort,
    logging: false,
    timezone: "+05:30", //For writing to database
  }
);

//Export the Sequelize with database connection;
export default sequelize;
