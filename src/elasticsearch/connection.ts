import { Client } from "@elastic/elasticsearch";
import dotenv from "dotenv";
dotenv.config();

export const client = new Client({
  node: process.env.ELK_SERVER_URL,
  auth: {
    username: "elastic",
    password: "9dLRnXYI39u2=nl*3JsN",
  },
 ssl: {
    rejectUnauthorized: false, 
  },
});
