const { Router } = require('express');
const {
  baselineDatasetService,
  baselineComparisonService,
} = require('../services/evaluation');

const round = (value, digits = 1) => {
  if (typeof value !== 'number' || isNaN(value)) return null;
  return Math.round(value * (10 ** digits)) / (10 ** digits);
};

module.exports = function buildEvaluationRoutes(ctx = {}) {
  const router = Router();
  const store = ctx.store || ctx.dataStore || null;
  if (store) {
    baselineComparisonService.setDataStore(store);
  }

  /**
   * GET /api/evaluation/baseline/metadata
   * Returns authoritative metadata about the 108 baseline workbook.
   */
  router.get('/baseline/metadata', (req, res) => {
    try {
      const metadata = baselineDatasetService.getMetadata();
      return res.json({
        success: true,
        metadata,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err.message,
        classification: 'REFERENCE_BASELINE',
        isLive: false,
        isOperational: false,
      });
    }
  });

  /**
   * GET /api/evaluation/baseline
   * Returns normalized read-only baseline records from dummy_ambulance_data.xlsx.
   * Query params: page, limit, district, vehicleType, metBenchmark
   */
  router.get('/baseline', (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const district = req.query.district ? String(req.query.district).trim() : null;
      const vehicleType = req.query.vehicleType ? String(req.query.vehicleType).trim() : null;
      const metBenchmark = req.query.metBenchmark !== undefined ? req.query.metBenchmark : undefined;

      const allRecords = baselineDatasetService.getRecords({ district, vehicleType, metBenchmark });
      const total = allRecords.length;
      const totalPages = Math.ceil(total / limit);
      const start = (page - 1) * limit;
      const paginated = allRecords.slice(start, start + limit);

      return res.json({
        success: true,
        source: 'dummy_ambulance_data.xlsx',
        classification: 'REFERENCE_BASELINE',
        isLive: false,
        isOperational: false,
        total,
        page,
        limit,
        totalPages,
        records: paginated,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  /**
   * GET /api/evaluation/baseline/:caseId
   * Retrieve a single record by Case ID.
   */
  router.get('/baseline/:caseId', (req, res) => {
    try {
      const record = baselineDatasetService.getRecordById(req.params.caseId);
      if (!record) {
        return res.status(404).json({
          success: false,
          message: `Baseline record ${req.params.caseId} not found in workbook.`,
        });
      }
      return res.json({
        success: true,
        source: 'dummy_ambulance_data.xlsx',
        classification: 'REFERENCE_BASELINE',
        record,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  /**
   * GET /api/evaluation/108-summary
   * Statistical summary of the 108 reference sample.
   * Backward-compatible with prior API contract while backed directly by the verified workbook.
   */
  router.get('/108-summary', (req, res) => {
    try {
      const metadata = baselineDatasetService.getMetadata();
      const records = baselineDatasetService.getRecords();

      const responseMinutes = records.map(c => c.responseMinutes).filter(v => v !== null && !isNaN(v));
      const targetReductionPct = Math.min(Math.max(Number(req.query.targetReductionPct) || 10, 1), 30);
      const underBenchmark = records.filter(c => c.metBenchmark === true).length;

      const triageGroups = records.reduce((groups, c) => {
        const key = c.triage || 'Untriaged / IFT';
        (groups[key] ||= []).push(c.responseMinutes);
        return groups;
      }, {});

      const byTriage = Object.entries(triageGroups).map(([triage, values]) => {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const med = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        return {
          triage,
          count: values.length,
          medianResponseMinutes: round(med, 1),
        };
      });

      const medianMinutes = metadata.statistics.responseTime.medianMinutes;
      const meanMinutes = metadata.statistics.responseTime.meanMinutes;

      return res.json({
        source: 'dummy_ambulance_data.xlsx (Tamil Nadu 108 anonymized reference sample)',
        classification: 'REFERENCE_BASELINE',
        isLive: false,
        isOperational: false,
        geographicScope: metadata.geographicScope,
        geographicLimitation: 'No GPS coordinates supplied: suitable for response-time reference calibration, not Chennai map routing.',
        caseCount: records.length,
        districts: metadata.districts,
        responseTime: {
          meanMinutes: round(meanMinutes, 1),
          medianMinutes: round(medianMinutes, 1),
          benchmarkMetPercent: round((underBenchmark / Math.max(records.length, 1)) * 100, 1),
        },
        target: {
          reductionPercent: targetReductionPct,
          projectedMedianMinutes: round(medianMinutes * (1 - targetReductionPct / 100), 1),
          wording: 'Target only; validate against future coordinate-linked 108 cases before claiming measured field improvement.',
        },
        byTriage,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  /**
   * GET /api/evaluation/108-comparison
   * Formally compares the 108 reference sample against current UyirKappan operational/simulated state.
   */
  router.get('/108-comparison', async (req, res) => {
    try {
      if (store) {
        baselineComparisonService.setDataStore(store);
      }
      const comparison = await baselineComparisonService.compareWith108Baseline();
      return res.json({
        success: true,
        ...comparison,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  return router;
};
