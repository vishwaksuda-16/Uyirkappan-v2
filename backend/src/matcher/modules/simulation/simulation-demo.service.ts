import {
  EmergencyRequest,
  Ambulance
} from "../dispatch/dispatch.types.js";

import { Location } from "../dispatch/dispatch.types.js";

export class SimulationDemoService {

  private running = false;

  constructor(
    private readonly services: any
  ) {}

  async start(requestId: string): Promise<void> {

    if (this.running) {
      throw new Error(
        "Simulation is already running"
      );
    }

    this.running = true;

    try {

      /*
       * ========================================
       * 1. CREATE EMERGENCY
       * ========================================
       */

      const request: EmergencyRequest = {

        requestId,

        emergencyType:
          "ROAD_ACCIDENT",

        victimCount: 1,

        pickupLocation: {
          latitude: 13.0800,
          longitude: 80.2780
        },

        createdAt: new Date(),

        priority: "CRITICAL"

      };


      /*
       * ========================================
       * 2. VIRTUAL AMBULANCES
       * ========================================
       */

      const ambulances: Ambulance[] = [

        {
          ambulanceId: "A1",

          currentLocation: {
            latitude: 13.0827,
            longitude: 80.2707
          },

          availabilityStatus:
            "AVAILABLE",

          driverId: "D1",

          capabilities: [
            "BASIC_LIFE_SUPPORT"
          ]
        },

        {
          ambulanceId: "A2",

          currentLocation: {
            latitude: 13.0850,
            longitude: 80.2750
          },

          availabilityStatus:
            "AVAILABLE",

          driverId: "D2",

          capabilities: [
            "ADVANCED_LIFE_SUPPORT"
          ]
        },

        {
          ambulanceId: "A3",

          currentLocation: {
            latitude: 13.0880,
            longitude: 80.2800
          },

          availabilityStatus:
            "AVAILABLE",

          driverId: "D3",

          capabilities: [
            "BASIC_LIFE_SUPPORT"
          ]
        }

      ];


      /*
       * ========================================
       * 3. MODULE 5 DISPATCH
       * ========================================
       */

      const assignment =
        this.services
          .fallbackOrchestratorService
          .dispatchWithFallback(
            request,
            ambulances,
            10
          );

      console.log(
        "SIMULATION: Initial assignment",
        assignment
      );


      await this.delay(1000);


      /*
       * ========================================
       * 4. ACCEPT INITIAL AMBULANCE
       * ========================================
       */

      this.services
        .fallbackOrchestratorService
        .acceptAssignment(
          requestId,
          assignment.ambulanceId
        );


      await this.delay(1500);


      /*
       * ========================================
       * 5. SIMULATE FAILURE
       * ========================================
       */

      const failedAmbulance =
        assignment.ambulanceId;


      const fallbackAssignment =
        this.services
          .fallbackOrchestratorService
          .handleFailureAndFallback(
            request,
            ambulances,
            10,
            failedAmbulance,
            "REJECTED",
            "Driver rejected emergency"
          );


      console.log(
        "SIMULATION: Fallback assignment",
        fallbackAssignment
      );


      await this.delay(1500);


      /*
       * ========================================
       * 6. ACCEPT FALLBACK AMBULANCE
       * ========================================
       */

      this.services
        .fallbackOrchestratorService
        .acceptAssignment(
          requestId,
          fallbackAssignment.ambulanceId
        );


      await this.delay(1000);


      /*
       * ========================================
       * 7. FIND FALLBACK AMBULANCE
       * ========================================
       */

      const ambulance =
        ambulances.find(
          a =>
            a.ambulanceId ===
            fallbackAssignment.ambulanceId
        );


      if (!ambulance) {

        throw new Error(
          "Fallback ambulance not found"
        );

      }


      /*
       * ========================================
       * 8. INITIAL LOCATION
       * ========================================
       */

      const initialLocation = {

        ambulanceId:
          ambulance.ambulanceId,

        requestId,

        latitude:
          ambulance.currentLocation.latitude,

        longitude:
          ambulance.currentLocation.longitude,

        speed: 0,

        heading: 0,

        timestamp: new Date()

      };


      const destination =
        request.pickupLocation;


      /*
       * ========================================
       * 9. INITIALIZE TRACKING
       * ========================================
       */

      await this.services
        .liveTrackingOrchestratorService
        .processLocationUpdate(
          initialLocation,
          destination
        );


      this.services
        .liveTrackingOrchestratorService
        .startJourney(
          requestId
        );


      await this.delay(1000);


      /*
       * ========================================
       * 10. VIRTUAL AMBULANCE MOVEMENT
       * ========================================
       */

      await this.services
        .virtualMovementService
        .moveAlongRoute(
          ambulance.ambulanceId,
          requestId,
          fallbackAssignment.route,
          destination,
          {

            onLocationUpdate:
              async (
                locationUpdate: any,
                destination: Location
              ) => {

                await this.services
                  .liveTrackingOrchestratorService
                  .processLocationUpdate(
                    locationUpdate,
                    destination
                  );

              }

          }
        );


      /*
       * ========================================
       * 11. PATIENT ONBOARD
       * ========================================
       */

      this.services
        .liveTrackingOrchestratorService
        .patientOnboarded(
          requestId
        );


      await this.delay(1500);


      /*
       * ========================================
       * 12. HOSPITAL JOURNEY
       * ========================================
       */

      this.services
        .liveTrackingOrchestratorService
        .startHospitalJourney(
          requestId
        );


      await this.delay(1500);


      /*
       * ========================================
       * 13. HOSPITAL ARRIVAL
       * ========================================
       */

      this.services
        .liveTrackingOrchestratorService
        .hospitalArrived(
          requestId
        );


      await this.delay(1500);


      /*
       * ========================================
       * 14. COMPLETION
       * ========================================
       */

      this.services
        .liveTrackingOrchestratorService
        .completeEmergency(
          requestId
        );


      console.log(
        "SIMULATION COMPLETED:",
        requestId
      );

    }
    finally {

      this.running = false;

    }

  }


  stop(): void {

    /*
     * VirtualMovementService currently
     * has no cancellation API.
     *
     * This method is kept for future
     * cancellation support.
     */

    this.running = false;

  }


  isRunning(): boolean {

    return this.running;

  }


  private delay(
    milliseconds: number
  ): Promise<void> {

    return new Promise(
      resolve =>
        setTimeout(
          resolve,
          milliseconds
        )
    );

  }

}