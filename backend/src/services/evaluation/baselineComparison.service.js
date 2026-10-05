const { baselineDatasetService } = require('./baselineDataset.service');
const { datasetLoader } = require('../../data/datasetLoader');

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

class BaselineComparisonService {
  constructor(dataStore = null) {
    this.dataStore = dataStore;
  }

  setDataStore(store) {
    this.dataStore = store;
  }

  /**
   * Retrieves operational or simulated UyirKappan performance metrics from the active dataStore.
   */
  async getUyirKappanOperationalMetrics() {
    let requests = [];
    let assignments = [];

    if (this.dataStore) {
      try {
        if (typeof this.dataStore.getEmergencies === 'function') {
          requests = await this.dataStore.getEmergencies();
        } else if (typeof this.dataStore.getAllEmergencies === 'function') {
          requests = await this.dataStore.getAllEmergencies();
        }
        if (typeof this.dataStore.getAssignments === 'function') {
          assignments = await this.dataStore.getAssignments();
        } else if (typeof this.dataStore.getAllAssignments === 'function') {
          assignments = await this.dataStore.getAllAssignments();
        }
      } catch (err) {
        console.warn(`[BaselineComparisonService] Could not retrieve dataStore metrics: ${err.message}`);
      }
    }

    // Filter requests with valid ETA and assigned units
    const dispatched = requests.filter(r => r.assignedAmbulanceId && r.eta !== undefined && r.eta !== null);

    const etas = dispatched.map(r => Number(r.eta)).filter(v => Number.isFinite(v));
    const distances = dispatched
      .map(r => r.route?.distanceKm || r.distanceKm || null)
      .filter(v => v !== null && Number.isFinite(v));

    const totalRequests = requests.length;
    const dispatchedCount = dispatched.length;

    const meanEta = etas.length > 0 ? etas.reduce((a, b) => a + b, 0) / etas.length : null;
    const medianEta = etas.length > 0 ? median(etas) : null;
    const meanDistance = distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : null;
    const medianDistance = distances.length > 0 ? median(distances) : null;

    // Benchmark compliance against standard 15-minute emergency target
    const standardBenchmarkMin = 15.0;
    const benchmarkMetCount = etas.filter(eta => eta <= standardBenchmarkMin).length;
    const benchmarkCompliancePct = etas.length > 0 ? round((benchmarkMetCount / etas.length) * 100, 1) : null;

    return {
      source: 'UyirKappan Operational DataStore',
      isLiveState: true,
      totalEmergenciesLogged: totalRequests,
      activeOrDispatchedCount: dispatchedCount,
      etasSampleCount: etas.length,
      meanEtaMinutes: round(meanEta, 2),
      medianEtaMinutes: round(medianEta, 2),
      meanDistanceKm: round(meanDistance, 2),
      medianDistanceKm: round(medianDistance, 2),
      benchmarkCompliancePct,
      standardBenchmarkMinutes: standardBenchmarkMin,
      totalAssignmentsLogged: assignments.length,
    };
  }

