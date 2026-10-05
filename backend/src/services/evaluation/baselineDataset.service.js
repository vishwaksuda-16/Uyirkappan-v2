const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

/**
 * Expected core columns in the 108 baseline workbook.
 */
const EXPECTED_COLUMNS = [
  'Case_ID',
  'Emergency / IFT',
  'Caller District',
  'Caller Taluk',
  'is_critical',
  'Vehicle Type',
  'Emergency Type',
  'Hospital_Type',
  'BS(KM)',
  'BS (hms)',
  'Response Time',
  'Bench Mark',
  'RTNM',
];

/**
 * Parses time cell values (which may be fractional Excel day numbers, 'HH:MM:SS' strings, or Date objects)
 * into integer seconds. Returns null if unparseable or blank.
 */
function parseTimeToSeconds(val) {
  if (val === null || val === undefined || val === '') return null;

  // Numeric: Excel stores time as fractional days (e.g. 0.5 = 12:00:00 = 43200 seconds)
  if (typeof val === 'number') {
    if (isNaN(val)) return null;
    return Math.round(val * 86400);
  }

  // Date object:
  if (val instanceof Date) {
    return val.getUTCHours() * 3600 + val.getUTCMinutes() * 60 + val.getUTCSeconds();
  }

  // String format: 'H:MM:SS' or 'HH:MM:SS'
  const str = String(val).trim();
  const parts = str.split(':');
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = Math.round(parseFloat(parts[2]));
    if (!isNaN(h) && !isNaN(m) && !isNaN(s)) {
      return h * 3600 + m * 60 + s;
    }
  }
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = Math.round(parseFloat(parts[1]));
    if (!isNaN(m) && !isNaN(s)) {
      return m * 60 + s;
    }
  }

  return null;
}

