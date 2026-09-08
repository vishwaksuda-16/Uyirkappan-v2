/**
 * Intelligent Matcher Integration Wrapper
 * 
 * This file imports the matcher services
 * and exposes them as JavaScript functions for your backend.
 */

const { createServiceContainer } = require('./config/service-container.js');

// Import the matcher services
let matcherServices = null;
let isInitialized = false;

/**
 * Initialize the matcher with Socket.IO instance
 */
function initializeMatcher(io) {
  if (isInitialized && matcherServices) {
    return matcherServices;
  }
  
  // Create the service container with your Socket.IO server
  matcherServices = createServiceContainer(io);
  isInitialized = true;
  
  console.log('[Matcher] Initialized successfully');
  return matcherServices;
}

/**
 * Get matcher services (must be initialized first)
 */
function getMatcherServices() {
  if (!isInitialized || !matcherServices) {
    throw new Error('Matcher not initialized. Call initializeMatcher(io) first.');
  }
  return matcherServices;
}

module.exports = {
  initializeMatcher,
  getMatcherServices
};
