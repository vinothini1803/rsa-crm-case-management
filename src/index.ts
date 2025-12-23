//Requirement;
require("dotenv").config();
import AppService from "./server";
const service = new AppService();

//Server connect based on NODE_ENV Requirement;
if (
  require.main &&
  (process.env.NODE_ENV === "prod" ||
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "test")
) {
  service.start();
} else {
  console.error("Server not started.");
}

//Export port and service;
export const port = process.env.PORT;
export const app = service.app;