function round(val, decimals = 2) {
  if (typeof val !== 'number' || isNaN(val)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

function median(arr) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

class BaselineDatasetService {
  constructor(customPath = null) {
    this.customPath = customPath;
    this.loaded = false;
    this.filePath = null;
    this.metadata = null;
    this.records = [];
    this.recordsById = new Map();
  }

  /**
   * Resolves the canonical workbook path without permitting arbitrary unsafe paths.
   */
  resolveWorkbookPath() {
    if (this.customPath) {
      if (fs.existsSync(this.customPath)) {
        return path.resolve(this.customPath);
      }
      throw new Error(`CRITICAL: Baseline workbook not found at specified path: ${this.customPath}`);
    }
    if (process.env.BASELINE_DATASET_PATH && fs.existsSync(process.env.BASELINE_DATASET_PATH)) {
      return path.resolve(process.env.BASELINE_DATASET_PATH);
    }

    const candidatePaths = [
      path.resolve(__dirname, '../../../../dummy_ambulance_data.xlsx'), // from backend/src/services/evaluation/ -> root
      path.resolve(process.cwd(), 'dummy_ambulance_data.xlsx'),
      path.resolve(process.cwd(), '../dummy_ambulance_data.xlsx'),
      path.resolve(process.cwd(), '../../dummy_ambulance_data.xlsx'),
      path.resolve(__dirname, '../../../dummy_ambulance_data.xlsx'),
    ];

    for (const cand of candidatePaths) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }

    throw new Error(
      `CRITICAL: Baseline workbook dummy_ambulance_data.xlsx not found in candidate paths: ${candidatePaths.join(', ')}`
    );
  }

  /**
   * Loads and validates the workbook.
   */
  load() {
    if (this.loaded) return this;

    this.filePath = this.resolveWorkbookPath();

    let workbook;
    try {
      workbook = xlsx.readFile(this.filePath, { cellDates: false });
    } catch (err) {
      throw new Error(`Failed to parse baseline Excel workbook at ${this.filePath}: ${err.message}`);
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error(`Baseline Excel workbook at ${this.filePath} contains no sheets.`);
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Read rows with raw values so we can accurately convert time fractions
    const rawRows = xlsx.utils.sheet_to_json(worksheet, { raw: true, defval: null });
    // Also read formatted to assist with text/time strings if needed
    const formattedRows = xlsx.utils.sheet_to_json(worksheet, { raw: false, defval: '' });

    if (rawRows.length === 0) {
      throw new Error(`Baseline sheet '${sheetName}' in ${this.filePath} is empty.`);
    }

    // Validate expected columns
    const firstRowKeys = Object.keys(rawRows[0]);
    const missingColumns = EXPECTED_COLUMNS.filter(col => !firstRowKeys.includes(col));
    if (missingColumns.length > 0) {
      throw new Error(
        `Baseline workbook validation failed: Missing expected columns: [${missingColumns.join(', ')}]. Found: [${firstRowKeys.slice(0, 10).join(', ')}...]`
      );
    }

    const normalizedRecords = [];
    const districtCounts = {};
    const talukCounts = {};
    const vehicleTypeCounts = {};
    const triageCounts = {};
    const emergencyTypeCounts = {};

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const fmt = formattedRows[i] || {};

      const caseId = String(raw['Case_ID'] || fmt['Case_ID'] || `CASE-${i + 1}`).trim();
      const district = String(raw['Caller District'] || fmt['Caller District'] || 'Unknown').trim();
      const taluk = String(raw['Caller Taluk'] || fmt['Caller Taluk'] || 'Unknown').trim();
      const vehicleType = String(raw['Vehicle Type'] || fmt['Vehicle Type'] || 'BLS').trim();
      const emType = String(raw['Emergency Type - New'] || raw['Emergency Type'] || fmt['Emergency Type'] || 'General').trim();
      const rawTriage = raw['triage'] ? String(raw['triage']).trim() : null;

      districtCounts[district] = (districtCounts[district] || 0) + 1;
      talukCounts[taluk] = (talukCounts[taluk] || 0) + 1;
      vehicleTypeCounts[vehicleType] = (vehicleTypeCounts[vehicleType] || 0) + 1;
      if (rawTriage) {
        triageCounts[rawTriage] = (triageCounts[rawTriage] || 0) + 1;
      }
      emergencyTypeCounts[emType] = (emergencyTypeCounts[emType] || 0) + 1;

      // Durations in seconds
      const responseSeconds = parseTimeToSeconds(raw['Response Time']) ?? parseTimeToSeconds(fmt['Response Time']);
      const benchmarkSeconds = parseTimeToSeconds(raw['Bench Mark']) ?? parseTimeToSeconds(fmt['Bench Mark']);
      const baseToSceneSeconds = parseTimeToSeconds(raw['BS (hms)']) ?? parseTimeToSeconds(fmt['BS (hms)']);
      const sceneSeconds = parseTimeToSeconds(raw['Scene(hms)']) ?? parseTimeToSeconds(fmt['Scene(hms)']);
      const sceneToHospitalSeconds = parseTimeToSeconds(raw['SH(hms)']) ?? parseTimeToSeconds(fmt['SH(hms)']);
      const hospitalSeconds = parseTimeToSeconds(raw['Hospital(hms)']) ?? parseTimeToSeconds(fmt['Hospital(hms)']);

      // Distances in km
      const baseToSceneKm = typeof raw['BS(KM)'] === 'number' ? raw['BS(KM)'] : parseFloat(fmt['BS(KM)']) || 0;
      const sceneToHospitalKm = typeof raw['SH(KM)'] === 'number' ? raw['SH(KM)'] : (fmt['SH(KM)'] ? parseFloat(fmt['SH(KM)']) : null);
      const hospitalToBaseKm = typeof raw['HB(KM)'] === 'number' ? raw['HB(KM)'] : (fmt['HB(KM)'] ? parseFloat(fmt['HB(KM)']) : null);
      const totalKm = typeof raw['B2B(KM)'] === 'number' ? raw['B2B(KM)'] : (fmt['B2B(KM)'] ? parseFloat(fmt['B2B(KM)']) : null);

      // Benchmark compliance
      const rtnmRaw = String(raw['RTNM'] || fmt['RTNM'] || '').trim().toUpperCase();
      let metBenchmark = null;
      if (rtnmRaw === 'RTM') metBenchmark = true;
      else if (rtnmRaw === 'RTNM') metBenchmark = false;
      else if (responseSeconds !== null && benchmarkSeconds !== null) {
        metBenchmark = responseSeconds <= benchmarkSeconds;
      }

      const record = Object.freeze({
        caseId,
        callType: String(raw['Emergency / IFT'] || fmt['Emergency / IFT'] || 'EMERGENCY').trim(),
        callerDistrict: district,
        callerTaluk: taluk,
        area: String(raw['Area'] || fmt['Area'] || 'Urban').trim(),
        vehicleType,
        emergencyType: emType,
        hospitalType: String(raw['Hospital_Type'] || fmt['Hospital_Type'] || 'Government').trim(),
        admissionHospital: String(raw['Admission Hospital Name'] || fmt['Admission Hospital Name'] || 'HOSP_A').trim(),
        isCritical: String(raw['is_critical'] || '').toLowerCase() === 'yes',
        triage: rawTriage,
        baseToSceneKm: round(baseToSceneKm, 1),
        sceneToHospitalKm: sceneToHospitalKm !== null ? round(sceneToHospitalKm, 1) : null,
        hospitalToBaseKm: hospitalToBaseKm !== null ? round(hospitalToBaseKm, 1) : null,
        totalKm: totalKm !== null ? round(totalKm, 1) : null,
        baseToSceneSeconds,
        baseToSceneMinutes: baseToSceneSeconds !== null ? round(baseToSceneSeconds / 60, 2) : null,
        sceneDurationSeconds: sceneSeconds,
        sceneDurationMinutes: sceneSeconds !== null ? round(sceneSeconds / 60, 2) : null,
        sceneToHospitalSeconds,
        sceneToHospitalMinutes: sceneToHospitalSeconds !== null ? round(sceneToHospitalSeconds / 60, 2) : null,
        hospitalSeconds,
        hospitalMinutes: hospitalSeconds !== null ? round(hospitalSeconds / 60, 2) : null,
        responseSeconds,
        responseMinutes: responseSeconds !== null ? round(responseSeconds / 60, 2) : null,
        benchmarkSeconds,
        benchmarkMinutes: benchmarkSeconds !== null ? round(benchmarkSeconds / 60, 2) : null,
        metBenchmark,
        hour: typeof raw['Hour'] === 'number' ? raw['Hour'] : parseInt(fmt['Hour'], 10) || 0,
      });

      normalizedRecords.push(record);
      this.recordsById.set(caseId, record);
    }

    this.records = Object.freeze(normalizedRecords);

    // Compute comprehensive statistical metadata
    const validResponseTimes = this.records.map(r => r.responseMinutes).filter(v => v !== null && !isNaN(v));
    const validBSDurations = this.records.map(r => r.baseToSceneMinutes).filter(v => v !== null && !isNaN(v));
    const validBSDistances = this.records.map(r => r.baseToSceneKm).filter(v => v !== null && !isNaN(v));
    const benchmarkMetCount = this.records.filter(r => r.metBenchmark === true).length;

    const meanResponse = validResponseTimes.reduce((acc, v) => acc + v, 0) / Math.max(validResponseTimes.length, 1);
    const medianResponse = median(validResponseTimes);

    const meanBS = validBSDurations.reduce((acc, v) => acc + v, 0) / Math.max(validBSDurations.length, 1);
    const medianBS = median(validBSDurations);

    const meanDist = validBSDistances.reduce((acc, v) => acc + v, 0) / Math.max(validBSDistances.length, 1);
    const medianDist = median(validBSDistances);

    this.metadata = Object.freeze({
      source: 'dummy_ambulance_data.xlsx',
      filename: path.basename(this.filePath),
      sheetName,
      classification: 'REFERENCE_BASELINE',
      isOperational: false,
      isLive: false,
      isSimulation: false,
      hasCoordinates: false,
      geographicScope: 'Tamil Nadu Historical Sample (94% Madurai, 2% Nilgiris, 2% Pudukottai, 2% Thiruvannamalai)',
      primaryDistrict: 'Madurai',
      rowCount: this.records.length,
      districts: districtCounts,
      taluks: talukCounts,
      vehicleTypes: vehicleTypeCounts,
      triageLevels: triageCounts,
      emergencyTypes: emergencyTypeCounts,
      statistics: {
        responseTime: {
          sampleCount: validResponseTimes.length,
          meanMinutes: round(meanResponse, 2),
          medianMinutes: round(medianResponse, 2),
          minMinutes: round(Math.min(...validResponseTimes), 2),
          maxMinutes: round(Math.max(...validResponseTimes), 2),
          benchmarkMetCount,
          benchmarkMetPercentage: round((benchmarkMetCount / Math.max(this.records.length, 1)) * 100, 1),
        },
        baseToSceneTravelTime: {
          sampleCount: validBSDurations.length,
          meanMinutes: round(meanBS, 2),
          medianMinutes: round(medianBS, 2),
        },
        baseToSceneDistance: {
          sampleCount: validBSDistances.length,
          meanKm: round(meanDist, 2),
          medianKm: round(medianDist, 2),
        },
      },
      intendedUse: 'Reference baseline for 108 emergency service response times and benchmark compliance. NOT TO BE USED AS OPERATIONAL AMBULANCE FLEET OR CHENNAI ROUTING DATA.',
    });

    this.loaded = true;
    return this;
  }

  getMetadata() {
    this.load();
    return this.metadata;
  }

  getRecords(filter = {}) {
    this.load();
    let res = this.records;
    if (filter.district) {
      const d = String(filter.district).toLowerCase();
      res = res.filter(r => r.callerDistrict.toLowerCase() === d);
    }
    if (filter.vehicleType) {
      const v = String(filter.vehicleType).toLowerCase();
      res = res.filter(r => r.vehicleType.toLowerCase() === v);
    }
    if (filter.metBenchmark !== undefined) {
      const mb = filter.metBenchmark === 'true' || filter.metBenchmark === true;
      res = res.filter(r => r.metBenchmark === mb);
    }
    return res;
  }

  getRecordById(caseId) {
    this.load();
    return this.recordsById.get(String(caseId).trim()) || null;
  }

  getSummaryStatistics() {
    this.load();
    return this.metadata.statistics;
  }
}

// Global Singleton Instance
const baselineDatasetService = new BaselineDatasetService();

module.exports = {
  BaselineDatasetService,
  baselineDatasetService,
  EXPECTED_COLUMNS,
  parseTimeToSeconds,
};
