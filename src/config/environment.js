export const ENV = {
  DEV: 'development',
  PROD: 'production'
};

// You can toggle this to switch environments
export const CURRENT_ENV = ENV.PROD;

export const getApiConfig = () => {
  switch (CURRENT_ENV) {
    case ENV.DEV:
      return {
        CLOUD: 'http://proxy.cloudservices.agency:5050',
        PAYMENT: 'http://192.168.0.100:8085/api'
      };
    case ENV.PROD:
      return {
        CLOUD: 'http://proxy.cloudservices.agency:5050',
        PAYMENT: 'https://cloud-acc-management.duckdns.org/api'
      };
    default:
      return {
        CLOUD: 'http://proxy.cloudservices.agency:5050',
        PAYMENT: 'https://cloud-acc-management.duckdns.org/api'
      };
  }
}; 