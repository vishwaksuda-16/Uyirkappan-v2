const swaggerUi = require('swagger-ui-express');

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'UyirKappan Backend API',
    version: '1.1.0',
    description: 'Central coordinator for Bystander App, Driver/Ambulance App and Hospital Dashboard. Data store: memory or MongoDB (DATA_STORE_MODE). Demo credentials (password123): bystander@uyirkappan.demo, driver1..5@uyirkappan.demo, staff@uyirkappan.demo, admin@uyirkappan.demo.',
  },
  servers: [{ url: 'http://localhost:5000/api', description: 'Local development' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Assignment has already expired' },
        },
      },
      GeoPoint: {
        type: 'object',
        required: ['latitude', 'longitude'],
        properties: {
          latitude: { type: 'number', example: 13.0827 },
          longitude: { type: 'number', example: 80.2707 }
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['name', 'password'],
        properties: {
          name: { type: 'string', example: 'Kumar' },
          phone: { type: 'string', example: '9000000000' },
          email: { type: 'string', format: 'email', example: 'user@uyirkappan.demo' },
          password: { type: 'string', format: 'password', example: 'password123' },
          role: { type: 'string', enum: ['BYSTANDER', 'DRIVER', 'HOSPITAL_STAFF', 'ADMIN'], default: 'BYSTANDER' },
          hospitalId: { type: 'string', example: 'HOSP-01' },
        },
      },
      LoginRequest: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email', example: 'bystander@uyirkappan.demo' },
          phone: { type: 'string', example: '9000000001' },
          password: { type: 'string', format: 'password', example: 'password123' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'USER-001' },
          name: { type: 'string', example: 'Bystander' },
          phone: { type: 'string', example: '9000000001' },
          email: { type: 'string', example: 'bystander@uyirkappan.demo' },
          role: { type: 'string', enum: ['BYSTANDER', 'DRIVER', 'HOSPITAL_STAFF', 'ADMIN'] },
          hospitalId: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          user: { $ref: '#/components/schemas/User' },
        },
      },
      EmergencyCreateRequest: {
        type: 'object',
        required: ['emergencyType', 'victimCount', 'pickupLocation'],
        properties: {
          emergencyType: { type: 'string', example: 'CARDIAC' },
          victimCount: { type: 'integer', minimum: 1, example: 1 },
          pickupLocation: { $ref: '#/components/schemas/GeoPoint' },
        },
      },
      EmergencyRequest: {
        type: 'object',
        properties: {
          requestId: { type: 'string', example: 'UK-2026-000001' },
          emergencyType: { type: 'string', example: 'CARDIAC' },
          victimCount: { type: 'integer', example: 1 },
          pickupLocation: { $ref: '#/components/schemas/GeoPoint' },
          destinationHospitalId: { type: 'string', example: 'HOSP-03' },
          assignedAmbulanceId: { type: 'string', example: 'AMB-01' },
          status: {
            type: 'string',
            enum: ['SEARCHING', 'ASSIGNED', 'DRIVER_ACCEPTED', 'EN_ROUTE_TO_PATIENT',
              'ARRIVED_AT_PATIENT', 'PATIENT_ONBOARD', 'EN_ROUTE_TO_HOSPITAL',
              'ARRIVED_AT_HOSPITAL', 'COMPLETED', 'CANCELLED', 'FALLBACK',
              'NO_AMBULANCE_AVAILABLE']
          },
          eta: { type: 'integer', example: 7 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time', nullable: true },
          attempts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                attemptNumber: { type: 'integer', example: 1 },
                ambulanceId: { type: 'string', example: 'AMB-01' },
                response: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'TIMEOUT'] },
                failureReason: { type: 'string', nullable: true },
                assignedAt: { type: 'string', format: 'date-time' },
                responseAt: { type: 'string', format: 'date-time', nullable: true }
              }
            }
          }
        }
      },
      Ambulance: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'AMB-01' },
          ambulanceNumber: { type: 'string', example: 'TN-01-A-4444' },
          driverId: { type: 'string', example: 'USER-002' },
          currentLocation: { $ref: '#/components/schemas/GeoPoint' },
          status: { type: 'string', enum: ['AVAILABLE', 'ASSIGNED', 'BUSY', 'OFFLINE'] },
          capabilities: { type: 'array', items: { type: 'string' }, example: ['ICU', 'OXYGEN'] },
          currentRequestId: { type: 'string', nullable: true },
        },
      },
      AmbulanceLocation: {
        type: 'object',
        required: ['latitude', 'longitude'],
        properties: {
          latitude: { type: 'number', example: 13.084 },
          longitude: { type: 'number', example: 80.271 },
          speed: { type: 'number', example: 32 },
          heading: { type: 'number', example: 90 },
        },
      },
      StatusUpdate: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', example: 'EN_ROUTE_TO_PATIENT' },
        },
      },
      Assignment: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'ASSIGN-001' },
          requestId: { type: 'string', example: 'UK-2026-000001' },
          ambulanceId: { type: 'string', example: 'AMB-01' },
          attemptNumber: { type: 'integer', example: 1 },
          status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'TIMEOUT', 'CANCELLED', 'COMPLETED'] },
          estimatedETA: { type: 'integer', example: 7 },
          assignedAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: 'string', format: 'date-time' },
          responseAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      Hospital: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'HOSP-01' },
          name: { type: 'string', example: 'Apollo Hospital' },
          location: { $ref: '#/components/schemas/GeoPoint' },
          resources: {
            type: 'object',
            properties: {
              generalBeds: { type: 'integer', example: 20 },
              icuBeds: { type: 'integer', example: 6 },
              ventilators: { type: 'integer', example: 3 },
            },
          },
        },
      },
      ResourceUpdate: {
        type: 'object',
        properties: {
          generalBeds: { type: 'integer', minimum: 0, example: 12 },
          icuBeds: { type: 'integer', minimum: 0, example: 4 },
          ventilators: { type: 'integer', minimum: 0, example: 2 },
        },
      },
      TrackingResponse: {
        type: 'object',
        properties: {
          requestId: { type: 'string', example: 'UK-2026-000001' },
          ambulanceId: { type: 'string', nullable: true, example: 'AMB-01' },
          location: { $ref: '#/components/schemas/GeoPoint' },
          eta: { type: 'integer', nullable: true, example: 7 },
          status: { type: 'string', example: 'EN_ROUTE_TO_PATIENT' },
        },
      },
      HealthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          status: { type: 'string', example: 'UP' },
          message: { type: 'string', example: 'UyirKappan Backend Running' },
          dataStoreMode: { type: 'string', enum: ['memory', 'mongodb'] },
          mongoDb: {
            type: 'object',
            properties: {
              connected: { type: 'boolean' },
              state: { type: 'string' }
            }
          },
          time: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' }
              }
            }
          }
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' }
            }
          }
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' }
              }
            }
          },
          400: {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
          409: {
            description: 'User already exists',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login and receive a JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' }
            }
          }
        },
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' }
              }
            }
          },
          401: {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    user: { $ref: '#/components/schemas/User' }
                  }
                }
              }
            }
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
        },
      },
    },
    '/emergency': {
      post: {
        tags: ['Emergency'],
        summary: 'Create an emergency request (triggers dispatch + assignment)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/EmergencyCreateRequest' }
            }
          }
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    requestId: { type: 'string' },
                    status: { type: 'string' },
                    assignmentId: { type: 'string' },
                    ambulanceId: { type: 'string' },
                    eta: { type: 'integer' }
                  }
                },
                example: {
                  success: true,
                  requestId: 'UK-2026-000001',
                  status: 'ASSIGNED',
                  assignmentId: 'ASSIGN-001',
                  ambulanceId: 'AMB-01',
                  eta: 7
                }
              }
            }
          },
          400: {
            description: 'Invalid payload',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
        },
      },
    },
    '/emergency/{requestId}': {
      get: {
        tags: ['Emergency'],
        summary: 'Get emergency details with attempt history',
        security: [{ bearerAuth: [] }],
        parameters: [{
          in: 'path',
          name: 'requestId',
          required: true,
          schema: { type: 'string' },
          example: 'UK-2026-000001'
        }],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    request: { $ref: '#/components/schemas/EmergencyRequest' }
                  }
                }
              }
            }
          },
          403: {
            description: 'Forbidden',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
          404: {
            description: 'Not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
        },
      },
    },
    '/emergency/{requestId}/cancel': {
      post: {
        tags: ['Emergency'],
        summary: 'Cancel an active emergency (releases ambulance)',
        security: [{ bearerAuth: [] }],
        parameters: [{
          in: 'path',
          name: 'requestId',
          required: true,
          schema: { type: 'string' }
        }],
        responses: {
          200: { description: 'Cancelled' },
          403: { description: 'Forbidden' },
          404: { description: 'Not found' },
          409: { description: 'Cannot cancel in current status' },
        },
      },
    },
    '/emergency/{requestId}/tracking': {
      get: {
        tags: ['Emergency', 'Tracking'],
        summary: 'Current ambulance location, ETA and status',
        security: [{ bearerAuth: [] }],
        parameters: [{
          in: 'path',
          name: 'requestId',
          required: true,
          schema: { type: 'string' }
        }],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    tracking: { $ref: '#/components/schemas/TrackingResponse' }
                  }
                }
              }
            }
          },
          403: { description: 'Forbidden' },
          404: { description: 'Not found' },
        },
      },
    },
    '/driver/assignment': {
      get: {
        tags: ['Driver'],
        summary: 'Get the driver\'s active assignment',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    assignment: { $ref: '#/components/schemas/Assignment' }
                  }
                }
              }
            }
          },
          403: { description: 'Requires DRIVER role' },
        },
      },
    },
    '/ambulances': {
      get: {
        tags: ['Ambulance'],
        summary: 'List all ambulances',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    ambulances: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Ambulance' }
                    }
                  }
                }
              }
            }
          }
        },
      },
    },
    '/ambulances/{ambulanceId}': {
      get: {
        tags: ['Ambulance'],
        summary: 'Get one ambulance',
        security: [{ bearerAuth: [] }],
        parameters: [{
          in: 'path',
          name: 'ambulanceId',
          required: true,
          schema: { type: 'string' },
          example: 'AMB-01'
        }],
        responses: {
          200: { description: 'OK' },
          404: { description: 'Not found' }
        },
      },
    },
    '/ambulances/{ambulanceId}/status': {
      patch: {
        tags: ['Ambulance'],
        summary: 'Update ambulance status (AVAILABLE | ASSIGNED | BUSY | OFFLINE)',
        security: [{ bearerAuth: [] }],
        parameters: [{
          in: 'path',
          name: 'ambulanceId',
          required: true,
          schema: { type: 'string' }
        }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StatusUpdate' }
            }
          }
        },
        responses: {
          200: { description: 'Updated' },
          400: { description: 'Invalid status' },
          403: { description: 'Not your ambulance' },
          404: { description: 'Not found' }
        },
      },
    },
    '/ambulances/{ambulanceId}/location': {
      post: {
        tags: ['Ambulance', 'Tracking'],
        summary: 'Send GPS update; broadcasts AMBULANCE_LOCATION_UPDATED + ETA_UPDATED',
        security: [{ bearerAuth: [] }],
        parameters: [{
          in: 'path',
          name: 'ambulanceId',
          required: true,
          schema: { type: 'string' }
        }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AmbulanceLocation' }
            }
          }
        },
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    ambulance: { $ref: '#/components/schemas/Ambulance' },
                    eta: { type: 'integer', nullable: true }
                  }
                }
              }
            }
          },
          400: { description: 'Invalid coordinates' },
          403: { description: 'Not your ambulance' },
        },
      },
    },
    '/assignments/{assignmentId}': {
      get: {
        tags: ['Assignment'],
        summary: 'Get one assignment',
        security: [{ bearerAuth: [] }],
        parameters: [{
          in: 'path',
          name: 'assignmentId',
          required: true,
          schema: { type: 'string' },
          example: 'ASSIGN-001'
        }],
        responses: {
          200: { description: 'OK' },
          403: { description: 'Forbidden' },
          404: { description: 'Not found' }
        },
      },
    },
    '/assignments/{assignmentId}/accept': {
      post: {
        tags: ['Assignment'],
        summary: 'Accept assignment (PENDING -> ACCEPTED, race-safe)',
        security: [{ bearerAuth: [] }],
        parameters: [{
          in: 'path',
          name: 'assignmentId',
          required: true,
          schema: { type: 'string' }
        }],
        responses: {
          200: {
            description: 'Accepted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    assignmentId: { type: 'string' },
                    requestId: { type: 'string' },
                    eta: { type: 'integer' }
                  }
                }
              }
            }
          },
          409: { description: 'Assignment no longer active (double-accept, timeout already fired)' },
          403: { description: 'Not your assignment' },
          404: { description: 'Not found' },
        },
      },
    },
    '/assignments/{assignmentId}/reject': {
      post: {
        tags: ['Assignment', 'Fallback'],
        summary: 'Reject assignment; triggers cascading fallback on the same requestId',
        security: [{ bearerAuth: [] }],
        parameters: [{
          in: 'path',
          name: 'assignmentId',
          required: true,
          schema: { type: 'string' }
        }],
        responses: {
          200: {
            description: 'Rejected; fallback started',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    assignmentId: { type: 'string' },
                    message: { type: 'string' }
                  }
                }
              }
            }
          },
          409: { description: 'Assignment no longer active' },
          403: { description: 'Not your assignment' },
        },
      },
    },
    '/assignments/{assignmentId}/status': {
      patch: {
        tags: ['Assignment'],
        summary: 'Advance driver lifecycle status one step at a time',
        security: [{ bearerAuth: [] }],
        parameters: [{
          in: 'path',
          name: 'assignmentId',
          required: true,
          schema: { type: 'string' }
        }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StatusUpdate' }
            }
          }
        },
        responses: {
          200: { description: 'Status updated' },
          409: { description: 'Invalid transition (must advance one step; assignment must be ACCEPTED)' },
          403: { description: 'Not your assignment' },
          404: { description: 'Not found' },
        },
      },
    },
    '/hospitals': {
      get: {
        tags: ['Hospital'],
        summary: 'List hospitals',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    hospitals: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Hospital' }
                    }
                  }
                }
              }
            }
          }
        },
      },
    },
    '/hospitals/{hospitalId}': {
      get: {
        tags: ['Hospital'],
        summary: 'Get one hospital',
        security: [{ bearerAuth: [] }],
        parameters: [{
          in: 'path',
          name: 'hospitalId',
          required: true,
          schema: { type: 'string' },
          example: 'HOSP-01'
        }],
        responses: {
          200: { description: 'OK' },
          404: { description: 'Not found' }
        },
      },
    },
    '/hospitals/{hospitalId}/incoming': {
      get: {
        tags: ['Hospital'],
        summary: 'Incoming emergencies for this hospital (active statuses only)',
        security: [{ bearerAuth: [] }],
        parameters: [{
          in: 'path',
          name: 'hospitalId',
          required: true,
          schema: { type: 'string' }
        }],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    incoming: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          requestId: { type: 'string' },
                          emergencyType: { type: 'string' },
                          victimCount: { type: 'integer' },
                          ambulanceId: { type: 'string' },
                          eta: { type: 'integer' },
                          status: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          403: { description: 'Only staff of this hospital or admin' },
        },
      },
    },
    '/hospitals/{hospitalId}/resources': {
      get: {
        tags: ['Hospital'],
        summary: 'Get hospital resources',
        security: [{ bearerAuth: [] }],
        parameters: [{
          in: 'path',
          name: 'hospitalId',
          required: true,
          schema: { type: 'string' }
        }],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    resources: {
                      type: 'object',
                      properties: {
                        generalBeds: { type: 'integer' },
                        icuBeds: { type: 'integer' },
                        ventilators: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          },
          403: { description: 'Forbidden' }
        },
      },
      patch: {
        tags: ['Hospital'],
        summary: 'Update hospital resources',
        security: [{ bearerAuth: [] }],
        parameters: [{
          in: 'path',
          name: 'hospitalId',
          required: true,
          schema: { type: 'string' }
        }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ResourceUpdate' }
            }
          }
        },
        responses: {
          200: {
            description: 'Updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    hospital: { $ref: '#/components/schemas/Hospital' }
                  }
                }
              }
            }
          },
          400: { description: 'Invalid values' },
          403: { description: 'Forbidden' }
        },
      },
    },
    '/hospitals/{hospitalId}/emergency-history': {
      get: {
        tags: ['Hospital'],
        summary: 'History of all emergencies routed to this hospital',
        security: [{ bearerAuth: [] }],
        parameters: [{
          in: 'path',
          name: 'hospitalId',
          required: true,
          schema: { type: 'string' }
        }],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    history: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          requestId: { type: 'string' },
                          emergencyType: { type: 'string' },
                          victimCount: { type: 'integer' },
                          ambulanceId: { type: 'string' },
                          status: { type: 'string' },
                          createdAt: { type: 'string', format: 'date-time' },
                          completedAt: { type: 'string', format: 'date-time', nullable: true }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          403: { description: 'Forbidden' }
        },
      },
    },
  },
};

function setupSwagger(app) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));
}

module.exports = { setupSwagger };