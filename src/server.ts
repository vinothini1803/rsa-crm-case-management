import express from "express";
import morgan from "morgan";
import sequelize from "./database/connection";
import caseRoutes from "./routes/cases";
import buddyAppRoutes from "./routes/buddyApp";
import passport from "passport";
import compression from "compression";
import bodyParser from "body-parser";
import fs from "fs";
import http from "http";
import path from "path";
import cors from "cors";
import cron from "node-cron";

class AppService {
  public dbBootstraped = false;
  public esMigrated = false;
  public app: any;
  public port: any;
  public env: any;
  public server: any;

  constructor() {
    this.app = express();
    this.port = process.env.PORT;
    this.env = process.env.NODE_ENV;
    this.initializeApp();
  }

  public initializeApp() {
    this.app.use(cors({ origin: "*" }));
    // this.app.use(cors({ origin: process.env.ORIGIN }));
    this.app.use(morgan("dev"));
    this.app.use(express.json({ limit: "200mb" }));
    this.app.use(bodyParser.json({ limit: "200mb" }));
    this.app.use(
      bodyParser.urlencoded({
        limit: "200mb",
        extended: true,
        parameterLimit: 50000,
      })
    );
    this.app.use(process.env.SERVICE_POINT, caseRoutes);
    this.app.use(`${process.env.SERVICE_POINT}/buddyApp`, buddyAppRoutes);
  }

  public async initDB() {
    try {
      //Relation function
      // sequelize
      //   .sync()
      //   .then((data: any) => {
      //     this.dbBootstraped = true;
      //     console.log("connected to database");
      //   })
      //   .catch((err: any) => console.log(err));
    } catch (e: any) {
      console.log({
        message: e.message,
        stack: e.stack,
      });
      console.log("Error bootstraping the database.");
      this.app.set("HEALTH_STATUS", "DB_MIGRATION_FAILED");
      return Promise.reject(e);
    }
  }

  public init() {
    console.log("Initializing backend-app");
    const { PORT, NODE_ENV } = process.env;

    // ENV Argument Checks
    if (!PORT || !NODE_ENV) {
      const msg =
        "Configuration Error: you must specify these ENV variables: PORT, NODE_ENV";
      console.log(msg);
      throw new Error(msg);
    }

    this.port = PORT;
    this.env = NODE_ENV;
  }

  // eslint-disable-next-line complexity
  public async start() {
    const DOCKER_HOST = "localhost";
    this.server = http.createServer(this.app);

    this.server.listen(this.port, DOCKER_HOST, (err: any) => {
      if (err) {
        this.app.set("HEALTH_STATUS", "SERVER_LISTEN_FAILED");
        throw err;
      }

      console.log(`Server started on http://${DOCKER_HOST}:${this.port}`);
    });

    if (!this.dbBootstraped) {
      await this.initDB();
    }

    this.app.set("HEALTH_STATUS", "READY");
    console.log("Initialization successful. Service is Ready.");

    // Shutdown Hook
    process.on("SIGTERM", () => {
      this.stop();
    });
    process.on("unhandledRejection", (e: any) => {
      console.log({
        message: e.message,
        stack: e.stack,
      });
      console.log("Error due to unhandledRejection.");
    });

    console.log("backend-svc: Server started!");
    return Promise.resolve();
  }

  /**
   * Closes the connection and exits with status code 0 after 3000 ms.
   * Sets HEALTH_STATUS to SHUTTING_DOWN while in progress
   *
   * @memberof Service
   */
  public stop() {
    console.log("Starting graceful shutdown...");
    this.app.set("HEALTH_STATUS", "SHUTTING_DOWN");

    // LoadingDock.readShutdown();

    setTimeout(() => {
      this.app.close(() => {
        console.log("Shutdown Complete.");
        process.exit(0);
      });
    }, 3000);
  }

  public shouldCompress(req: any, res: any) {
    if (req.headers["x-no-compression"]) {
      // don't compress responses with this request header
      return false;
    }
    // fallback to standard filter function
    return compression.filter(req, res);
  }
}

export default AppService;