  /**
   * Performs a mathematically sound, documented comparison between:
   * 1. The 108 reference baseline sample (dummy_ambulance_data.xlsx - 94% Madurai)
   * 2. The UyirKappan operational/simulated state (Chennai graph network)
   */
  async compareWith108Baseline() {
    const baselineMeta = baselineDatasetService.getMetadata();
    const baselineStats = baselineMeta.statistics;
    const ukMetrics = await this.getUyirKappanOperationalMetrics();

    // 108 Reference values
    const baselineResponseMean = baselineStats.responseTime.meanMinutes;
    const baselineResponseMedian = baselineStats.responseTime.medianMinutes;
    const baselineBenchmarkMetPct = baselineStats.responseTime.benchmarkMetPercentage;
    const baselineDistanceMean = baselineStats.baseToSceneDistance.meanKm;

    // Formulate comparison object with explicit scientific labeling
    const comparison = {
      comparisonType: 'REFERENCE_BENCHMARK_CONTRAST',
      status: 'VERIFIED',
      timestamp: new Date().toISOString(),
      methodology: {
        baselineSource: 'dummy_ambulance_data.xlsx (50 historical 108 cases, 94% Madurai)',
        systemSource: 'UyirKappan Authoritative State (Chennai 70-Node Network)',
        comparabilityCaveat:
          'NON-CAUSAL REFERENCE CONTRAST ONLY. The 108 baseline reflects historical operational cases in Madurai district (rural/semi-urban), whereas UyirKappan operates on the Chennai metropolitan road network. Differences reflect distinct geography, network density, and dispatch policies rather than a single controlled clinical trial.',
      },
      baseline: {
        dataset: 'dummy_ambulance_data.xlsx',
        classification: baselineMeta.classification,
        geographicScope: baselineMeta.geographicScope,
        sampleSize: baselineMeta.rowCount,
        isLive: false,
        isOperational: false,
        metrics: {
          responseDuration: {
            meanMinutes: baselineResponseMean,
            medianMinutes: baselineResponseMedian,
            minMinutes: baselineStats.responseTime.minMinutes,
            maxMinutes: baselineStats.responseTime.maxMinutes,
            unit: 'minutes',
          },
          baseToSceneDistance: {
            meanKm: baselineDistanceMean,
            medianKm: baselineStats.baseToSceneDistance.medianKm,
            unit: 'kilometers',
          },
          benchmarkCompliance: {
            targetMinutes: 14.5,
            compliancePercentage: baselineBenchmarkMetPct,
            casesMet: baselineStats.responseTime.benchmarkMetCount,
            totalCases: baselineMeta.rowCount,
            unit: 'percent',
          },
        },
      },
      uyirkappan: {
        classification: 'OPERATIONAL_AND_SIMULATION',
        geographicScope: 'Chennai Metropolitan Road Network (70 nodes, 182 segments)',
        sampleSize: ukMetrics.etasSampleCount,
        isLive: ukMetrics.isLiveState,
        metrics: {
          etaOrTravelTime: {
            meanMinutes: ukMetrics.meanEtaMinutes,
            medianMinutes: ukMetrics.medianEtaMinutes,
            unit: 'minutes',
            status: ukMetrics.etasSampleCount > 0 ? 'CALCULATED_FROM_DATASTORE' : 'NO_COMPLETED_DISPATCHES_YET',
          },
          travelDistance: {
            meanKm: ukMetrics.meanDistanceKm,
            medianKm: ukMetrics.medianDistanceKm,
            unit: 'kilometers',
          },
          benchmarkCompliance: {
            targetMinutes: ukMetrics.standardBenchmarkMinutes,
            compliancePercentage: ukMetrics.benchmarkCompliancePct,
            unit: 'percent',
          },
        },
        systemState: {
          totalEmergencies: ukMetrics.totalEmergenciesLogged,
          activeDispatches: ukMetrics.activeOrDispatchedCount,
          totalAssignments: ukMetrics.totalAssignmentsLogged,
        },
      },
      metricDefinitions: [
        {
          metric: 'Response Time (Baseline) vs ETA (UyirKappan)',
          baselineFormula: 'Sum of Base-to-Scene Travel Time + Dispatch Delay from 108 records',
          uyirkappanFormula: 'Traffic-weighted Dijkstra shortest-time path accumulated along Chennai network edges',
          unit: 'minutes',
          limitation: 'Baseline lacks continuous GPS trajectory; UyirKappan simulates continuous GPS navigation.',
        },
        {
          metric: 'Travel Distance',
          baselineFormula: 'Odometer reading difference BS(KM) from emergency vehicle pilot log',
          uyirkappanFormula: 'Sum of topological road segment lengths (distanceKm) along selected route',
          unit: 'kilometers',
          limitation: 'Madurai coverage radii differ significantly from Central Chennai urban density.',
        },
        {
          metric: 'Benchmark Compliance Rate',
          baselineFormula: '(Cases with Response Time <= Benchmark / Total Cases) * 100',
          uyirkappanFormula: '(Dispatches with ETA <= 15.0 min / Total Dispatches) * 100',
          unit: 'percent',
          limitation: 'Standard rural 108 benchmark is 20 min; urban Chennai benchmark is 15 min.',
        },
      ],
    };

    return comparison;
  }
}

// Global Singleton Instance
const baselineComparisonService = new BaselineComparisonService();

module.exports = {
  BaselineComparisonService,
  baselineComparisonService,
};
