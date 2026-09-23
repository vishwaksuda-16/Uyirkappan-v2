const fs = require('fs');
const path = require('path');

/**
 * Robust CSV parser that handles quotes, escaped quotes, and commas inside fields.
 */
function parseCsv(content) {
  // Strip BOM if present
  const cleanContent = content.replace(/^\uFEFF/, '');
  const lines = cleanContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  function parseLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  }

  const headers = parseLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length !== headers.length) {
      // In case of trailing blank or mismatched columns
      if (values.length === 1 && values[0] === '') continue;
    }
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] !== undefined ? values[index] : '';
    });
    rows.push(row);
  }

  return rows;
}

class DatasetLoader {
  constructor(customDatasetDir = null) {
    this.datasetDir = customDatasetDir || this.resolveDatasetDir();
    this.loaded = false;

    // Collections
    this.hospitals = [];
    this.hospitalCapacity = [];
    this.ambulanceBases = [];
    this.ambulances = [];
    this.drivers = [];
    this.roadNodes = [];
    this.roadSegments = [];
    this.trafficConditions = [];
    this.emergencyRequests = [];
    this.dispatchAssignments = [];
    this.gpsTrajectories = [];
    this.tamilNadu108Evaluation = [];
  }

  resolveDatasetDir() {
    if (process.env.DATASET_DIR && fs.existsSync(process.env.DATASET_DIR)) {
      return process.env.DATASET_DIR;
    }
    const candidates = [
      path.resolve(__dirname, '../../../Datasets/Datasets'),
      path.resolve(__dirname, '../../../../Datasets/Datasets'),
      path.resolve(process.cwd(), 'Datasets/Datasets'),
      path.resolve(process.cwd(), '../Datasets/Datasets'),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand) && fs.existsSync(path.join(cand, 'ambulance_fleet.csv'))) {
        return cand;
      }
    }
    throw new Error(`CRITICAL: Authoritative Datasets folder not found in candidates: ${candidates.join(', ')}`);
  }

  loadFile(filename) {
    const filePath = path.join(this.datasetDir, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`CRITICAL DATASET MISSING: Required file ${filename} not found at ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf8');
  }

  loadAll() {
    if (this.loaded) return this;

    console.log(`[DATA] Loading authoritative datasets from: ${this.datasetDir}`);

    // 1. Healthcare Dispatch & Bases (chennai_healthcare_dispatch_dataset.csv)
    const healthcareRaw = parseCsv(this.loadFile('chennai_healthcare_dispatch_dataset.csv'));
    
    // 2. Hospital Capacity (hospital_capacity.csv)
    const capacityRaw = parseCsv(this.loadFile('hospital_capacity.csv'));
    this.hospitalCapacity = capacityRaw.map(r => ({
      hospitalId: r.hospital_id,
      hospitalName: r.hospital_name,
      icuBedsTotal: parseInt(r.icu_beds_total, 10) || 0,
      icuBedsAvailable: parseInt(r.icu_beds_available, 10) || 0,
      emergencyBedsTotal: parseInt(r.emergency_beds_total, 10) || 0,
      emergencyBedsAvailable: parseInt(r.emergency_beds_available, 10) || 0,
      ventilatorsTotal: parseInt(r.ventilators_total, 10) || 0,
      ventilatorsAvailable: parseInt(r.ventilators_available, 10) || 0,
      traumaCapable: r.trauma_capable.toLowerCase() === 'true',
      cardiacCapable: r.cardiac_capable.toLowerCase() === 'true',
      status: r.status || 'OPERATIONAL',
      updatedAt: r.updated_at ? new Date(r.updated_at) : new Date(),
    }));

    const capacityMap = new Map(this.hospitalCapacity.map(c => [c.hospitalId, c]));

    // Join healthcare dispatch with capacity to produce canonical hospitals & bases
    this.hospitals = [];
    this.ambulanceBases = [];

    for (const entity of healthcareRaw) {
      const lat = parseFloat(entity.latitude);
      const lon = parseFloat(entity.longitude);
      if (isNaN(lat) || isNaN(lon)) {
        throw new Error(`Invalid lat/lon for entity ${entity.id}`);
      }

      if (entity.entity_type === 'Hospital') {
        const cap = capacityMap.get(entity.id) || {
          icuBedsTotal: 10,
          icuBedsAvailable: 4,
          emergencyBedsTotal: 30,
          emergencyBedsAvailable: 15,
          ventilatorsTotal: 5,
          ventilatorsAvailable: 2,
          traumaCapable: true,
          cardiacCapable: true,
          status: 'OPERATIONAL',
          updatedAt: new Date(),
        };

        this.hospitals.push({
          id: entity.id,
          name: entity.name,
          entityType: 'Hospital',
          location: { latitude: lat, longitude: lon },
          area: entity.area,
          sector: entity.sector,
          ownershipOrStatus: entity.ownership_or_status,
          priority: entity.priority,
          coverageAreas: entity.coverage_areas,
          resources: {
            generalBeds: cap.emergencyBedsAvailable,
            icuBeds: cap.icuBedsAvailable,
            ventilators: cap.ventilatorsAvailable,
            totalGeneralBeds: cap.emergencyBedsTotal,
            totalIcuBeds: cap.icuBedsTotal,
            totalVentilators: cap.ventilatorsTotal,
            emergencyBedsTotal: cap.emergencyBedsTotal,
            icuBedsTotal: cap.icuBedsTotal,
            ventilatorsTotal: cap.ventilatorsTotal,
          },
          traumaCapable: cap.traumaCapable,
          cardiacCapable: cap.cardiacCapable,
          operationalStatus: cap.status,
          updatedAt: cap.updatedAt,
        });
      } else if (entity.entity_type === 'Ambulance Base') {
        this.ambulanceBases.push({
          id: entity.id,
          name: entity.name,
          entityType: 'Ambulance Base',
          location: { latitude: lat, longitude: lon },
          area: entity.area,
          sector: entity.sector,
          recommendedAmbulanceCount: parseInt(entity.recommended_ambulance_count, 10) || 2,
          nearestOrReferenceHospital: entity.nearest_or_reference_hospital,
          coverageAreas: entity.coverage_areas,
        });
      }
    }

    // 3. Drivers (drivers.csv)
    const driversRaw = parseCsv(this.loadFile('drivers.csv'));
    this.drivers = driversRaw.map(r => ({
      id: r.driver_id,
      driverId: r.driver_id,
      name: r.name,
      phone: r.phone,
      licenseType: r.license_type,
      yearsExperience: parseInt(r.years_experience, 10) || 1,
      assignedAmbulanceId: r.assigned_ambulance_id,
      assignedBaseId: r.assigned_base_id,
      status: r.status || 'ON_DUTY',
      acceptanceRatePct: parseFloat(r.acceptance_rate_pct) || 100.0,
    }));

    // 4. Ambulance Fleet (ambulance_fleet.csv)
    const fleetRaw = parseCsv(this.loadFile('ambulance_fleet.csv'));
    this.ambulances = fleetRaw.map(r => {
      const lat = parseFloat(r.current_latitude);
      const lon = parseFloat(r.current_longitude);
      if (isNaN(lat) || isNaN(lon)) {
        throw new Error(`Invalid coordinates for ambulance ${r.ambulance_id}`);
      }
      return {
        id: r.ambulance_id,
        ambulanceId: r.ambulance_id,
        baseId: r.base_id,
        baseName: r.base_name,
        area: r.area,
        sector: r.sector,
        vehicleType: r.vehicle_type,
        capacity: parseInt(r.capacity, 10) || 2,
        status: r.status || 'AVAILABLE',
        currentLocation: { latitude: lat, longitude: lon },
        currentSpeed: 0,
        currentHeading: 0,
        driverId: r.driver_id,
        currentRequestId: null,
        capabilities: r.vehicle_type === 'ALS' ? ['ICU', 'VENTILATOR', 'OXYGEN'] : ['OXYGEN', 'BASIC'],
        lastServiced: r.last_serviced,
      };
    });

    // 5. Road Network Nodes (road_network_nodes.csv)
    const nodesRaw = parseCsv(this.loadFile('road_network_nodes.csv'));
    this.roadNodes = nodesRaw.map(r => {
      const lat = parseFloat(r.lat);
      const lon = parseFloat(r.lon);
      if (isNaN(lat) || isNaN(lon)) {
        throw new Error(`Invalid coordinates for road node ${r.node_id}`);
      }
      return {
        nodeId: r.node_id,
        name: r.name,
        type: r.type,
        latitude: lat,
        longitude: lon,
      };
    });

    // 6. Road Network Segments (road_network_segments.csv)
    const segmentsRaw = parseCsv(this.loadFile('road_network_segments.csv'));
    this.roadSegments = segmentsRaw.map(r => ({
      segmentId: r.segment_id,
      startNodeId: r.start_node_id,
      endNodeId: r.end_node_id,
      distanceKm: parseFloat(r.distance_km) || 1.0,
      speedLimitKmph: parseFloat(r.speed_limit_kmph) || 30.0,
      roadType: r.road_type,
      oneWay: r.one_way ? r.one_way.toLowerCase() === 'true' : false,
    }));

    // 7. Traffic Conditions (traffic_conditions.csv)
    const trafficRaw = parseCsv(this.loadFile('traffic_conditions.csv'));
    this.trafficConditions = trafficRaw.map(r => ({
      dayType: r.day_type,
      hourOfDay: parseInt(r.hour_of_day, 10),
      trafficState: r.traffic_state,
      speedMultiplier: parseFloat(r.speed_multiplier) || 1.0,
    }));

    // 8. Emergency Requests (emergency_requests.csv)
    const requestsRaw = parseCsv(this.loadFile('emergency_requests.csv'));
    this.emergencyRequests = requestsRaw.map(r => ({
      requestId: r.request_id,
      timestamp: new Date(r.timestamp),
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      area: r.area,
      sector: r.sector,
      emergencyType: r.emergency_type,
      victimCount: parseInt(r.victim_count, 10) || 1,
      severity: r.severity,
      status: r.status,
    }));

    // 9. Dispatch Assignments (dispatch_assignments.csv)
    const assignmentsRaw = parseCsv(this.loadFile('dispatch_assignments.csv'));
    this.dispatchAssignments = assignmentsRaw.map(r => ({
      assignmentId: r.assignment_id,
      requestId: r.request_id,
      ambulanceId: r.ambulance_id,
      attemptNumber: parseInt(r.attempt_number, 10) || 1,
      assignedAt: new Date(r.assigned_at),
      responseTimeSec: parseInt(r.response_time_sec, 10) || 15,
      response: r.response,
      status: r.status,
    }));

    // 10. Ambulance GPS Trajectories (ambulance_gps_trajectories.csv)
    const trajRaw = parseCsv(this.loadFile('ambulance_gps_trajectories.csv'));
    this.gpsTrajectories = trajRaw.map(r => ({
      timestamp: new Date(r.timestamp),
      ambulanceId: r.ambulance_id,
      requestId: r.request_id,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      speedKmph: parseFloat(r.speed_kmph) || 0,
      headingDeg: parseFloat(r.heading_deg) || 0,
      status: r.status,
    }));

    // 11. Curated, anonymized Tamil Nadu 108 operational cases. These records
    // calibrate and evaluate response-time targets; they are not used as live
    // Chennai dispatch locations because the source contains no coordinates.
    const cases108Raw = parseCsv(this.loadFile('tamil_nadu_108_evaluation.csv'));
    this.tamilNadu108Evaluation = cases108Raw.map(r => ({
      caseId: r.caseId,
      callType: r.callType,
      callerDistrict: r.callerDistrict,
      callerTaluk: r.callerTaluk,
      critical: r.critical === 'Yes',
      triage: r.triage || null,
      vehicleType: r.vehicleType,
      emergencyType: r.emergencyType,
      hospitalType: r.hospitalType,
      area: r.area,
      hour: Number(r.hour),
      baseToSceneKm: Number(r.baseToSceneKm) || 0,
      sceneToHospitalKm: Number(r.sceneToHospitalKm) || 0,
      baseToSceneSeconds: r.baseToSceneSeconds ? Number(r.baseToSceneSeconds) : null,
      sceneToHospitalSeconds: r.sceneToHospitalSeconds ? Number(r.sceneToHospitalSeconds) : null,
      responseSeconds: Number(r.responseSeconds),
      benchmarkSeconds: Number(r.benchmarkSeconds),
      metBenchmark: r.metBenchmark === 'true',
    }));

    this.loaded = true;

    // Log exact dynamic counts
    console.log('\n============================================================');
    console.log('DATASET INITIALIZATION');
    console.log(`Hospitals: ${this.hospitals.length}`);
    console.log(`Ambulance bases: ${this.ambulanceBases.length}`);
    console.log(`Ambulances: ${this.ambulances.length}`);
    console.log(`Drivers: ${this.drivers.length}`);
    console.log(`Road nodes: ${this.roadNodes.length}`);
    console.log(`Road segments: ${this.roadSegments.length}`);
    console.log(`Traffic conditions: ${this.trafficConditions.length}`);
    console.log(`Emergency requests: ${this.emergencyRequests.length}`);
    console.log(`Dispatch assignments: ${this.dispatchAssignments.length}`);
    console.log(`GPS trajectories: ${this.gpsTrajectories.length}`);
    console.log('============================================================\n');

    return this;
  }
}

// Global Singleton Instance
const datasetLoader = new DatasetLoader();

module.exports = {
  DatasetLoader,
  datasetLoader,
};
