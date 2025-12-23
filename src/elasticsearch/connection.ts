import { Client } from "@elastic/elasticsearch";
import dotenv from "dotenv";
dotenv.config();

export const client = new Client({
  node: process.env.ELK_SERVER_URL,
  auth: {
    username: "elastic",
    password: "Qwerty123",
  },
});
