# UyirKappan Backend — In-Memory Prototype

A single central backend coordinating the Bystander App, Driver/Ambulance App, and
Hospital Dashboard. Uses **in-memory data storage** and **mock dispatch/ETA stubs** so
the complete end-to-end flow runs immediately — no MongoDB or Google Maps required.
The architecture is modular so real MongoDB and the Intelligent Dispatch Engine can be
plugged in later without rewriting controllers or routes.

## Tech stack
- Node.js + Express
- Socket.IO (real-time)
- JWT auth + bcrypt
- In-memory data store (mock repository)
- Mock DispatchService + EtaService stubs

## Setup
```bash
npm install
cp .env.example .env   # optional; sensible defaults are built in
npm run dev            # starts server on http://localhost:5000

npm run simulate          # driver-1 rejects, driver-2 accepts, live tracking, ETA, completion
npm run simulate-ambulance -- ambulance=AMB-01 mode=accept
npm run simulate-ambulance -- ambulance=AMB-01 mode=reject
npm run simulate-ambulance -- ambulance=AMB-01 mode=timeout
npm run simulate-emergencies 5