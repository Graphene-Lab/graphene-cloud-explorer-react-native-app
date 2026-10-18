const http = require('node:http');
const https = require('node:https');
let networkMocks;

// Fail closed if a screen test accidentally reaches outside its service mocks.
beforeEach(() => {
  const unexpectedNetwork = () => { throw new Error('Live network access is forbidden in screen tests'); };
  networkMocks = [jest.spyOn(global, 'fetch').mockImplementation(unexpectedNetwork)];
  for (const transport of [http, https]) {
    networkMocks.push(jest.spyOn(transport, 'request').mockImplementation(unexpectedNetwork));
    networkMocks.push(jest.spyOn(transport, 'get').mockImplementation(unexpectedNetwork));
  }
});

afterEach(() => {
  for (const networkMock of networkMocks) expect(networkMock).not.toHaveBeenCalled();
});
