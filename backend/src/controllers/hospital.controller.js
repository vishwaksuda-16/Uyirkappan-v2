class HospitalController {
  constructor(ctx) {
    this.store = ctx.store;
    this.hospitalService = ctx.hospitalService;
  }

  async recommend(req, res) {
    const body = req.body || {};
    const pickupLocation = body.pickupLocation || {
      latitude: body.latitude,
      longitude: body.longitude,
    };

    if (!pickupLocation || typeof pickupLocation.latitude !== 'number' || typeof pickupLocation.longitude !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'pickupLocation.latitude and pickupLocation.longitude are required',
      });
    }

    const result = await this.hospitalService.selectBestHospital({
      emergencyType: body.emergencyType || 'OTHER',
      victimCount: body.victimCount || 1,
      pickupLocation,
    });

    if (!result?.selectedHospital) {
      return res.status(404).json({ success: false, message: 'No eligible hospital found' });
    }

    return res.json({
      success: true,
      selectedHospital: result.selectedHospital,
      selectedHospitalId: result.selectedHospitalId,
      candidateHospitals: result.candidateHospitals || [],
      selectionReason: result.selectionReason,
      estimatedTravelTime: result.estimatedTravelTime,
      distance: result.distance,
    });
  }

  async list(req, res) {
    return res.json({ success: true, hospitals: await this.store.getHospitals() });
  }

  async get(req, res) {
    const hospital = await this.store.getHospitalById(req.params.hospitalId);
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });
    return res.json({ success: true, hospital });
  }

  async incoming(req, res) {
    const result = await this.hospitalService.incoming(req.params.hospitalId, req.user);
    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });
    return res.json({ success: true, incoming: result.incoming });
  }

  async history(req, res) {
    const result = await this.hospitalService.history(req.params.hospitalId, req.user);
    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });
    return res.json({ success: true, history: result.history });
  }

  async resources(req, res) {
    const hospital = await this.store.getHospitalById(req.params.hospitalId);
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });
    if (!this.hospitalService.ownsHospital(req.user, req.params.hospitalId)) {
      return res.status(403).json({ success: false, message: 'Only staff of this hospital or admin can view resources' });
    }
    return res.json({ success: true, resources: hospital.resources, capacity: hospital.resources });
  }

  async updateResources(req, res) {
    const result = await this.hospitalService.updateResources(req.params.hospitalId, req.body || {}, req.user);
    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });
    return res.json({ success: true, hospital: result.hospital });
  }
}

module.exports = HospitalController;