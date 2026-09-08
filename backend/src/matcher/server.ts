import http from "http";
import app from "./app.js";
import { Server } from "socket.io";

import { createServiceContainer } from "./config/service-container.js";


const PORT =
  process.env.PORT || 5000;


const httpServer =
  http.createServer(app);


const io =
  new Server(
    httpServer,
    {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    }
  );


/*
 * ============================
 * SERVICE CONTAINER
 * ============================
 */

const services =
  createServiceContainer(io);


/*
 * ============================
 * SIMULATION API
 * ============================
 */

app.post(
  "/api/simulation/start",
  async (req, res) => {

    try {

      const requestId =
        req.body?.requestId ||
        "REQ-E2E-FALLBACK-M5-M6-001";


      if (
        services
          .simulationDemoService
          .isRunning()
      ) {

        return res.status(409).json({

          success: false,

          message:
            "Simulation already running"

        });

      }


      /*
       * Start asynchronously.
       */

      services
        .simulationDemoService
        .start(requestId)
        .catch(
          error => {

            console.error(
              "Simulation failed:",
              error
            );

          }
        );


      return res.json({

        success: true,

        message:
          "Simulation started",

        requestId

      });

    }
    catch (error) {

      console.error(
        "Failed to start simulation:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "Failed to start simulation"

      });

    }

  }
);


app.post(
  "/api/simulation/stop",
  (_req, res) => {

    services
      .simulationDemoService
      .stop();


    return res.json({

      success: true,

      message:
        "Simulation stop requested"

    });

  }
);


/*
 * ============================
 * SOCKET CONNECTION
 * ============================
 */

io.on(
  "connection",
  socket => {

    console.log(
      `Socket connected: ${socket.id}`
    );


    socket.on(
      "join-emergency",
      (requestId: string) => {

        const room =
          `emergency:${requestId}`;


        socket.join(room);


        console.log(
          `Socket ${socket.id} joined ${room}`
        );


        socket.emit(
          "joined-emergency",
          {
            requestId,
            room
          }
        );

      }
    );


    socket.on(
      "disconnect",
      () => {

        console.log(
          `Socket disconnected: ${socket.id}`
        );

      }
    );

  }
);


/*
 * ============================
 * SERVER START
 * ============================
 */

httpServer.listen(
  PORT,
  () => {

    console.log(
      `UyirKappan backend running on port ${PORT}`
    );


    console.log(
      "Socket.IO real-time server ready"
    );


    console.log(
      "Module 5/6 services initialized"
    );

  }
);


export {
  io,
  services
};