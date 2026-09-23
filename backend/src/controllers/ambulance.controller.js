class AmbulanceController {
  constructor(ctx) {
    this.store = ctx.store;
    this.ambulanceService = ctx.ambulanceService;
  }

  async list(req, res) {
    return res.json({ success: true, ambulances: await this.store.getAmbulances() });
  }

  async get(req, res) {
    const ambulance = await this.store.getAmbulanceById(req.params.ambulanceId);
    if (!ambulance) return res.status(404).json({ success: false, message: 'Ambulance not found' });
    return res.json({ success: true, ambulance });
  }

  async updateStatus(req, res) {
    const result = await this.ambulanceService.updateStatus(req.params.ambulanceId, req.body || {}, req.user);
    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });
    return res.json({ success: true, ambulance: result.ambulance });
  }

  async updateLocation(req, res) {
    const result = await this.ambulanceService.updateLocation(req.params.ambulanceId, req.body || {}, req.user);
    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });
    console.log(`[GPS] ${req.params.ambulanceId} → ${req.body?.latitude}, ${req.body?.longitude}`);
    return res.json({ success: true, ok: true, ambulance: result.ambulance, eta: result.eta });
  }
}

module.exports = AmbulanceController;