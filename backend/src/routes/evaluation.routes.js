const { Router } = require('express');
const { datasetLoader } = require('../data/datasetLoader');

const round = (value, digits = 1) => Math.round(value * (10 ** digits)) / (10 ** digits);

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

module.exports = function buildEvaluationRoutes() {
  const router = Router();

  // Ground-truth operational calibration. This intentionally exposes only the
  // already-curated analytical fields, never patient or staff attributes.
  router.get('/108-summary', (req, res) => {
    datasetLoader.loadAll();
    const cases = datasetLoader.tamilNadu108Evaluation;
    const response = cases.map(c => c.responseSeconds).filter(Number.isFinite);
    const targetReductionPct = Math.min(Math.max(Number(req.query.targetReductionPct) || 10, 1), 30);
    const underBenchmark = cases.filter(c => c.metBenchmark).length;
    const triageGroups = cases.reduce((groups, c) => {
      const key = c.triage || 'Untriaged / IFT';
      (groups[key] ||= []).push(c.responseSeconds);
      return groups;
    }, {});
    const byTriage = Object.entries(triageGroups).map(([triage, values]) => ({
      triage,
      count: values.length,
      medianResponseMinutes: round(median(values) / 60),
    }));

    const medianSeconds = median(response);
    const meanSeconds = response.reduce((sum, value) => sum + value, 0) / Math.max(response.length, 1);
    return res.json({
      source: 'Tamil Nadu 108 anonymized operational sample',
      geographicLimitation: 'No coordinates supplied: suitable for response-time calibration, not map routing.',
      caseCount: cases.length,
      responseTime: {
        meanMinutes: round(meanSeconds / 60),
        medianMinutes: round(medianSeconds / 60),
        benchmarkMetPercent: round((underBenchmark / Math.max(cases.length, 1)) * 100),
      },
      target: {
        reductionPercent: targetReductionPct,
        projectedMedianMinutes: round((medianSeconds * (1 - targetReductionPct / 100)) / 60),
        wording: 'Target only; validate against future coordinate-linked 108 cases before claiming measured field improvement.',
      },
      byTriage,
    });
  });

  return router;
};
